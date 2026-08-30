import "server-only";
import {
  FunctionCallingMode,
  GoogleGenerativeAI,
  SchemaType,
  type FunctionDeclaration,
  type Part,
} from "@google/generative-ai";
import type { LlmMessage, LlmProvider, LlmTurnResult } from "./types";
import { getGeminiApiKey } from "@/lib/platform-config";
import { getCherryVoiceGeminiModel } from "../config";
import { CHERRY_VOICE_TOOL_DECLARATIONS } from "../tools";

type GeminiContent = { role: "user" | "model"; parts: Part[] };

type GeminiPartWithSignature = Part & {
  thoughtSignature?: string;
  thought_signature?: string;
};

function getThoughtSignature(part: GeminiPartWithSignature): string | undefined {
  return part.thoughtSignature ?? part.thought_signature;
}

function buildFunctionCallPart(tc: NonNullable<LlmMessage["toolCalls"]>[number]): GeminiPartWithSignature {
  const part: GeminiPartWithSignature = {
    functionCall: {
      name: tc.name,
      args: tc.args,
      ...(tc.id ? { id: tc.id } : {}),
    },
  };
  if (tc.thoughtSignature) {
    part.thoughtSignature = tc.thoughtSignature;
  }
  return part;
}

function toFunctionResponsePayload(result: unknown): object {
  if (result !== null && typeof result === "object" && !Array.isArray(result)) {
    return result as object;
  }
  return { result };
}

/** Build Gemini contents with functionResponse under role "user" (not legacy "function"). */
function messagesToContents(messages: LlmMessage[]): GeminiContent[] {
  const contents: GeminiContent[] = [];

  for (const m of messages) {
    if (m.role === "system") continue;

    if (m.role === "user") {
      if (m.toolResults?.length) {
        contents.push({
          role: "user",
          parts: m.toolResults.map((tr) => ({
            functionResponse: {
              name: tr.name,
              response: toFunctionResponsePayload(tr.result),
            },
          })),
        });
      } else if (m.content) {
        contents.push({ role: "user", parts: [{ text: m.content }] });
      }
      continue;
    }

    if (m.role === "model") {
      const parts: Part[] = [];
      if (m.toolCalls?.length) {
        for (const tc of m.toolCalls) {
          parts.push(buildFunctionCallPart(tc));
        }
      }
      if (m.content) {
        parts.push({ text: m.content });
      }
      if (parts.length > 0) {
        contents.push({ role: "model", parts });
      }
    }
  }

  return contents;
}

function parseToolCalls(parts: Part[] | undefined): LlmTurnResult["toolCalls"] {
  if (!parts) return [];
  const calls: LlmTurnResult["toolCalls"] = [];
  for (const part of parts) {
    const signed = part as GeminiPartWithSignature & {
      functionCall?: { name?: string; args?: Record<string, unknown>; id?: string };
    };
    const fc = signed.functionCall;
    if (fc?.name) {
      calls.push({
        name: fc.name,
        args: fc.args ?? {},
        thoughtSignature: getThoughtSignature(signed),
        id: fc.id,
      });
    }
  }
  return calls;
}

function extractText(parts: Part[] | undefined): string {
  if (!parts) return "";
  return parts
    .map((p) => (p as { text?: string }).text ?? "")
    .join("")
    .trim();
}

async function getModel(systemPrompt?: string) {
  const apiKey = await getGeminiApiKey();
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  const modelName = await getCherryVoiceGeminiModel();
  const genAI = new GoogleGenerativeAI(apiKey);

  return genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: systemPrompt,
    tools: [
      {
        functionDeclarations: CHERRY_VOICE_TOOL_DECLARATIONS as unknown as FunctionDeclaration[],
      },
    ],
    toolConfig: {
      functionCallingConfig: {
        mode: FunctionCallingMode.AUTO,
      },
    },
  });
}

async function runGenerate(
  contents: GeminiContent[],
  options?: { systemPrompt?: string; signal?: AbortSignal },
): Promise<LlmTurnResult> {
  const model = await getModel(options?.systemPrompt);
  const result = await model.generateContent({ contents }, { signal: options?.signal });
  const parts = result.response.candidates?.[0]?.content?.parts;

  return {
    text: extractText(parts),
    toolCalls: parseToolCalls(parts),
  };
}



async function* streamGenerate(
  contents: GeminiContent[],
  options?: { systemPrompt?: string; signal?: AbortSignal },
): AsyncGenerator<string, LlmTurnResult, undefined> {
  const model = await getModel(options?.systemPrompt);
  const result = await model.generateContentStream({ contents }, { signal: options?.signal });
  let fullText = "";
  for await (const chunk of result.stream) {
    const t = chunk.text();
    if (t) {
      fullText += t;
      yield t;
    }
  }
  const response = await result.response;
  const parts = response.candidates?.[0]?.content?.parts;
  return {
    text: extractText(parts) || fullText.trim(),
    toolCalls: parseToolCalls(parts),
  };
}

export function createGeminiLlmProvider(): LlmProvider {
  return {
    async chat(messages, options) {
      const history = messages.slice(0, -1);
      const last = messages[messages.length - 1];
      const contents = messagesToContents(history);

      if (last?.role === "user" && last.content) {
        contents.push({ role: "user", parts: [{ text: last.content }] });
      }

      return runGenerate(contents, options);
    },


    async *chatStream(messages, options) {
      const history = messages.slice(0, -1);
      const last = messages[messages.length - 1];
      const contents = messagesToContents(history);
      if (last?.role === "user" && last.content) {
        contents.push({ role: "user", parts: [{ text: last.content }] });
      }
      return yield* streamGenerate(contents, options);
    },

    async continueWithToolResults(messages, toolResults, options) {
      const contents = messagesToContents(messages);
      contents.push({
        role: "user",
        parts: toolResults.map((tr) => ({
          functionResponse: {
            name: tr.name,
            response: toFunctionResponsePayload(tr.result),
          },
        })),
      });

      return runGenerate(contents, options);
    },
  };
}

/** Export schema type helper for tools module */
export { SchemaType };
