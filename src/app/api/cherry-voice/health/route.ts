import { GoogleGenerativeAI } from "@google/generative-ai";
import { ok } from "@/lib/http";
import { handleRouteError } from "@/lib/api-error";
import { requireRestaurantId } from "@/lib/route-auth";
import {
  getCherryVoiceGeminiModel,
  getCherryVoiceSttModel,
  getCherryVoiceTtsModel,
  getDeepgramApiKey,
  getInworldApiKey,
} from "@/lib/voice/config";
import { getGeminiApiKey } from "@/lib/platform-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProviderStatus = {
  configured: boolean;
  ok: boolean;
  latency_ms?: number;
  error?: string;
};

async function checkDeepgram(apiKey: string): Promise<ProviderStatus> {
  if (!apiKey) return { configured: false, ok: false, error: "DEEPGRAM_API_KEY missing" };
  const start = Date.now();
  try {
    const res = await fetch("https://api.deepgram.com/v1/projects", {
      headers: { Authorization: `Token ${apiKey}` },
      signal: AbortSignal.timeout(8_000),
    });
    return {
      configured: true,
      ok: res.ok,
      latency_ms: Date.now() - start,
      ...(res.ok ? {} : { error: `HTTP ${res.status}` }),
    };
  } catch (err) {
    return {
      configured: true,
      ok: false,
      latency_ms: Date.now() - start,
      error: (err as Error).message,
    };
  }
}

async function checkInworld(apiKey: string): Promise<ProviderStatus> {
  if (!apiKey) return { configured: false, ok: false, error: "INWORLD_API_KEY missing" };
  const start = Date.now();
  const modelId = await getCherryVoiceTtsModel();
  try {
    const res = await fetch("https://api.inworld.ai/tts/v1/voice:stream", {
      method: "POST",
      headers: {
        Authorization: `Basic ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: "ok",
        voiceId: "Ashley",
        modelId,
        audioConfig: { audioEncoding: "PCM", sampleRateHertz: 24000 },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    return {
      configured: true,
      ok: res.ok,
      latency_ms: Date.now() - start,
      ...(res.ok ? {} : { error: `HTTP ${res.status}` }),
    };
  } catch (err) {
    return {
      configured: true,
      ok: false,
      latency_ms: Date.now() - start,
      error: (err as Error).message,
    };
  }
}

async function checkGemini(apiKey: string): Promise<ProviderStatus> {
  if (!apiKey) return { configured: false, ok: false, error: "GEMINI_API_KEY missing" };
  const start = Date.now();
  try {
    const modelName = await getCherryVoiceGeminiModel();
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName });
    await model.generateContent(
      { contents: [{ role: "user", parts: [{ text: "ping" }] }] },
      { signal: AbortSignal.timeout(10_000) },
    );
    return { configured: true, ok: true, latency_ms: Date.now() - start };
  } catch (err) {
    return {
      configured: true,
      ok: false,
      latency_ms: Date.now() - start,
      error: (err as Error).message.slice(0, 200),
    };
  }
}

/** GET /api/cherry-voice/health — verify Deepgram, Inworld, and Gemini keys */
export async function GET(req: Request) {
  try {
    const restaurantId = await requireRestaurantId(req);
    if (restaurantId instanceof Response) return restaurantId;

    const [deepgramKey, inworldKey, geminiKey] = await Promise.all([
      getDeepgramApiKey(),
      getInworldApiKey(),
      getGeminiApiKey(),
    ]);

    const [deepgram, inworld, gemini] = await Promise.all([
      checkDeepgram(deepgramKey),
      checkInworld(inworldKey),
      checkGemini(geminiKey),
    ]);

    const sttModel = await getCherryVoiceSttModel();
    const ttsModel = await getCherryVoiceTtsModel();
    const llmModel = await getCherryVoiceGeminiModel();
    const allOk = deepgram.ok && inworld.ok && gemini.ok;

    return ok({
      status: allOk ? "healthy" : "degraded",
      providers: {
        deepgram: { ...deepgram, model: sttModel },
        inworld: { ...inworld, model: ttsModel },
        gemini: { ...gemini, model: llmModel },
      },
      time: new Date().toISOString(),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
