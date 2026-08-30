import "server-only";
import { createDeepgramSttProvider } from "./providers/deepgram-stt";
import { createGeminiLlmProvider } from "./providers/gemini-llm";
import { createInworldTtsProvider } from "./providers/inworld-tts";
import type { LlmMessage, LlmTurnResult } from "./providers/types";
import {
  emitSessionEvent,
  enableTextOnlyMode,
  getVoiceSession,
  interruptSpeech,
  recordBargeIn,
  setSessionState,
  startCallDurationMonitor,
  stopCallDurationMonitor,
  type VoiceSessionRecord,
} from "./session-store";
import {
  finalizeCherryVoiceCallLog,
  initCherryVoiceCallLog,
  logCherryVoiceSttError,
  logCherryVoiceToolCall,
  logCherryVoiceTranscript,
  logCherryVoiceTurnMetric,
  logCherryVoiceTtsError,
} from "./call-log";
import {
  getSilencePromptPhrase,
  getToolFillerPhrase,
  getTtsFallbackPhrase,
} from "./filler-phrases";
import { getCherryVoiceTtsModel } from "./config";
import { runToolWithTimeout } from "./circuit-breaker";
import { resolveRestaurantSttLocale } from "./deepgram-locale";
import { sendPostCallOrderSms } from "./post-call-sms";
import {
  buildVoiceSystemPrompt,
  updateConversationMemoryFromTool,
  updateConversationMemoryFromUser,
} from "./system-prompt";
import {
  createTurnTiming,
  extractCompleteSentences,
  finalizeTurnMetric,
  type TurnTiming,
} from "./turn-metrics";
import { executeCherryVoiceTool } from "./tools";
import { sanitizeVoiceError } from "./user-errors";
import { resolveInworldVoiceId } from "./inworld-voices";

const sttBySession = new Map<string, ReturnType<typeof createDeepgramSttProvider>>();
const llm = createGeminiLlmProvider();
const tts = createInworldTtsProvider();

const SILENCE_CHECK_MS = 10_000;
const SILENCE_PROMPT_AFTER_MS = 45_000;
const TTS_FLASH_MODEL = "inworld-tts-2-flash";
const LOW_STT_CONFIDENCE = 0.55;
const TTS_RETRY_MAX_CHARS = 240;
/** Ignore barge-in briefly after TTS starts (echo from speakers). */
const BARGE_IN_GRACE_MS = 700;
/** Partial transcripts need high confidence before interrupting agent speech. */
const BARGE_IN_MIN_CONFIDENCE = 0.78;
const BARGE_IN_MIN_PARTIAL_CHARS = 5;

type SpeakOptions = {
  skipTranscriptLog?: boolean;
  modelId?: string;
  timing?: TurnTiming | null;
};

function truncateForTtsRetry(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= TTS_RETRY_MAX_CHARS) return trimmed;
  const slice = trimmed.slice(0, TTS_RETRY_MAX_CHARS);
  const lastSpace = slice.lastIndexOf(" ");
  return (lastSpace > 80 ? slice.slice(0, lastSpace) : slice).trim();
}

function shouldAllowBargeIn(
  session: VoiceSessionRecord,
  text: string,
  isFinal: boolean,
  confidence: number | null | undefined,
): boolean {
  if (!session.isSpeaking) return false;

  const elapsed = Date.now() - (session.speakingStartedAt ?? 0);
  if (elapsed < BARGE_IN_GRACE_MS) return false;

  const trimmed = text.trim();
  if (!trimmed) return false;

  if (isFinal) return trimmed.length >= 2;

  if (trimmed.length < BARGE_IN_MIN_PARTIAL_CHARS) return false;
  if (confidence != null && confidence > 0 && confidence < BARGE_IN_MIN_CONFIDENCE) return false;
  return true;
}

function maybeBargeIn(
  session: VoiceSessionRecord,
  text: string,
  isFinal: boolean,
  confidence?: number | null,
): void {
  if (!shouldAllowBargeIn(session, text, isFinal, confidence)) return;
  recordBargeIn(session);
  interruptSpeech(session);
}

function sessionMessagesToLlm(
  messages: VoiceSessionRecord["messages"],
): LlmMessage[] {
  return messages.map((m) => ({
    role: m.role,
    content: m.content,
    ...(m.toolCalls?.length ? { toolCalls: m.toolCalls } : {}),
    ...(m.toolResults?.length ? { toolResults: m.toolResults } : {}),
  }));
}

function llmMessageToSession(m: LlmMessage): VoiceSessionRecord["messages"][number] {
  return {
    role: m.role as "user" | "model",
    content: m.content ?? "",
    ...(m.toolCalls?.length ? { toolCalls: m.toolCalls } : {}),
    ...(m.toolResults?.length ? { toolResults: m.toolResults } : {}),
  };
}

function appendTurnToSession(
  session: VoiceSessionRecord,
  baseCount: number,
  messages: LlmMessage[],
  userText: string,
  reply: string,
): void {
  session.messages.push({ role: "user", content: userText });
  for (const m of messages.slice(baseCount + 1)) {
    session.messages.push(llmMessageToSession(m));
  }
  session.messages.push({ role: "model", content: reply });
}

async function executeToolCalls(
  session: VoiceSessionRecord,
  calls: LlmTurnResult["toolCalls"],
): Promise<Array<{ name: string; result: unknown }>> {
  return Promise.all(
    calls.map(async (call) => {
      const result = await runToolWithTimeout(call.name, () =>
        executeCherryVoiceTool(session.restaurantId, call.name, call.args, session),
      );
      await logCherryVoiceToolCall(session, call.name, call.args, result);
      updateConversationMemoryFromTool(session, call.name, call.args, result);
      return { name: call.name, result };
    }),
  );
}

async function streamLlmToSpeech(
  session: VoiceSessionRecord,
  userText: string,
  timing: TurnTiming,
): Promise<string> {
  const systemPrompt = await buildVoiceSystemPrompt(session, userText);
  const baseCount = session.messages.length;
  const messages: LlmMessage[] = [
    ...sessionMessagesToLlm(session.messages),
    { role: "user", content: userText },
  ];

  timing.llmStartAt = Date.now();
  let buffer = "";
  let agentText = "";
  const stream = llm.chatStream(messages, { systemPrompt });
  let result = await stream.next();

  while (!result.done) {
    buffer += String(result.value);
    const { sentences, remainder } = extractCompleteSentences(buffer);
    buffer = remainder;
    for (const sentence of sentences) {
      timing.llmEndAt = Date.now();
      agentText += (agentText ? " " : "") + sentence;
      await speakResponse(session, sentence, { timing, skipTranscriptLog: true });
    }
    result = await stream.next();
  }

  const turn = result.value;
  timing.llmEndAt = timing.llmEndAt || Date.now();

  if (turn.toolCalls.length > 0) {
    if (buffer.trim()) {
      agentText += (agentText ? " " : "") + buffer.trim();
      await speakResponse(session, buffer.trim(), { timing, skipTranscriptLog: true });
      buffer = "";
    }

    const filler = await getToolFillerPhrase(
      session.restaurantId,
      turn.toolCalls.map((c) => c.name),
    );
    await speakResponse(session, filler, { skipTranscriptLog: true, modelId: TTS_FLASH_MODEL, timing });

    timing.toolStartAt = Date.now();
    emitSessionEvent(session, {
      type: "tool_start",
      payload: { tools: turn.toolCalls.map((c) => c.name) },
    });

    let currentTurn = turn;
    let guard = 0;
    let reply = turn.text;

    while (currentTurn.toolCalls.length > 0 && guard < 6) {
      guard += 1;
      const toolResults = await executeToolCalls(session, currentTurn.toolCalls);
      timing.toolEndAt = Date.now();

      messages.push({ role: "model", content: currentTurn.text, toolCalls: currentTurn.toolCalls });
      const followUp = await llm.continueWithToolResults(messages, toolResults, { systemPrompt });
      messages.push({ role: "user", toolResults });
      reply = followUp.text || reply;
      currentTurn = followUp;
    }

    await speakResponse(session, reply.trim(), { timing });
    appendTurnToSession(session, baseCount, messages, userText, reply);
    return reply;
  }

  if (buffer.trim()) {
    agentText += (agentText ? " " : "") + buffer.trim();
    await speakResponse(session, buffer.trim(), { timing, skipTranscriptLog: true });
    buffer = "";
  }

  const finalText = agentText || turn.text;
  if (finalText && !agentText) {
    await speakResponse(session, finalText, { timing });
  } else if (finalText) {
    await logCherryVoiceTranscript(session, "assistant", finalText);
    emitSessionEvent(session, { type: "assistant_text", payload: { text: finalText } });
    if (!session.textOnlyMode && timing.firstAudioAt == null) {
      await speakResponse(session, finalText, { timing, skipTranscriptLog: true });
    }
  }

  const reply = finalText || "Sorry, I couldn't complete that. Could you repeat?";
  appendTurnToSession(session, baseCount, messages, userText, reply);
  return reply;
}

async function synthesizeWithChunks(
  session: VoiceSessionRecord,
  text: string,
  options?: { modelId?: string; timing?: TurnTiming | null },
): Promise<number> {
  if (session.textOnlyMode) return 0;
  const trimmed = text.trim();
  if (!trimmed) return 0;

  let audioChunks = 0;
  let firstMarked = false;
  await tts.synthesize({
    voiceId: session.voiceId,
    text: trimmed,
    modelId: options?.modelId,
    signal: session.ttsAbort?.signal,
    onFirstChunk: () => {
      if (!firstMarked && options?.timing) {
        options.timing.firstAudioAt = Date.now();
        if (!options.timing.ttsStartAt) options.timing.ttsStartAt = Date.now();
        firstMarked = true;
      }
    },
    onAudioChunk: (pcm) => {
      audioChunks += 1;
      emitSessionEvent(session, {
        type: "audio",
        payload: {
          encoding: "pcm_s16le",
          sampleRate: 24000,
          data: pcm.toString("base64"),
        },
      });
    },
  });
  return audioChunks;
}

async function synthesizeWithRetries(
  session: VoiceSessionRecord,
  text: string,
  options?: { modelId?: string; timing?: TurnTiming | null },
): Promise<number> {
  let chunks = await synthesizeWithChunks(session, text, options);
  if (chunks > 0 || session.ttsAbort?.signal.aborted) return chunks;

  chunks = await synthesizeWithChunks(session, text, options);
  if (chunks > 0 || session.ttsAbort?.signal.aborted) return chunks;

  const shorter = truncateForTtsRetry(text);
  if (shorter && shorter !== text.trim()) {
    chunks = await synthesizeWithChunks(session, shorter, options);
  }
  return chunks;
}

async function emitTtsFallback(
  session: VoiceSessionRecord,
  text: string,
  timing?: TurnTiming | null,
): Promise<void> {
  if (timing) timing.audioFallbackEmitted = true;
  emitSessionEvent(session, {
    type: "tts_fallback",
    payload: { text, useWebSpeech: true },
  });
}

async function speakResponse(
  session: VoiceSessionRecord,
  text: string,
  options?: SpeakOptions,
): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed || session.state === "ended") return;

  const generation = session.speakGeneration;
  session.speakQueue = session.speakQueue
    .catch(() => {})
    .then(() => speakResponseNow(session, trimmed, options, generation));
  await session.speakQueue;
}

async function speakResponseNow(
  session: VoiceSessionRecord,
  trimmed: string,
  options: SpeakOptions | undefined,
  generation: number,
): Promise<void> {
  if (generation !== session.speakGeneration || session.state === "ended") return;

  session.activeSpeakCount += 1;
  session.ttsAbort = new AbortController();
  session.isSpeaking = true;
  session.speakingStartedAt = Date.now();
  setSessionState(session, "speaking");

  if (!options?.skipTranscriptLog) {
    emitSessionEvent(session, { type: "assistant_text", payload: { text: trimmed } });
    await logCherryVoiceTranscript(session, "assistant", trimmed);
  }

  if (session.textOnlyMode) {
    session.ttsAbort = null;
    setSessionState(session, "listening");
    return;
  }

  if (options?.timing && !options.timing.ttsStartAt) {
    options.timing.ttsStartAt = Date.now();
  }

  try {
    let audioChunks = await synthesizeWithRetries(session, trimmed, options);

    if (audioChunks === 0 && !session.ttsAbort.signal.aborted) {
      session.ttsFailureCount += 1;
      const errMsg = "TTS returned no audio chunks";
      await logCherryVoiceTtsError(session, errMsg, trimmed);
      emitSessionEvent(session, {
        type: "error",
        payload: { message: sanitizeVoiceError(errMsg), recoverable: true },
      });

      await emitTtsFallback(session, trimmed, options?.timing);

      const fallbackPhrase = await getTtsFallbackPhrase(session.restaurantId);
      const fallbackChunks = await synthesizeWithChunks(session, fallbackPhrase, options);
      if (fallbackChunks > 0) {
        emitSessionEvent(session, { type: "assistant_text", payload: { text: fallbackPhrase } });
        await logCherryVoiceTranscript(session, "assistant", fallbackPhrase);
      }

      if (session.ttsFailureCount >= 2) {
        enableTextOnlyMode(session);
      }
    }
  } catch (err) {
    if ((err as Error).name !== "AbortError" && !session.ttsAbort?.signal.aborted) {
      session.ttsFailureCount += 1;
      const message = (err as Error).message;
      await logCherryVoiceTtsError(session, message, trimmed);
      session.failed = true;
      emitSessionEvent(session, {
        type: "error",
        payload: { message: sanitizeVoiceError(message), recoverable: true },
      });
      await emitTtsFallback(session, trimmed, options?.timing);
      try {
        const fallbackPhrase = await getTtsFallbackPhrase(session.restaurantId);
        const fallbackChunks = await synthesizeWithChunks(session, fallbackPhrase, options);
        if (fallbackChunks > 0) {
          emitSessionEvent(session, { type: "assistant_text", payload: { text: fallbackPhrase } });
          await logCherryVoiceTranscript(session, "assistant", fallbackPhrase);
        }
      } catch {
        /* best effort */
      }
      if (session.ttsFailureCount >= 2) enableTextOnlyMode(session);
    }
  } finally {
    if (generation === session.speakGeneration) {
      session.activeSpeakCount = Math.max(0, session.activeSpeakCount - 1);
    }
    session.ttsAbort = null;
    session.speakingStartedAt = null;
    if (session.activeSpeakCount === 0) {
      session.isSpeaking = false;
      if (session.state === "speaking") {
        setSessionState(session, "listening");
      }
    }
  }
}

async function processUtterance(
  session: VoiceSessionRecord,
  utterance: string,
  sttConfidence?: number | null,
): Promise<void> {
  const text = utterance.trim();
  if (!text || session.processing) return;

  session.processing = true;
  session.pendingUtterance = "";
  session.turnCount += 1;
  session.turnBargeIn = false;
  const timing = createTurnTiming(session.turnCount, Date.now());
  timing.llmStartAt = Date.now();
  setSessionState(session, "thinking");

  session.sttConfidence = sttConfidence ?? null;
  session.lowConfidenceUtterance =
    sttConfidence != null && sttConfidence > 0 && sttConfidence < LOW_STT_CONFIDENCE;

  updateConversationMemoryFromUser(session, text);

  emitSessionEvent(session, {
    type: "transcript",
    payload: { text, isFinal: true, role: "user" },
  });
  await logCherryVoiceTranscript(session, "user", text);

  let reply = "";
  let zeroAudio = false;
  try {
    reply = await streamLlmToSpeech(session, text, timing);
    zeroAudio =
      timing.firstAudioAt == null &&
      !timing.audioFallbackEmitted &&
      !session.textOnlyMode;
  } catch (err) {
    session.failed = true;
    emitSessionEvent(session, {
      type: "error",
      payload: { message: sanitizeVoiceError((err as Error).message) },
    });
    setSessionState(session, "listening");
  } finally {
    const metric = finalizeTurnMetric(timing, {
      zeroAudio,
      conf: sttConfidence ?? null,
      user: text,
      agent: reply,
      bargeIn: session.turnBargeIn,
    });
    await logCherryVoiceTurnMetric(session, metric);
    session.processing = false;
    const queued = session.pendingUtterance.trim();
    session.pendingUtterance = "";
    if (queued) void processUtterance(session, queued, session.sttConfidence);
  }
}

async function maybeLoyaltyGreeting(session: VoiceSessionRecord): Promise<string | null> {
  const phone = session.callerPhone ?? session.conversationMemory.phone;
  if (!phone) return null;
  const result = await executeCherryVoiceTool(session.restaurantId, "lookup_customer", { phone }, session);
  if (!result.ok || !result.data) return null;
  const data = result.data as { name?: string; last_order?: string };
  const name = data.name?.trim();
  if (name) {
    session.conversationMemory.name = name;
    return `Welcome back, ${name}!`;
  }
  return null;
}

function startSilenceMonitor(session: VoiceSessionRecord): void {
  if (session.silenceTimer) return;
  session.silenceTimer = setInterval(() => {
    if (session.state !== "listening" || session.processing || session.isSpeaking) return;
    const idleMs = Date.now() - session.lastActivityAt;
    if (idleMs < SILENCE_PROMPT_AFTER_MS) return;
    const sincePrompt = Date.now() - session.lastSilencePromptAt;
    if (sincePrompt < SILENCE_PROMPT_AFTER_MS) return;
    session.lastSilencePromptAt = Date.now();
    void getSilencePromptPhrase(session.restaurantId).then((prompt) => {
      if (session.state === "listening" && !session.processing && !session.isSpeaking) {
        void speakResponse(session, prompt);
      }
    });
  }, SILENCE_CHECK_MS);
}

function stopSilenceMonitor(session: VoiceSessionRecord): void {
  if (session.silenceTimer) {
    clearInterval(session.silenceTimer);
    session.silenceTimer = null;
  }
}

export async function startVoiceOrchestrator(sessionId: string): Promise<void> {
  const session = getVoiceSession(sessionId);
  if (!session) throw new Error("Session not found");
  if (sttBySession.has(sessionId)) return;

  session.voiceId = resolveInworldVoiceId(session.voiceId);

  await initCherryVoiceCallLog(session);

  const sttLocale = session.sttLocale || (await resolveRestaurantSttLocale(session.restaurantId));
  session.sttLocale = sttLocale;
  const stt = createDeepgramSttProvider({ language: sttLocale });
  sttBySession.set(sessionId, stt);

  let utteranceTimer: ReturnType<typeof setTimeout> | null = null;
  let lastConfidence: number | null = null;

  const scheduleUtterance = () => {
    if (utteranceTimer) clearTimeout(utteranceTimer);
    utteranceTimer = setTimeout(() => {
      const text = session.pendingUtterance.trim();
      if (text && !session.processing) void processUtterance(session, text, lastConfidence);
    }, 800);
  };

  stt.onTranscript((event) => {
    if (event.speechStarted && session.isSpeaking && event.text?.trim()) {
      maybeBargeIn(session, event.text, false, event.confidence);
    }
    if (event.confidence != null) lastConfidence = event.confidence;

    if (!event.text) return;

    emitSessionEvent(session, {
      type: "transcript",
      payload: { text: event.text, isFinal: event.isFinal, role: "user" },
    });

    if (event.isFinal) {
      session.pendingUtterance = `${session.pendingUtterance} ${event.text}`.trim();
      scheduleUtterance();
    } else if (session.isSpeaking) {
      maybeBargeIn(session, event.text, false, event.confidence);
    }
  });

  stt.onError((err) => {
    session.failed = true;
    void logCherryVoiceSttError(session, err.message);
    const friendly = sanitizeVoiceError(err.message);
    if (friendly) {
      emitSessionEvent(session, { type: "error", payload: { message: friendly, recoverable: true } });
    }
  });

  stt.onDisconnect?.(() => {
    emitSessionEvent(session, {
      type: "network_warning",
      payload: { message: "Connection interrupted — trying to recover. You can keep speaking." },
    });
  });

  await stt.connect();
  setSessionState(session, "listening");
  startSilenceMonitor(session);

  startCallDurationMonitor(
    session,
    () => {
      emitSessionEvent(session, {
        type: "duration_warning",
        payload: { message: "This call will end in about five minutes." },
      });
      void speakResponse(session, "Just a heads up — we have about five minutes left on this call.");
    },
    () => {
      void stopVoiceOrchestrator(sessionId);
    },
  );

  const loyalty = await maybeLoyaltyGreeting(session);
  const greeting = [loyalty, session.greeting].filter(Boolean).join(" ");

  if (greeting) {
    emitSessionEvent(session, { type: "greeting", payload: { text: greeting } });
    void speakResponse(session, greeting);
  }
}

export function sendAudioToSession(sessionId: string, chunk: Buffer): void {
  const stt = sttBySession.get(sessionId);
  stt?.sendAudio(chunk);
}

export async function stopVoiceOrchestrator(sessionId: string): Promise<void> {
  const stt = sttBySession.get(sessionId);
  stt?.close();
  sttBySession.delete(sessionId);

  const session = getVoiceSession(sessionId);
  if (session) {
    stopSilenceMonitor(session);
    stopCallDurationMonitor(session);
    interruptSpeech(session);
    setSessionState(session, "ended");

    await sendPostCallOrderSms(session, session.postCallSmsEnabled);

    await finalizeCherryVoiceCallLog(session);
  }
}

export function interruptSession(sessionId: string): void {
  const session = getVoiceSession(sessionId);
  if (session) interruptSpeech(session);
}

// Ensure flash model constant is referenced for tree-shaking of config
void getCherryVoiceTtsModel;
