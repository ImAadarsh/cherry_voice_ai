import "server-only";
import type { TtsProvider, TtsSynthesisOptions } from "./types";
import { getCherryVoiceTtsModel, getInworldApiKey } from "../config";

export function createInworldTtsProvider(): TtsProvider {
  return {
    async synthesize(options: TtsSynthesisOptions) {
      const apiKey = await getInworldApiKey();
      if (!apiKey) throw new Error("INWORLD_API_KEY is not configured");

      const modelId = await getCherryVoiceTtsModel();
      const res = await fetch("https://api.inworld.ai/tts/v1/voice:stream", {
        method: "POST",
        headers: {
          Authorization: `Basic ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: options.text,
          voiceId: options.voiceId,
          modelId,
          audioConfig: {
            audioEncoding: "PCM",
            sampleRateHertz: 24000,
          },
        }),
        signal: options.signal,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Inworld TTS error (${res.status}): ${errText.slice(0, 300)}`);
      }

      if (!res.body) throw new Error("Inworld TTS returned empty body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

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
          try {
            const json = JSON.parse(trimmed) as {
              result?: { audioContent?: string };
              error?: { message?: string };
            };
            if (json.error?.message) {
              throw new Error(json.error.message);
            }
            const audioB64 = json.result?.audioContent;
            if (audioB64) {
              options.onAudioChunk?.(Buffer.from(audioB64, "base64"));
            }
          } catch (err) {
            if (err instanceof SyntaxError) continue;
            throw err;
          }
        }
      }
    },
  };
}
