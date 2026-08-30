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

function toGeminiHistory(messages: LlmMessage[]) {
  return messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "model" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
}

function parseToolCalls(parts: Part[] | undefined): LlmTurnResult["toolCalls"] {
  if (!parts) return [];
  const calls: LlmTurnResult["toolCalls"] = [];
  for (const part of parts) {
    const fc = (part as { functionCall?: { name?: string; args?: Record<string, unknown> } })
      .functionCall;
    if (fc?.name) {
      calls.push({ name: fc.name, args: fc.args ?? {} });
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

export function createGeminiLlmProvider(): LlmProvider {
  return {
    async chat(messages, options) {
      const model = await getModel(options?.systemPrompt);
      const history = toGeminiHistory(messages.slice(0, -1));
      const last = messages[messages.length - 1];
      const chat = model.startChat({ history });

      const result = await chat.sendMessage(last?.content ?? "", {
        signal: options?.signal,
      });
      const response = result.response;
      const parts = response.candidates?.[0]?.content?.parts;

      return {
        text: extractText(parts),
        toolCalls: parseToolCalls(parts),
      };
    },

    async continueWithToolResults(messages, toolResults, options) {
      const model = await getModel(options?.systemPrompt);
      const history = toGeminiHistory(messages);
      const chat = model.startChat({ history });

      const functionResponseParts = toolResults.map((tr) => ({
        functionResponse: {
          name: tr.name,
          response: tr.result,
        },
      }));

      const result = await chat.sendMessage(functionResponseParts as never, {
        signal: options?.signal,
      });
      const parts = result.response.candidates?.[0]?.content?.parts;

      return {
        text: extractText(parts),
        toolCalls: parseToolCalls(parts),
      };
    },
  };
}

/** Export schema type helper for tools module */
export { SchemaType };
