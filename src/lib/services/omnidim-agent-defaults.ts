import "server-only";
import type { BodyOf } from "@omnidim-ai/sdk";
import { getOmnidim } from "@/lib/omnidim";

/** Omnidim agent settings applied on create/update so callers can barge in. */
export const OMNIDIM_AGENT_VOICE_DEFAULTS: NonNullable<BodyOf<"updateAgent">> = {
  is_interruption_allowed: true,
  is_welcome_message_interruption: true,
  transcriber: {
    interruption_min_words: 1,
  },
};

/** Apply voice/interruption defaults to an agent (best-effort, idempotent). */
export async function applyAgentVoiceDefaults(omnidimAgentId: string | number): Promise<void> {
  const omnidim = await getOmnidim();
  try {
    await omnidim.agents.update(omnidimAgentId, OMNIDIM_AGENT_VOICE_DEFAULTS as never);
  } catch (err) {
    console.warn(
      `[omnidim-agent-defaults] Failed to apply voice defaults to agent ${omnidimAgentId}:`,
      err instanceof Error ? err.message : err,
    );
  }
}
