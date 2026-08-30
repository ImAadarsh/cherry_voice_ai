import "server-only";
import {
  appendCherryVoiceToolCall,
  appendCherryVoiceTranscript,
  appendCherryVoiceTurnMetric,
  completeCherryVoiceCallLog,
  createCherryVoiceCallLog,
} from "@/lib/repositories/calls";
import type { TurnMetricEntry } from "@/lib/repositories/calls";
import type { VoiceSessionRecord } from "./session-store";
import { voiceErrorDedupKey } from "./user-errors";

const ERROR_DEDUP_MS = 60_000;
const errorDedupBySession = new WeakMap<VoiceSessionRecord, Map<string, number>>();

function shouldLogVoiceError(
  session: VoiceSessionRecord,
  kind: "tts" | "stt",
  error: string,
): boolean {
  let map = errorDedupBySession.get(session);
  if (!map) {
    map = new Map();
    errorDedupBySession.set(session, map);
  }
  const key = voiceErrorDedupKey(kind, error);
  const now = Date.now();
  const last = map.get(key) ?? 0;
  if (now - last < ERROR_DEDUP_MS) return false;
  map.set(key, now);
  return true;
}

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

export async function logCherryVoiceTurnMetric(
  session: VoiceSessionRecord,
  entry: TurnMetricEntry,
): Promise<void> {
  session.turnMetrics.push(entry);
  if (session.callLogId) {
    await appendCherryVoiceTurnMetric(session.callLogId, entry);
  }
}

export async function logCherryVoiceTtsError(
  session: VoiceSessionRecord,
  error: string,
  text?: string,
): Promise<void> {
  if (!shouldLogVoiceError(session, "tts", error)) return;

  const entry = {
    name: "tts_error",
    args: { text: text?.slice(0, 200) ?? null },
    result: { error },
    timestamp: new Date().toISOString(),
  };
  session.toolCalls.push(entry);

  if (session.callLogId) {
    await appendCherryVoiceToolCall(session.callLogId, entry);
  }
}

export async function logCherryVoiceSttError(session: VoiceSessionRecord, error: string): Promise<void> {
  if (!shouldLogVoiceError(session, "stt", error)) return;

  const entry = {
    name: "stt_error",
    args: {},
    result: { error },
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
      turn_metrics_count: session.turnMetrics.length,
      barge_in_count: session.bargeInCount,
      personality_preset: session.personalityPreset,
    },
  });
}
