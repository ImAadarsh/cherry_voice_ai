import "server-only";
import { INTEGRATION_TOOLS_PROMPT, VOICE_STYLE_PROMPT } from "@/lib/integration-tools";
import { getAgentContext } from "@/lib/repositories/onboarding";
import { getRestaurant } from "@/lib/repositories/settings";
import {
  finalizeCherryVoiceCallLog,
  initCherryVoiceCallLog,
  logCherryVoiceToolCall,
  logCherryVoiceTranscript,
} from "./call-log";
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

async function speakResponse(session: VoiceSessionRecord, text: string): Promise<void> {
  if (!text.trim()) return;

  interruptSpeech(session);
  session.ttsAbort = new AbortController();
  session.isSpeaking = true;
  setSessionState(session, "speaking");

  emitSessionEvent(session, {
    type: "assistant_text",
    payload: { text },
  });
  await logCherryVoiceTranscript(session, "assistant", text);

  try {
    await tts.synthesize({
      voiceId: session.voiceId,
      text,
      signal: session.ttsAbort.signal,
      onAudioChunk: (pcm) => {
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
  } catch (err) {
    if ((err as Error).name !== "AbortError") {
      session.failed = true;
      emitSessionEvent(session, {
        type: "error",
        payload: { message: (err as Error).message },
      });
    }
  } finally {
    session.isSpeaking = false;
    session.ttsAbort = null;
    if (session.state !== "ended") {
      setSessionState(session, "listening");
    }
  }
}

async function processUtterance(session: VoiceSessionRecord, utterance: string): Promise<void> {
  const text = utterance.trim();
  if (!text || session.processing) return;

  session.processing = true;
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
    session.pendingUtterance = "";
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
      if (text) void processUtterance(session, text);
    }, 800);
  };

  stt.onTranscript((event) => {
    if (event.speechStarted && session.isSpeaking) {
      interruptSpeech(session);
      emitSessionEvent(session, { type: "state", payload: { interrupted: true } });
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
    interruptSpeech(session);
    setSessionState(session, "ended");
    await finalizeCherryVoiceCallLog(session);
  }
}

export function interruptSession(sessionId: string): void {
  const session = getVoiceSession(sessionId);
  if (session) interruptSpeech(session);
}
