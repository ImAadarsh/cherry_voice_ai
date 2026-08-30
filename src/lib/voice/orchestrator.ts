import "server-only";
import { INTEGRATION_TOOLS_PROMPT, VOICE_STYLE_PROMPT } from "@/lib/integration-tools";
import { getAgentContext } from "@/lib/repositories/onboarding";
import { getRestaurant } from "@/lib/repositories/settings";
import {
  finalizeCherryVoiceCallLog,
  initCherryVoiceCallLog,
  logCherryVoiceToolCall,
  logCherryVoiceTranscript,
  logCherryVoiceTtsError,
} from "./call-log";
import {
  getSilencePromptPhrase,
  getToolFillerPhrase,
  getTtsFallbackPhrase,
} from "./filler-phrases";
import { createDeepgramSttProvider } from "./providers/deepgram-stt";
import { createGeminiLlmProvider } from "./providers/gemini-llm";
import { createInworldTtsProvider } from "./providers/inworld-tts";
import type { LlmMessage } from "./providers/types";
import {
  emitSessionEvent,
  getVoiceSession,
  interruptSpeech,
  setSessionState,
  type VoiceSessionRecord,
} from "./session-store";
import { executeCherryVoiceTool } from "./tools";

const sttBySession = new Map<string, ReturnType<typeof createDeepgramSttProvider>>();
const llm = createGeminiLlmProvider();
const tts = createInworldTtsProvider();

const SILENCE_CHECK_MS = 10_000;
const SILENCE_PROMPT_AFTER_MS = 45_000;

async function buildSystemPrompt(session: VoiceSessionRecord): Promise<string> {
  const [restaurant, context] = await Promise.all([
    getRestaurant(session.restaurantId),
    getAgentContext(session.restaurantId),
  ]);

  const parts = [
    `You are the voice assistant for ${restaurant?.name ?? "this restaurant"}.`,
    "You help customers place orders, make reservations, and answer questions.",
    VOICE_STYLE_PROMPT,
    INTEGRATION_TOOLS_PROMPT,
  ];

  if (session.orderId) {
    parts.push(
      `## Active order for this call\nOrder id ${session.orderId} is already placed for this conversation. Use update_order to change name, phone, address, items, or notes — never call create_order again.`,
    );
  }

  if (context?.generated_prompt) {
    parts.push(`## Restaurant context\n${context.generated_prompt}`);
  }

  return parts.join("\n\n");
}

async function runLlmTurn(session: VoiceSessionRecord, userText: string): Promise<string> {
  const systemPrompt = await buildSystemPrompt(session);
  const messages: LlmMessage[] = [
    ...session.messages.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: userText },
  ];

  let turn = await llm.chat(messages, { systemPrompt });
  let guard = 0;

  while (turn.toolCalls.length > 0 && guard < 6) {
    guard += 1;

    const filler = await getToolFillerPhrase(
      session.restaurantId,
      turn.toolCalls.map((c) => c.name),
    );
    await speakResponse(session, filler, { skipTranscriptLog: true });

    const toolResults = await Promise.all(
      turn.toolCalls.map(async (call) => {
        const result = await executeCherryVoiceTool(session.restaurantId, call.name, call.args, session);
        await logCherryVoiceToolCall(session, call.name, call.args, result);
        return {
          name: call.name,
          result,
        };
      }),
    );

    messages.push({
      role: "model",
      content: turn.text,
      toolCalls: turn.toolCalls,
    });
    turn = await llm.continueWithToolResults(messages, toolResults, { systemPrompt });
  }

  return turn.text || "Sorry, I couldn't complete that. Could you repeat?";
}

async function synthesizeWithChunks(
  session: VoiceSessionRecord,
  text: string,
): Promise<number> {
  let audioChunks = 0;
  await tts.synthesize({
    voiceId: session.voiceId,
    text,
    signal: session.ttsAbort?.signal,
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

async function speakResponse(
  session: VoiceSessionRecord,
  text: string,
  options?: { skipTranscriptLog?: boolean },
): Promise<void> {
  if (!text.trim() || session.state === "ended") return;

  interruptSpeech(session);
  session.ttsAbort = new AbortController();
  session.isSpeaking = true;
  setSessionState(session, "speaking");

  emitSessionEvent(session, {
    type: "assistant_text",
    payload: { text },
  });

  if (!options?.skipTranscriptLog) {
    await logCherryVoiceTranscript(session, "assistant", text);
  }

  try {
    let audioChunks = await synthesizeWithChunks(session, text);

    if (audioChunks === 0 && !session.ttsAbort.signal.aborted) {
      audioChunks = await synthesizeWithChunks(session, text);
    }

    if (audioChunks === 0 && !session.ttsAbort.signal.aborted) {
      const errMsg = "TTS returned no audio chunks";
      await logCherryVoiceTtsError(session, errMsg, text);
      emitSessionEvent(session, {
        type: "error",
        payload: { message: errMsg, recoverable: true },
      });

      const fallback = await getTtsFallbackPhrase(session.restaurantId);
      audioChunks = await synthesizeWithChunks(session, fallback);
      if (audioChunks > 0) {
        emitSessionEvent(session, {
          type: "assistant_text",
          payload: { text: fallback },
        });
        await logCherryVoiceTranscript(session, "assistant", fallback);
      }
    }
  } catch (err) {
    if ((err as Error).name !== "AbortError") {
      let recovered = false;
      try {
        const retryChunks = await synthesizeWithChunks(session, text);
        recovered = retryChunks > 0;
      } catch {
        /* retry failed */
      }

      if (!recovered) {
        const message = (err as Error).message;
        await logCherryVoiceTtsError(session, message, text);
        session.failed = true;
        emitSessionEvent(session, {
          type: "error",
          payload: { message, recoverable: true },
        });

        try {
          const fallback = await getTtsFallbackPhrase(session.restaurantId);
          const fallbackChunks = await synthesizeWithChunks(session, fallback);
          if (fallbackChunks > 0) {
            emitSessionEvent(session, {
              type: "assistant_text",
              payload: { text: fallback },
            });
            await logCherryVoiceTranscript(session, "assistant", fallback);
          }
        } catch {
          /* best-effort fallback */
        }
      }
    }
  } finally {
    session.isSpeaking = false;
    session.ttsAbort = null;
    if (session.state === "speaking") {
      setSessionState(session, "listening");
    }
  }
}

async function processUtterance(session: VoiceSessionRecord, utterance: string): Promise<void> {
  const text = utterance.trim();
  if (!text || session.processing) return;

  session.processing = true;
  session.pendingUtterance = "";
  setSessionState(session, "thinking");

  emitSessionEvent(session, {
    type: "transcript",
    payload: { text, isFinal: true, role: "user" },
  });
  await logCherryVoiceTranscript(session, "user", text);

  try {
    const reply = await runLlmTurn(session, text);
    session.messages.push({ role: "user", content: text });
    session.messages.push({ role: "model", content: reply });
    await speakResponse(session, reply);
  } catch (err) {
    session.failed = true;
    emitSessionEvent(session, {
      type: "error",
      payload: { message: (err as Error).message },
    });
    setSessionState(session, "listening");
  } finally {
    session.processing = false;
    const queued = session.pendingUtterance.trim();
    session.pendingUtterance = "";
    if (queued) void processUtterance(session, queued);
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

  await initCherryVoiceCallLog(session);

  const stt = createDeepgramSttProvider();
  sttBySession.set(sessionId, stt);

  let utteranceTimer: ReturnType<typeof setTimeout> | null = null;

  const scheduleUtterance = () => {
    if (utteranceTimer) clearTimeout(utteranceTimer);
    utteranceTimer = setTimeout(() => {
      const text = session.pendingUtterance.trim();
      if (text && !session.processing) void processUtterance(session, text);
    }, 800);
  };

  stt.onTranscript((event) => {
    if (event.speechStarted && session.isSpeaking) {
      interruptSpeech(session);
    }

    if (!event.text) return;

    emitSessionEvent(session, {
      type: "transcript",
      payload: { text: event.text, isFinal: event.isFinal, role: "user" },
    });

    if (event.isFinal) {
      session.pendingUtterance = `${session.pendingUtterance} ${event.text}`.trim();
      scheduleUtterance();
    } else if (session.isSpeaking) {
      interruptSpeech(session);
    }
  });

  stt.onError((err) => {
    session.failed = true;
    emitSessionEvent(session, { type: "error", payload: { message: err.message } });
  });

  await stt.connect();
  setSessionState(session, "listening");
  startSilenceMonitor(session);

  if (session.greeting) {
    emitSessionEvent(session, { type: "greeting", payload: { text: session.greeting } });
    void speakResponse(session, session.greeting);
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
    interruptSpeech(session);
    setSessionState(session, "ended");
    await finalizeCherryVoiceCallLog(session);
  }
}

export function interruptSession(sessionId: string): void {
  const session = getVoiceSession(sessionId);
  if (session) interruptSpeech(session);
}
