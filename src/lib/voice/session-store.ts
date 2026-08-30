import "server-only";
import type { VoiceSessionEvent, VoiceSessionState } from "./providers/types";
import type { ToolCallEntry, TranscriptEntry } from "@/lib/repositories/calls";

export interface VoiceSessionRecord {
  id: string;
  restaurantId: number;
  agentId: number | null;
  voiceId: string;
  greeting: string | null;
  state: VoiceSessionState;
  messages: Array<{ role: "user" | "model"; content: string }>;
  transcript: TranscriptEntry[];
  toolCalls: ToolCallEntry[];
  callLogId: number | null;
  orderId: number | null;
  createdAt: number;
  lastActivityAt: number;
  subscribers: Set<(event: VoiceSessionEvent) => void>;
  ttsAbort: AbortController | null;
  processing: boolean;
  pendingUtterance: string;
  isSpeaking: boolean;
  failed: boolean;
}

const sessions = new Map<string, VoiceSessionRecord>();
const SESSION_TTL_MS = 30 * 60 * 1000;

export function createSessionId(): string {
  return `cvs_${crypto.randomUUID()}`;
}

export function createVoiceSession(input: {
  restaurantId: number;
  voiceId: string;
  greeting: string | null;
  agentId?: number | null;
  callLogId?: number | null;
}): VoiceSessionRecord {
  const session: VoiceSessionRecord = {
    id: createSessionId(),
    restaurantId: input.restaurantId,
    agentId: input.agentId ?? null,
    voiceId: input.voiceId,
    greeting: input.greeting,
    state: "idle",
    messages: [],
    transcript: [],
    toolCalls: [],
    callLogId: input.callLogId ?? null,
    orderId: null,
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
    subscribers: new Set(),
    ttsAbort: null,
    processing: false,
    pendingUtterance: "",
    isSpeaking: false,
    failed: false,
  };
  sessions.set(session.id, session);
  return session;
}

export function getVoiceSession(sessionId: string): VoiceSessionRecord | undefined {
  return sessions.get(sessionId);
}

export function deleteVoiceSession(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (session?.ttsAbort) session.ttsAbort.abort();
  sessions.delete(sessionId);
}

export function touchSession(session: VoiceSessionRecord): void {
  session.lastActivityAt = Date.now();
}

export function setSessionState(session: VoiceSessionRecord, state: VoiceSessionState): void {
  session.state = state;
  emitSessionEvent(session, { type: "state", payload: { state } });
}

export function emitSessionEvent(session: VoiceSessionRecord, event: VoiceSessionEvent): void {
  touchSession(session);
  for (const subscriber of session.subscribers) {
    try {
      subscriber(event);
    } catch (err) {
      console.error("[voice-session] subscriber error:", err);
    }
  }
}

export function subscribeSession(
  session: VoiceSessionRecord,
  handler: (event: VoiceSessionEvent) => void,
): () => void {
  session.subscribers.add(handler);
  return () => session.subscribers.delete(handler);
}

export function interruptSpeech(session: VoiceSessionRecord): void {
  if (session.ttsAbort) {
    session.ttsAbort.abort();
    session.ttsAbort = null;
  }
  session.isSpeaking = false;
  if (session.state === "speaking") {
    setSessionState(session, "listening");
  }
  emitSessionEvent(session, { type: "state", payload: { interrupted: true } });
}

export function pruneExpiredSessions(): void {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.lastActivityAt > SESSION_TTL_MS) {
      deleteVoiceSession(id);
    }
  }
}

// Periodic cleanup
if (typeof setInterval !== "undefined") {
  setInterval(pruneExpiredSessions, 5 * 60 * 1000);
}
