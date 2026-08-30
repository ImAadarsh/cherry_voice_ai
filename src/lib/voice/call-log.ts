import "server-only";
import {
  appendCherryVoiceToolCall,
  appendCherryVoiceTranscript,
  completeCherryVoiceCallLog,
  createCherryVoiceCallLog,
} from "@/lib/repositories/calls";
import type { VoiceSessionRecord } from "./session-store";

/** Persist call log row for a new Cherry Voice session. */
export async function initCherryVoiceCallLog(session: VoiceSessionRecord): Promise<void> {
  if (session.callLogId) return;

  const callLogId = await createCherryVoiceCallLog({
    restaurantId: session.restaurantId,
    sessionId: session.id,
    agentId: session.agentId,
    voiceId: session.voiceId,
  });
  session.callLogId = callLogId;
}

export async function logCherryVoiceTranscript(
  session: VoiceSessionRecord,
  role: "user" | "assistant",
  text: string,
): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;

  const entry = { role, text: trimmed, timestamp: new Date().toISOString() };
  session.transcript.push(entry);

  if (session.callLogId) {
    await appendCherryVoiceTranscript(session.callLogId, entry);
  }
}

export async function logCherryVoiceToolCall(
  session: VoiceSessionRecord,
  name: string,
  args: Record<string, unknown>,
  result: unknown,
): Promise<void> {
  const entry = {
    name,
    args,
    result,
    timestamp: new Date().toISOString(),
  };
  session.toolCalls.push(entry);

  if (session.callLogId) {
    await appendCherryVoiceToolCall(session.callLogId, entry);
  }
}

export async function finalizeCherryVoiceCallLog(session: VoiceSessionRecord): Promise<void> {
  if (!session.callLogId) return;

  await completeCherryVoiceCallLog(session.callLogId, {
    status: session.failed ? "failed" : "completed",
    startedAtMs: session.createdAt,
    metadata: {
      voice_id: session.voiceId,
      session_id: session.id,
      order_id: session.orderId,
      message_count: session.messages.length,
    },
  });
}
