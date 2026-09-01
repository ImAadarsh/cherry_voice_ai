import "server-only";
import type { LlmMessage, LlmProvider, LlmTurnResult, LlmToolCall } from "./types";
import { getInworldApiKey, getInworldRouterModel } from "../config";
import { CHERRY_VOICE_OPENAI_TOOLS } from "../tools";
import { limitLlmHistory, truncateToSpokenSentences } from "./gemini-llm";

const INWORLD_CHAT_URL = "https://api.inworld.ai/v1/chat/completions";
const MAX_OUTPUT_TOKENS = 150;

type OpenAiRole = "system" | "user" | "assistant" | "tool";

type OpenAiMessage = {
  role: OpenAiRole;
  content?: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
};

type AccumulatedToolCall = {
  id: string;
  name: string;
  arguments: string;
};

function toolResultContent(result: unknown): string {
  if (typeof result === "string") return result;
  try {
    return JSON.stringify(result);
  } catch {
    return String(result);
  }
}

function resolveToolCallId(
  tc: LlmToolCall,
  index: number,
  priorIds: string[],
): string {
  if (tc.id) return tc.id;
  const byName = priorIds.find((id) => id.includes(tc.name));
  if (byName) return byName;
  return `call_${tc.name}_${index}`;
}

function messagesToOpenAi(messages: LlmMessage[], systemPrompt?: string): OpenAiMessage[] {
  const out: OpenAiMessage[] = [];
  if (systemPrompt) out.push({ role: "system", content: systemPrompt });

  for (const m of messages) {
    if (m.role === "system") continue;

    if (m.role === "user") {
      if (m.toolResults?.length) {
        const priorAssistant = [...messages]
          .slice(0, messages.indexOf(m))
          .reverse()
          .find((msg) => msg.role === "model" && msg.toolCalls?.length);
        const priorIds = priorAssistant?.toolCalls?.map((tc, i) => resolveToolCallId(tc, i, [])) ?? [];

        for (let i = 0; i < m.toolResults.length; i += 1) {
          const tr = m.toolResults[i]!;
          const matchingCall = priorAssistant?.toolCalls?.[i];
          out.push({
            role: "tool",
            tool_call_id: matchingCall
              ? resolveToolCallId(matchingCall, i, priorIds)
              : `call_${tr.name}_${i}`,
            content: toolResultContent(tr.result),
          });
        }
      } else if (m.content) {
        out.push({ role: "user", content: m.content });
      }
      continue;
    }

    if (m.role === "model") {
      const msg: OpenAiMessage = {
        role: "assistant",
        content: m.content ?? null,
      };
      if (m.toolCalls?.length) {
        msg.tool_calls = m.toolCalls.map((tc, i) => ({
          id: resolveToolCallId(tc, i, []),
          type: "function" as const,
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.args ?? {}),
          },
        }));
      }
      out.push(msg);
    }
  }

  return out;
}

function parseToolCallsFromAccumulated(map: Map<number, AccumulatedToolCall>): LlmToolCall[] {
  const calls: LlmToolCall[] = [];
  for (const [, acc] of [...map.entries()].sort((a, b) => a[0] - b[0])) {
    if (!acc.name) continue;
    let args: Record<string, unknown> = {};
    if (acc.arguments.trim()) {
      try {
        args = JSON.parse(acc.arguments) as Record<string, unknown>;
      } catch {
        args = {};
      }
    }
    calls.push({ name: acc.name, args, id: acc.id || undefined });
  }
  return calls;
}

function parseSsePayload(raw: string): Record<string, unknown> | null {
  const line = raw.startsWith("data:") ? raw.slice(5).trim() : raw.trim();
  if (!line || line === "[DONE]") return null;
  try {
    return JSON.parse(line) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function applyStreamDelta(
  json: Record<string, unknown>,
  accumulated: Map<number, AccumulatedToolCall>,
): string {
  const choices = json.choices as Array<{ delta?: Record<string, unknown> }> | undefined;
  const delta = choices?.[0]?.delta;
  if (!delta) return "";

  const content = typeof delta.content === "string" ? delta.content : "";
  const toolCalls = delta.tool_calls as
    | Array<{
        index?: number;
        id?: string;
        function?: { name?: string; arguments?: string };
      }>
    | undefined;

  if (toolCalls?.length) {
    for (const tc of toolCalls) {
      const idx = tc.index ?? 0;
      let acc = accumulated.get(idx);
      if (!acc) {
        acc = { id: "", name: "", arguments: "" };
        accumulated.set(idx, acc);
      }
      if (tc.id) acc.id = tc.id;
      if (tc.function?.name) acc.name = tc.function.name;
      if (tc.function?.arguments) acc.arguments += tc.function.arguments;
    }
  }

  return content;
}

function parseNonStreamResponse(json: Record<string, unknown>): LlmTurnResult {
  const choices = json.choices as
    | Array<{
        message?: {
          content?: string | null;
          tool_calls?: Array<{
            id?: string;
            function?: { name?: string; arguments?: string };
          }>;
        };
      }>
    | undefined;

  const message = choices?.[0]?.message;
  const text = truncateToSpokenSentences(message?.content?.trim() ?? "");
  const toolCalls: LlmToolCall[] = [];

  for (const tc of message?.tool_calls ?? []) {
    const name = tc.function?.name ?? "";
    if (!name) continue;
    let args: Record<string, unknown> = {};
    const argStr = tc.function?.arguments ?? "";
    if (argStr.trim()) {
      try {
        args = JSON.parse(argStr) as Record<string, unknown>;
      } catch {
        args = {};
      }
    }
    toolCalls.push({ name, args, id: tc.id });
  }

  return { text, toolCalls };
}

async function requestChat(
  messages: OpenAiMessage[],
  options?: { signal?: AbortSignal; stream?: boolean },
): Promise<Response> {
  const apiKey = await getInworldApiKey();
  if (!apiKey) throw new Error("INWORLD_API_KEY is not configured");

  const model = await getInworldRouterModel();

  return fetch(INWORLD_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      tools: CHERRY_VOICE_OPENAI_TOOLS,
      tool_choice: "auto",
      max_tokens: MAX_OUTPUT_TOKENS,
      stream: options?.stream ?? false,
    }),
    signal: options?.signal,
  });
}

async function runGenerate(
  messages: LlmMessage[],
  options?: { systemPrompt?: string; signal?: AbortSignal },
): Promise<LlmTurnResult> {
  const openAiMessages = messagesToOpenAi(limitLlmHistory(messages), options?.systemPrompt);
  const res = await requestChat(openAiMessages, { signal: options?.signal, stream: false });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Inworld Router error (${res.status}): ${errText.slice(0, 300)}`);
  }

  const json = (await res.json()) as Record<string, unknown>;
  return parseNonStreamResponse(json);
}

async function* streamGenerate(
  messages: LlmMessage[],
  options?: { systemPrompt?: string; signal?: AbortSignal },
): AsyncGenerator<string, LlmTurnResult, undefined> {
  const openAiMessages = messagesToOpenAi(limitLlmHistory(messages), options?.systemPrompt);
  const res = await requestChat(openAiMessages, { signal: options?.signal, stream: true });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Inworld Router error (${res.status}): ${errText.slice(0, 300)}`);
  }

  if (!res.body) throw new Error("Inworld Router returned empty stream body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";
  const accumulatedTools = new Map<number, AccumulatedToolCall>();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (options?.signal?.aborted) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n");
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const json = parseSsePayload(trimmed);
      if (!json) continue;

      const deltaText = applyStreamDelta(json, accumulatedTools);
      if (deltaText) {
        fullText += deltaText;
        yield deltaText;
      }
    }
  }

  const tail = buffer.trim();
  if (tail && !options?.signal?.aborted) {
    const json = parseSsePayload(tail);
    if (json) {
      const deltaText = applyStreamDelta(json, accumulatedTools);
      if (deltaText) {
        fullText += deltaText;
        yield deltaText;
      }
    }
  }

  const toolCalls = parseToolCallsFromAccumulated(accumulatedTools);
  return {
    text: truncateToSpokenSentences(fullText.trim()),
    toolCalls,
  };
}

export function createInworldRouterLlmProvider(): LlmProvider {
  return {
    async chat(messages, options) {
      return runGenerate(messages, options);
    },

    async *chatStream(messages, options) {
      return yield* streamGenerate(messages, options);
    },

    async continueWithToolResults(messages, toolResults, options) {
      const history = limitLlmHistory(messages);
      const last = history[history.length - 1];
      const resultsAlreadyInHistory =
        last?.role === "user" &&
        last.toolResults?.length === toolResults.length &&
        last.toolResults.every((tr, i) => tr.name === toolResults[i]?.name);

      const withResults = resultsAlreadyInHistory
        ? history
        : [...history, { role: "user" as const, toolResults }];

      return runGenerate(withResults, options);
    },
  };
}
