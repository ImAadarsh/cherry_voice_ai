import "server-only";
import type { SttProvider, SttTranscriptEvent } from "./types";
import { getDeepgramEndpointing } from "../deepgram-locale";
import { getDeepgramApiKey } from "../config";

type DeepgramMessage = {
  type?: string;
  channel?: { alternatives?: Array<{ transcript?: string; confidence?: number }> };
  is_final?: boolean;
  speech_final?: boolean;
};

const MAX_RECONNECTS = 3;
const KEEPALIVE_INTERVAL_MS = 8_000;

export function createDeepgramSttProvider(options?: {
  language?: string;
  sampleRate?: number;
}): SttProvider {
  const endpointing = getDeepgramEndpointing(options?.language);
  const language = options?.language ?? endpointing.language;
  const sampleRate = options?.sampleRate ?? 16000;

  let ws: WebSocket | null = null;
  let transcriptHandler: ((event: SttTranscriptEvent) => void) | null = null;
  let errorHandler: ((error: Error) => void) | null = null;
  let disconnectHandler: (() => void) | null = null;
  let closed = false;
  let reconnects = 0;
  let keepaliveTimer: ReturnType<typeof setInterval> | null = null;

  const clearKeepalive = () => {
    if (keepaliveTimer) {
      clearInterval(keepaliveTimer);
      keepaliveTimer = null;
    }
  };

  const startKeepalive = () => {
    clearKeepalive();
    keepaliveTimer = setInterval(() => {
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      try {
        ws.send(JSON.stringify({ type: "KeepAlive" }));
      } catch {
        /* socket may be closing */
      }
    }, KEEPALIVE_INTERVAL_MS);
  };

  const emitError = (err: Error) => {
    errorHandler?.(err);
  };

  const bindSocket = (socket: WebSocket) => {
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(String(event.data)) as DeepgramMessage;
        if (data.type === "SpeechStarted") {
          transcriptHandler?.({ text: "", isFinal: false, speechStarted: true });
          return;
        }
        if (data.type === "UtteranceEnd") {
          transcriptHandler?.({ text: "", isFinal: false, utteranceEnd: true });
          return;
        }
        if (data.type !== "Results") return;

        const alt = data.channel?.alternatives?.[0];
        const text = alt?.transcript?.trim() ?? "";
        if (!text) return;

        transcriptHandler?.({
          text,
          isFinal: Boolean(data.is_final || data.speech_final),
          confidence: alt?.confidence ?? null,
        });
      } catch (err) {
        emitError(err instanceof Error ? err : new Error(String(err)));
      }
    };

    socket.onerror = () => emitError(new Error("Deepgram connection error"));

    socket.onclose = () => {
      clearKeepalive();
      if (closed) return;

      if (reconnects < MAX_RECONNECTS) {
        reconnects += 1;
        void openSocket().catch((err) => {
          emitError(err instanceof Error ? err : new Error(String(err)));
        });
        return;
      }

      disconnectHandler?.();
      emitError(new Error("Deepgram connection closed"));
    };
  };

  const openSocket = async (): Promise<void> => {
    const apiKey = await getDeepgramApiKey();
    if (!apiKey) throw new Error("DEEPGRAM_API_KEY is not configured");

    // Nova-3 streaming via /v1/listen — minimal features for lowest latency.
    const params = new URLSearchParams({
      model: "nova-3",
      language,
      encoding: "linear16",
      sample_rate: String(sampleRate),
      channels: "1",
      interim_results: "true",
      interim_results_speed: "true",
      utterance_end_ms: endpointing.utterance_end_ms,
      endpointing: endpointing.endpointing,
      vad_events: "true",
      punctuate: "false",
      smart_format: "false",
      diarize: "false",
    });

    ws = new WebSocket(`wss://api.deepgram.com/v1/listen?${params}`, ["token", apiKey]);

    await new Promise<void>((resolve, reject) => {
      if (!ws) return reject(new Error("WebSocket not initialized"));
      ws.onopen = () => {
        reconnects = 0;
        startKeepalive();
        resolve();
      };
      ws.onerror = () => reject(new Error("Deepgram connection failed"));
      bindSocket(ws);
    });
  };

  return {
    async connect() {
      closed = false;
      await openSocket();
    },

    sendAudio(chunk: Buffer) {
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      ws.send(chunk);
    },

    onTranscript(handler) {
      transcriptHandler = handler;
    },

    onError(handler) {
      errorHandler = handler;
    },

    onDisconnect(handler) {
      disconnectHandler = handler;
    },

    close() {
      closed = true;
      clearKeepalive();
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "CloseStream" }));
        ws.close();
      }
      ws = null;
    },
  };
}
