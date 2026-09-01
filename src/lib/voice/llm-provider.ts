import "server-only";
import { createGeminiLlmProvider } from "./providers/gemini-llm";
import { createInworldRouterLlmProvider } from "./providers/inworld-router-llm";
import type { LlmProvider } from "./providers/types";
import { getCherryVoiceLlmProvider } from "./config";

let cached: { key: string; provider: LlmProvider } | null = null;

/** Resolve LLM provider from env / platform settings (cached per process). */
export async function createCherryVoiceLlmProvider(): Promise<LlmProvider> {
  const kind = await getCherryVoiceLlmProvider();
  if (cached?.key === kind) return cached.provider;

  const provider = kind === "gemini" ? createGeminiLlmProvider() : createInworldRouterLlmProvider();
  cached = { key: kind, provider };
  return provider;
}
