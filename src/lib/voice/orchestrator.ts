import "server-only";
import { createDeepgramSttProvider } from "./providers/deepgram-stt";
import { truncateToSpokenSentences } from "./providers/gemini-llm";
import { createInworldTtsProvider } from "./providers/inworld-tts";
import type { LlmMessage, LlmProvider, LlmTurnResult } from "./providers/types";
import { createCherryVoiceLlmProvider } from "./llm-provider";
import {
  cancelInFlightLlm,
  cancelInFlightTurn,
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
  getThinkingFillerPhrase,
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
import { matchSemanticCache } from "./semantic-cache";
import { sanitizeTextForTts } from "./tts-sanitize";

const sttBySession = new Map<string, ReturnType<typeof createDeepgramSttProvider>>();
const tts = createInworldTtsProvider();
let llmPromise: Promise<LlmProvider> | null = null;

async function getLlm(): Promise<LlmProvider> {
  if (!llmPromise) llmPromise = createCherryVoiceLlmProvider();
  return llmPromise;
}

const SILENCE_CHECK_MS = 10_000;
const SILENCE_PROMPT_AFTER_MS = 45_000;
const TTS_FLASH_MODEL = "inworld-tts-2-flash";
const LOW_STT_CONFIDENCE = 0.55;
const TTS_RETRY_MAX_CHARS = 240;
/** Ignore barge-in briefly after TTS starts (echo from speakers). */
const BARGE_IN_GRACE_MS = 200;
/** Partial transcripts need moderate confidence before interrupting agent speech. */
const BARGE_IN_MIN_CONFIDENCE = 0.5;
const BARGE_IN_MIN_PARTIAL_CHARS = 3;
const UTTERANCE_DEBOUNCE_MS = 400;
const UTTERANCE_MAX_WAIT_MS = 1500;
const MIN_UTTERANCE_CHARS = 3;
/** Backchannel filler within this window after user end-of-speech. */
const THINKING_FILLER_DELAY_MS = 280;
/** Resume STT after TTS ends (matches client half-duplex tail). */
const HALF_DUPLEX_TAIL_MS = 100;
/** Warn and force mic resume if caller is silent too long after agent speech. */
const MIC_WATCHDOG_MS = 10_000;
const MIC_WATCHDOG_INTERVAL_MS = 2_000;
/** Force listening if stuck in speaking state (half-duplex recovery). */
const SPEAKING_STUCK_MS = 15_000;
/** Keep only recent exchanges in LLM context. */
const MAX_LLM_TURN_HISTORY = 4;

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

function isTurnInputBlocked(session: VoiceSessionRecord): boolean {
  return session.state === "speaking" || session.state === "tool_running";
}

function shouldIgnoreSttEvent(session: VoiceSessionRecord, event: { text?: string; isFinal?: boolean; speechStarted?: boolean; utteranceEnd?: boolean }): boolean {
  if (!session.isSpeaking && session.state !== "tool_running") return false;
  if (session.sttUnblocked) return false;
  // Half-duplex: ignore echo/partials while agent audio is playing unless user explicitly interrupted.
  if (event.speechStarted || event.utteranceEnd) return true;
  if (!event.text) return true;
  return !event.isFinal;
}

function isUtteranceStale(session: VoiceSessionRecord, utteranceId: number): boolean {
  return utteranceId !== session.latestUtteranceId;
}

async function speakThinkingFiller(
  session: VoiceSessionRecord,
  utteranceId: number,
): Promise<void> {
  await new Promise((r) => setTimeout(r, THINKING_FILLER_DELAY_MS));
  if (isUtteranceStale(session, utteranceId) || session.state !== "thinking") return;
  const phrase = await getThinkingFillerPhrase(session.restaurantId);
  await speakResponse(session, phrase, {
    skipTranscriptLog: true,
    modelId: TTS_FLASH_MODEL,
  });
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

function maybeBargeInOnSpeechStart(session: VoiceSessionRecord): void {
  if (!session.isSpeaking) return;
  const elapsed = Date.now() - (session.speakingStartedAt ?? 0);
  if (elapsed < BARGE_IN_GRACE_MS) return;
  recordBargeIn(session);
  interruptSpeech(session);
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

function supersedeInFlightUtterance(session: VoiceSessionRecord): number {
  session.utteranceSeq += 1;
  session.latestUtteranceId = session.utteranceSeq;
  cancelInFlightTurn(session);
  return session.latestUtteranceId;
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

function recentSessionMessages(
  messages: VoiceSessionRecord["messages"],
): VoiceSessionRecord["messages"] {
  return messages.slice(-MAX_LLM_TURN_HISTORY * 2);
}

async function streamLlmToSpeech(
  session: VoiceSessionRecord,
  userText: string,
  timing: TurnTiming,
  utteranceId: number,
): Promise<string> {
  if (isUtteranceStale(session, utteranceId)) return "";

  const llm = await getLlm();
  const systemPrompt = await buildVoiceSystemPrompt(session, userText);
  const baseCount = session.messages.length;
  const history = recentSessionMessages(session.messages);
  const messages: LlmMessage[] = [
    ...sessionMessagesToLlm(history),
    { role: "user", content: userText },
  ];

  const cacheHit = matchSemanticCache(userText);
  if (cacheHit) {
    timing.llmStartAt = Date.now();
    timing.llmEndAt = Date.now();
    const cachedText = truncateToSpokenSentences(cacheHit.text);
    await speakResponse(session, cachedText, { timing });

    if (cacheHit.toolCalls?.length) {
      timing.toolStartAt = Date.now();
      setSessionState(session, "tool_running");
      emitSessionEvent(session, {
        type: "tool_start",
        payload: { tools: cacheHit.toolCalls.map((c) => c.name) },
      });

      session.llmAbort = new AbortController();
      const toolResults = await executeToolCalls(session, cacheHit.toolCalls);
      timing.toolEndAt = Date.now();

      messages.push({ role: "model", content: cachedText, toolCalls: cacheHit.toolCalls });
      const followUp = await llm.continueWithToolResults(messages, toolResults, {
        systemPrompt,
        signal: session.llmAbort.signal,
      });
      const reply = truncateToSpokenSentences(followUp.text || cachedText);
      if (!isUtteranceStale(session, utteranceId)) {
        await speakResponse(session, reply, { timing });
        appendTurnToSession(session, baseCount, messages, userText, reply);
      }
      return reply;
    }

    if (!isUtteranceStale(session, utteranceId)) {
      appendTurnToSession(session, baseCount, messages, userText, cachedText);
    }
    return cachedText;
  }

  session.llmAbort = new AbortController();
  const llmSignal = session.llmAbort.signal;

  timing.llmStartAt = Date.now();
  let buffer = "";
  let agentText = "";
  const stream = llm.chatStream(messages, { systemPrompt, signal: llmSignal });
  let result = await stream.next();

  while (!result.done) {
    if (isUtteranceStale(session, utteranceId) || llmSignal.aborted) return agentText;
    buffer += String(result.value);
    const { sentences, remainder } = extractCompleteSentences(buffer);
    buffer = remainder;
    for (const sentence of sentences) {
      if (isUtteranceStale(session, utteranceId)) return agentText;
      timing.llmEndAt = Date.now();
      agentText += (agentText ? " " : "") + sentence;
      await speakResponse(session, sentence, { timing, skipTranscriptLog: true });
    }
    result = await stream.next();
  }

  if (isUtteranceStale(session, utteranceId)) return agentText;

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
    if (!isUtteranceStale(session, utteranceId)) {
      await speakResponse(session, filler, { skipTranscriptLog: true, modelId: TTS_FLASH_MODEL, timing });
    }

    timing.toolStartAt = Date.now();
    setSessionState(session, "tool_running");
    emitSessionEvent(session, {
      type: "tool_start",
      payload: { tools: turn.toolCalls.map((c) => c.name) },
    });

    let currentTurn = turn;
    let guard = 0;
    let reply = turn.text;

    while (currentTurn.toolCalls.length > 0 && guard < 6) {
      if (isUtteranceStale(session, utteranceId) || llmSignal.aborted) return agentText;
      guard += 1;
      const toolResults = await executeToolCalls(session, currentTurn.toolCalls);
      timing.toolEndAt = Date.now();

      messages.push({ role: "model", content: currentTurn.text, toolCalls: currentTurn.toolCalls });
      const followUp = await llm.continueWithToolResults(messages, toolResults, {
        systemPrompt,
        signal: llmSignal,
      });
      messages.push({ role: "user", toolResults });
      reply = followUp.text || reply;
      currentTurn = followUp;
    }

    if (!isUtteranceStale(session, utteranceId)) {
      await speakResponse(session, truncateToSpokenSentences(reply.trim()), { timing });
      appendTurnToSession(session, baseCount, messages, userText, reply);
    }
    return reply;
  }

  if (buffer.trim()) {
    agentText += (agentText ? " " : "") + buffer.trim();
    await speakResponse(session, truncateToSpokenSentences(buffer.trim()), { timing, skipTranscriptLog: true });
    buffer = "";
  }

  const finalText = truncateToSpokenSentences(agentText || turn.text);
  if (finalText) {
    if (!agentText) {
      await speakResponse(session, finalText, { timing });
    } else {
      await logCherryVoiceTranscript(session, "assistant", finalText);
      emitSessionEvent(session, { type: "assistant_text", payload: { text: finalText } });
    }
  }

  const reply = finalText || "Sorry, I couldn't complete that. Could you repeat?";
  if (!isUtteranceStale(session, utteranceId)) {
    appendTurnToSession(session, baseCount, messages, userText, reply);
  }
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

  const speakable = sanitizeTextForTts(trimmed);
  if (!speakable) return;

  session.activeSpeakCount += 1;
  session.ttsAbort = new AbortController();
  session.isSpeaking = true;
  session.sttUnblocked = false;
  session.speakingStartedAt = Date.now();
  setSessionState(session, "speaking");

  if (!options?.skipTranscriptLog) {
    emitSessionEvent(session, { type: "assistant_text", payload: { text: speakable } });
    await logCherryVoiceTranscript(session, "assistant", speakable);
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
    let audioChunks = await synthesizeWithRetries(session, speakable, options);

    if (audioChunks === 0 && !session.ttsAbort.signal.aborted) {
      session.ttsFailureCount += 1;
      const errMsg = "TTS returned no audio chunks";
      await logCherryVoiceTtsError(session, errMsg, speakable);
      emitSessionEvent(session, {
        type: "error",
        payload: { message: sanitizeVoiceError(errMsg), recoverable: true },
      });

      await emitTtsFallback(session, speakable, options?.timing);

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
      await logCherryVoiceTtsError(session, message, speakable);
      session.failed = true;
      emitSessionEvent(session, {
        type: "error",
        payload: { message: sanitizeVoiceError(message), recoverable: true },
      });
      await emitTtsFallback(session, speakable, options?.timing);
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
      session.sttUnblocked = false;
      session.halfDuplexOpenAt = Date.now() + HALF_DUPLEX_TAIL_MS;
      session.agentSpeechEndedAt = Date.now();
      if (session.state === "speaking" || session.state === "tool_running") {
        setSessionState(session, "listening");
      }
    }
  }
}

async function processUtterance(
  session: VoiceSessionRecord,
  utterance: string,
  utteranceId: number,
  sttConfidence?: number | null,
): Promise<void> {
  const text = utterance.trim();
  if (!text || text.length < MIN_UTTERANCE_CHARS) return;
  if (isUtteranceStale(session, utteranceId)) return;
  if (session.processing) {
    session.pendingUtterance = text;
    return;
  }

  session.processing = true;
  session.pendingUtterance = "";
  session.turnCount += 1;
  session.turnBargeIn = false;
  const timing = createTurnTiming(session.turnCount, Date.now());
  timing.llmStartAt = Date.now();
  setSessionState(session, "thinking");
  void speakThinkingFiller(session, utteranceId);

  session.sttConfidence = sttConfidence ?? null;
  session.lowConfidenceUtterance =
    sttConfidence != null && sttConfidence > 0 && sttConfidence < LOW_STT_CONFIDENCE;

  updateConversationMemoryFromUser(session, text);

  emitSessionEvent(session, {
    type: "transcript",
    payload: { text, isFinal: true, role: "user" },
  });
  await logCherryVoiceTranscript(session, "user", text);
  session.lastUserTranscriptAt = Date.now();

  let reply = "";
  let zeroAudio = false;
  let stale = false;
  try {
    reply = await streamLlmToSpeech(session, text, timing, utteranceId);
    stale = isUtteranceStale(session, utteranceId);
    zeroAudio =
      !stale &&
      timing.firstAudioAt == null &&
      !timing.audioFallbackEmitted &&
      !session.textOnlyMode;
  } catch (err) {
    stale = isUtteranceStale(session, utteranceId) || (err as Error).name === "AbortError";
    if (!stale) {
      session.failed = true;
      emitSessionEvent(session, {
        type: "error",
        payload: { message: sanitizeVoiceError((err as Error).message) },
      });
      setSessionState(session, "listening");
    }
  } finally {
    session.llmAbort = null;
    const staleNow = stale || isUtteranceStale(session, utteranceId);
    const metric = finalizeTurnMetric(timing, {
      zeroAudio,
      conf: sttConfidence ?? null,
      user: text,
      agent: staleNow ? "" : reply,
      bargeIn: session.turnBargeIn,
      staleUtteranceDiscarded: staleNow,
    });
    await logCherryVoiceTurnMetric(session, metric);
    session.processing = false;
    if (staleNow) {
      const pending = session.pendingUtterance.trim();
      if (pending && pending.length >= MIN_UTTERANCE_CHARS) {
        session.utteranceSeq += 1;
        session.latestUtteranceId = session.utteranceSeq;
        session.pendingUtterance = "";
        void processUtterance(session, pending, session.latestUtteranceId, session.sttConfidence);
      }
      return;
    }
    const queued = session.pendingUtterance.trim();
    session.pendingUtterance = "";
    if (queued && queued.length >= MIN_UTTERANCE_CHARS) {
      session.utteranceSeq += 1;
      session.latestUtteranceId = session.utteranceSeq;
      void processUtterance(session, queued, session.latestUtteranceId, session.sttConfidence);
    }
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

function forceMicResume(session: VoiceSessionRecord, reason: string): void {
  session.sttUnblocked = true;
  session.isSpeaking = false;
  session.halfDuplexOpenAt = 0;
  console.warn(`[cherry-voice] mic resume (${reason}) session=${session.id}`);
  if (session.state !== "ended") {
    setSessionState(session, "listening");
    emitSessionEvent(session, {
      type: "state",
      payload: { state: "listening", mic_resume: true },
    });
  }
}

function startMicWatchdog(session: VoiceSessionRecord): void {
  if (session.micWatchdogTimer) return;
  session.micWatchdogTimer = setInterval(() => {
    if (session.state !== "listening" || session.processing || session.isSpeaking) return;
    if (!session.agentSpeechEndedAt) return;
    const sinceAgentSpeech = Date.now() - session.agentSpeechEndedAt;
    if (sinceAgentSpeech < MIC_WATCHDOG_MS) return;
    const sinceUser = session.lastUserTranscriptAt
      ? Date.now() - session.lastUserTranscriptAt
      : sinceAgentSpeech;
    if (sinceUser < MIC_WATCHDOG_MS) return;
    forceMicResume(session, "no_user_transcript_10s");
  }, MIC_WATCHDOG_INTERVAL_MS);
}

function stopMicWatchdog(session: VoiceSessionRecord): void {
  if (session.micWatchdogTimer) {
    clearInterval(session.micWatchdogTimer);
    session.micWatchdogTimer = null;
  }
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
  let utteranceDeadlineTimer: ReturnType<typeof setTimeout> | null = null;
  let utteranceBurstStartedAt = 0;
  let lastConfidence: number | null = null;

  const clearUtteranceTimers = () => {
    if (utteranceTimer) {
      clearTimeout(utteranceTimer);
      utteranceTimer = null;
    }
    if (utteranceDeadlineTimer) {
      clearTimeout(utteranceDeadlineTimer);
      utteranceDeadlineTimer = null;
    }
    utteranceBurstStartedAt = 0;
  };

  const flushUtterance = () => {
    clearUtteranceTimers();
    const text = session.pendingUtterance.trim();
    if (!text || text.length < MIN_UTTERANCE_CHARS) return;

    const utteranceId = supersedeInFlightUtterance(session);
    session.pendingUtterance = "";
    void processUtterance(session, text, utteranceId, lastConfidence);
  };

  const scheduleUtterance = () => {
    const now = Date.now();
    if (!utteranceBurstStartedAt) utteranceBurstStartedAt = now;

    if (!utteranceDeadlineTimer) {
      utteranceDeadlineTimer = setTimeout(flushUtterance, UTTERANCE_MAX_WAIT_MS);
    }

    if (utteranceTimer) clearTimeout(utteranceTimer);
    const elapsed = now - utteranceBurstStartedAt;
    const delay =
      elapsed >= UTTERANCE_MAX_WAIT_MS ? 0 : Math.min(UTTERANCE_DEBOUNCE_MS, UTTERANCE_MAX_WAIT_MS - elapsed);
    utteranceTimer = setTimeout(flushUtterance, delay);
  };

  stt.onTranscript((event) => {
    if (shouldIgnoreSttEvent(session, event)) return;

    if (event.speechStarted) {
      if (session.isSpeaking) {
        maybeBargeInOnSpeechStart(session);
      }
      return;
    }

    if (event.utteranceEnd) {
      if (isTurnInputBlocked(session)) return;
      flushUtterance();
      return;
    }

    if (event.confidence != null) lastConfidence = event.confidence;

    if (!event.text) return;

    emitSessionEvent(session, {
      type: "transcript",
      payload: { text: event.text, isFinal: event.isFinal, role: "user" },
    });

    if (event.isFinal) {
      session.pendingUtterance = `${session.pendingUtterance} ${event.text}`.trim();
      if (session.isSpeaking) {
        maybeBargeIn(session, event.text, true, event.confidence);
      } else if (session.state === "thinking") {
        supersedeInFlightUtterance(session);
      }
      if (isTurnInputBlocked(session)) return;
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
  startMicWatchdog(session);

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
  const session = getVoiceSession(sessionId);
  if (session) {
    const now = Date.now();
    if (
      (session.isSpeaking || session.state === "tool_running") &&
      !session.sttUnblocked &&
      now < session.halfDuplexOpenAt
    ) {
      return;
    }
  }
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
    stopMicWatchdog(session);
    stopCallDurationMonitor(session);
    interruptSpeech(session);
    setSessionState(session, "ended");

    await sendPostCallOrderSms(session, session.postCallSmsEnabled);

    await finalizeCherryVoiceCallLog(session);
  }
}

export function interruptSession(sessionId: string): void {
  const session = getVoiceSession(sessionId);
  if (session) {
    recordBargeIn(session);
    cancelInFlightLlm(session);
    interruptSpeech(session);
  }
}

// Ensure flash model constant is referenced for tree-shaking of config
void getCherryVoiceTtsModel;
