import "server-only";
import type { SttProvider, SttTranscriptEvent } from "./types";
import { getCherryVoiceSttModel, getDeepgramApiKey } from "../config";

type DeepgramMessage = {
  type?: string;
  channel?: { alternatives?: Array<{ transcript?: string }> };
  is_final?: boolean;
  speech_final?: boolean;
};

export function createDeepgramSttProvider(options?: {
  language?: string;
  sampleRate?: number;
}): SttProvider {
  const language = options?.language ?? "en-US";
  const sampleRate = options?.sampleRate ?? 16000;

  let ws: WebSocket | null = null;
  let transcriptHandler: ((event: SttTranscriptEvent) => void) | null = null;
  let errorHandler: ((error: Error) => void) | null = null;
  let closed = false;

  const emitError = (err: Error) => {
    errorHandler?.(err);
  };

  return {
    async connect() {
      const apiKey = await getDeepgramApiKey();
      if (!apiKey) throw new Error("DEEPGRAM_API_KEY is not configured");

      const model = await getCherryVoiceSttModel();
      const params = new URLSearchParams({
        model,
        language,
        encoding: "linear16",
        sample_rate: String(sampleRate),
        channels: "1",
        interim_results: "true",
        utterance_end_ms: "1000",
        endpointing: "400",
        vad_events: "true",
        punctuate: "true",
        smart_format: "true",
      });

      ws = new WebSocket(`wss://api.deepgram.com/v1/listen?${params}`, [
        "token",
        apiKey,
      ]);

      await new Promise<void>((resolve, reject) => {
        if (!ws) return reject(new Error("WebSocket not initialized"));

        ws.onopen = () => resolve();
        ws.onerror = () => reject(new Error("Deepgram connection failed"));
        ws.onclose = () => {
          if (!closed) emitError(new Error("Deepgram connection closed"));
        };
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(String(event.data)) as DeepgramMessage;
            if (data.type === "SpeechStarted") {
              transcriptHandler?.({ text: "", isFinal: false, speechStarted: true });
              return;
            }
            if (data.type !== "Results") return;

            const text = data.channel?.alternatives?.[0]?.transcript?.trim() ?? "";
            if (!text) return;

            transcriptHandler?.({
              text,
              isFinal: Boolean(data.is_final || data.speech_final),
            });
          } catch (err) {
            emitError(err instanceof Error ? err : new Error(String(err)));
          }
        };
      });
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

    close() {
      closed = true;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "CloseStream" }));
        ws.close();
      }
      ws = null;
    },
  };
}
