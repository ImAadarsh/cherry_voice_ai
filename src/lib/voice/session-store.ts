import "server-only";
import type { TurnMetricEntry } from "@/lib/repositories/calls";
import type { LanguageMix } from "./language-detect";
import type { PersonalityPreset } from "./personality";
import type { VoiceTransport } from "./orchestrator-interface";
import type { HoursStatus } from "./restaurant-context";
import type { LlmToolCall, VoiceSessionEvent, VoiceSessionState } from "./providers/types";
import type { ToolCallEntry, TranscriptEntry } from "@/lib/repositories/calls";
import { normalizePersonalityPreset } from "./personality";

export interface ConversationMemory {
  phone?: string;
  name?: string;
}

export interface SessionMessage {
  role: "user" | "model";
  content: string;
  toolCalls?: LlmToolCall[];
  toolResults?: Array<{ name: string; result: unknown }>;
}

export interface VoiceSessionRecord {
  id: string;
  restaurantId: number;
  agentId: number | null;
  voiceId: string;
  greeting: string | null;
  personalityPreset: PersonalityPreset;
  transport: VoiceTransport;
  callerPhone: string | null;
  branchLabel: string | null;
  state: VoiceSessionState;
  messages: SessionMessage[];
  transcript: TranscriptEntry[];
  toolCalls: ToolCallEntry[];
  turnMetrics: TurnMetricEntry[];
  turnCount: number;
  callLogId: number | null;
  orderId: number | null;
  orderConfirmed: boolean;
  orderItemsSet: boolean;
  upsellSuggested: boolean;
  conversationMemory: ConversationMemory;
  lastUserText: string;
  detectedLanguage: LanguageMix;
  hoursStatus: HoursStatus | null;
  lowConfidenceUtterance: boolean;
  sttConfidence: number | null;
  textOnlyMode: boolean;
  ttsFailureCount: number;
  bargeInCount: number;
  menuCache: { body: unknown; expiresAt: number } | null;
  createdAt: number;
  lastActivityAt: number;
  subscribers: Set<(event: VoiceSessionEvent) => void>;
  ttsAbort: AbortController | null;
  processing: boolean;
  pendingUtterance: string;
  isSpeaking: boolean;
  failed: boolean;
  lastSilencePromptAt: number;
  silenceTimer: ReturnType<typeof setInterval> | null;
  durationTimer: ReturnType<typeof setInterval> | null;
  callDurationWarningGiven: boolean;
  branchId: number | null;
  sttLocale: string;
  processingEarconEnabled: boolean;
  postCallSmsEnabled: boolean;
}

const sessions = new Map<string, VoiceSessionRecord>();
const SESSION_TTL_MS = 30 * 60 * 1000;
const MENU_CACHE_TTL_MS = 10 * 60 * 1000;

export function createSessionId(): string {
  return `cvs_${crypto.randomUUID()}`;
}

export function createVoiceSession(input: {
  restaurantId: number;
  voiceId: string;
  greeting: string | null;
  agentId?: number | null;
  callLogId?: number | null;
  personalityPreset?: PersonalityPreset;
  transport?: VoiceTransport;
  callerPhone?: string | null;
  branchLabel?: string | null;
  branchId?: number | null;
  sttLocale?: string;
  processingEarconEnabled?: boolean;
  postCallSmsEnabled?: boolean;
}): VoiceSessionRecord {
  const session: VoiceSessionRecord = {
    id: createSessionId(),
    restaurantId: input.restaurantId,
    agentId: input.agentId ?? null,
    voiceId: input.voiceId,
    greeting: input.greeting,
    personalityPreset: normalizePersonalityPreset(input.personalityPreset),
    transport: input.transport ?? "web",
    callerPhone: input.callerPhone ?? null,
    branchLabel: input.branchLabel ?? null,
    state: "idle",
    messages: [],
    transcript: [],
    toolCalls: [],
    turnMetrics: [],
    turnCount: 0,
    callLogId: input.callLogId ?? null,
    orderId: null,
    orderConfirmed: false,
    orderItemsSet: false,
    upsellSuggested: false,
    conversationMemory: {},
    lastUserText: "",
    detectedLanguage: "en",
    hoursStatus: null,
    lowConfidenceUtterance: false,
    sttConfidence: null,
    textOnlyMode: false,
    ttsFailureCount: 0,
    bargeInCount: 0,
    menuCache: null,
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
    subscribers: new Set(),
    ttsAbort: null,
    processing: false,
    pendingUtterance: "",
    isSpeaking: false,
    failed: false,
    lastSilencePromptAt: 0,
    silenceTimer: null,
    durationTimer: null,
    callDurationWarningGiven: false,
    branchId: input.branchId ?? null,
    sttLocale: input.sttLocale ?? "en-US",
    processingEarconEnabled: input.processingEarconEnabled ?? false,
    postCallSmsEnabled: input.postCallSmsEnabled ?? false,
  };
  sessions.set(session.id, session);
  return session;
}

export function getVoiceSession(sessionId: string): VoiceSessionRecord | undefined {
  return sessions.get(sessionId);
}

export function listActiveVoiceSessions(restaurantId?: number): Array<{
  session_id: string;
  state: VoiceSessionState;
  turn_count: number;
  restaurant_id: number;
}> {
  const out: Array<{
    session_id: string;
    state: VoiceSessionState;
    turn_count: number;
    restaurant_id: number;
  }> = [];
  for (const s of sessions.values()) {
    if (s.state === "ended") continue;
    if (restaurantId != null && s.restaurantId !== restaurantId) continue;
    out.push({
      session_id: s.id,
      state: s.state,
      turn_count: s.turnCount,
      restaurant_id: s.restaurantId,
    });
  }
  return out;
}

export function getMenuCache(session: VoiceSessionRecord): unknown | null {
  if (!session.menuCache) return null;
  if (Date.now() > session.menuCache.expiresAt) {
    session.menuCache = null;
    return null;
  }
  return session.menuCache.body;
}

export function setMenuCache(session: VoiceSessionRecord, body: unknown): void {
  session.menuCache = { body, expiresAt: Date.now() + MENU_CACHE_TTL_MS };
}

export function deleteVoiceSession(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (session?.ttsAbort) session.ttsAbort.abort();
  if (session?.durationTimer) clearInterval(session.durationTimer);
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

export function recordBargeIn(session: VoiceSessionRecord): void {
  session.bargeInCount += 1;
}

export function enableTextOnlyMode(session: VoiceSessionRecord): void {
  if (session.textOnlyMode) return;
  session.textOnlyMode = true;
  emitSessionEvent(session, {
    type: "text_only_mode",
    payload: { enabled: true, message: "Audio unavailable — read the transcript below." },
  });
}

export function startCallDurationMonitor(
  session: VoiceSessionRecord,
  onWarn: () => void,
  onEnd: () => void,
): void {
  if (session.durationTimer) return;
  session.durationTimer = setInterval(() => {
    const elapsed = Date.now() - session.createdAt;
    if (!session.callDurationWarningGiven && elapsed >= 25 * 60 * 1000) {
      session.callDurationWarningGiven = true;
      onWarn();
    }
    if (elapsed >= 30 * 60 * 1000) onEnd();
  }, 30_000);
}

export function stopCallDurationMonitor(session: VoiceSessionRecord): void {
  if (session.durationTimer) {
    clearInterval(session.durationTimer);
    session.durationTimer = null;
  }
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

if (typeof setInterval !== "undefined") {
  setInterval(pruneExpiredSessions, 5 * 60 * 1000);
}
