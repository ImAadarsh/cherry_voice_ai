import "server-only";
import type { TtsProvider, TtsSynthesisOptions } from "./types";
import { getCherryVoiceTtsModel, getInworldApiKey } from "../config";
import { sanitizeTextForTts } from "../tts-sanitize";
import { stripWavHeader } from "../wav-utils";

const TTS_STREAM_TIMEOUT_MS = 45_000;

function parseNdjsonLine(trimmed: string): {
  audioB64?: string;
  error?: string;
} {
  const line = trimmed.startsWith("data:") ? trimmed.slice(5).trim() : trimmed;
  if (!line) return {};

  try {
    const json = JSON.parse(line) as {
      result?: { audioContent?: string };
      audioContent?: string;
      error?: { message?: string };
    };
    if (json.error?.message) return { error: json.error.message };
    const audioB64 = json.result?.audioContent ?? json.audioContent;
    return audioB64 ? { audioB64 } : {};
  } catch (err) {
    if (err instanceof SyntaxError) return {};
    throw err;
  }
}

export function createInworldTtsProvider(): TtsProvider {
  return {
    async synthesize(options: TtsSynthesisOptions) {
      const apiKey = await getInworldApiKey();
      if (!apiKey) throw new Error("INWORLD_API_KEY is not configured");

      const text = sanitizeTextForTts(options.text);
      if (!text) return;

      const modelId = options.modelId ?? (await getCherryVoiceTtsModel());
      const timeoutSignal = AbortSignal.timeout(TTS_STREAM_TIMEOUT_MS);
      const signal = options.signal
        ? AbortSignal.any([options.signal, timeoutSignal])
        : timeoutSignal;

      const res = await fetch("https://api.inworld.ai/tts/v1/voice:stream", {
        method: "POST",
        headers: {
          Authorization: `Basic ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          voiceId: options.voiceId,
          modelId,
          audioConfig: {
            audioEncoding: "PCM",
            sampleRateHertz: 24000,
          },
        }),
        signal,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Inworld TTS error (${res.status}): ${errText.slice(0, 300)}`);
      }

      if (!res.body) throw new Error("Inworld TTS returned empty body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let firstChunkSent = false;
      let chunksEmitted = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (options.signal?.aborted) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          const parsed = parseNdjsonLine(trimmed);
          if (parsed.error) throw new Error(parsed.error);
          if (!parsed.audioB64) continue;

          const raw = Buffer.from(parsed.audioB64, "base64");
          if (raw.length === 0) continue;

          const pcm = stripWavHeader(raw);
          if (pcm.length > 0) {
            chunksEmitted += 1;
            if (!firstChunkSent) {
              firstChunkSent = true;
              options.onFirstChunk?.();
            }
            options.onAudioChunk?.(pcm);
          }
        }
      }

      const tail = buffer.trim();
      if (tail && !options.signal?.aborted) {
        const parsed = parseNdjsonLine(tail);
        if (parsed.error) throw new Error(parsed.error);
        if (parsed.audioB64) {
          const raw = Buffer.from(parsed.audioB64, "base64");
          const pcm = stripWavHeader(raw);
          if (pcm.length > 0) {
            chunksEmitted += 1;
            if (!firstChunkSent) {
              firstChunkSent = true;
              options.onFirstChunk?.();
            }
            options.onAudioChunk?.(pcm);
          }
        }
      }

      if (chunksEmitted === 0 && !options.signal?.aborted) {
        throw new Error("Inworld TTS returned no audio chunks");
      }
    },
  };
}
