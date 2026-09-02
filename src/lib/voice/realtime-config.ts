import "server-only";
import { env } from "@/lib/env";
import { getPlatformSetting } from "@/lib/repositories/platform-settings";
import { getInworldApiKey, getCherryVoiceRealtimeTtsModel, getCherryVoiceRealtimeToolsEnabled } from "./config";
import { CHERRY_VOICE_REALTIME_TOOLS } from "./realtime-tools";
import type { VoiceSessionRecord } from "./session-store";

export type CherryVoiceMode = "inworld_realtime" | "pipeline";

const INWORLD_REALTIME_BASE = "https://api.inworld.ai";

export async function getCherryVoiceMode(): Promise<CherryVoiceMode> {
  const fromDb = await getPlatformSetting<string>("cherry_voice_mode");
  const raw = (fromDb?.trim() || env.CHERRY_VOICE_MODE || "inworld_realtime").trim().toLowerCase();
  return raw === "pipeline" ? "pipeline" : "inworld_realtime";
}

export async function getInworldRealtimeModel(): Promise<string> {
  const fromDb = await getPlatformSetting<string>("inworld_realtime_model");
  return (
    fromDb?.trim() ||
    env.INWORLD_REALTIME_MODEL ||
    "openai/gpt-4o-mini"
  ).trim();
}

export type IceServerConfig = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

export async function fetchInworldIceServers(): Promise<IceServerConfig[]> {
  const apiKey = await getInworldApiKey();
  if (!apiKey) return [];

  try {
    const res = await fetch(`${INWORLD_REALTIME_BASE}/v1/realtime/ice-servers`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { ice_servers?: IceServerConfig[] };
    return body.ice_servers ?? [];
  } catch {
    return [];
  }
}

export type RealtimeSessionConfig = {
  type: "realtime";
  model: string;
  instructions: string;
  output_modalities: Array<"audio" | "text">;
  audio: {
    input: {
      transcription?: {
        model: string;
        language?: string;
      };
      turn_detection: {
        type: "semantic_vad";
        eagerness: "medium";
        create_response: boolean;
        interrupt_response: boolean;
      };
    };
    output: {
      voice: string;
      model: string;
      speed: number;
    };
  };
  tools?: typeof CHERRY_VOICE_REALTIME_TOOLS;
  tool_choice?: "auto";
  providerData: {
    auto_tool_response: boolean;
    stt: {
      voice_profile: boolean;
      language_hints: string[];
    };
    backchannel: { enabled: boolean };
    responsiveness: { enabled: boolean };
  };
};

export async function buildRealtimeSessionConfig(
  session: VoiceSessionRecord,
  instructions: string,
): Promise<RealtimeSessionConfig> {
  const [model, ttsModel, toolsEnabled] = await Promise.all([
    getInworldRealtimeModel(),
    getCherryVoiceRealtimeTtsModel(),
    getCherryVoiceRealtimeToolsEnabled(),
  ]);
  const locale = session.sttLocale || "en-US";

  const config: RealtimeSessionConfig = {
    type: "realtime",
    model,
    instructions,
    output_modalities: ["audio", "text"],
    audio: {
      input: {
        transcription: {
          model: "inworld/inworld-stt-1",
          language: locale,
        },
        turn_detection: {
          type: "semantic_vad",
          eagerness: "medium",
          create_response: true,
          interrupt_response: true,
        },
      },
      output: {
        voice: session.voiceId,
        model: ttsModel,
        speed: 1.0,
      },
    },
    providerData: {
      auto_tool_response: false,
      stt: {
        voice_profile: true,
        language_hints: [locale],
      },
      backchannel: { enabled: true },
      responsiveness: { enabled: true },
    },
  };

  if (toolsEnabled) {
    config.tools = CHERRY_VOICE_REALTIME_TOOLS;
    config.tool_choice = "auto";
  }

  return config;
}

export async function proxyInworldSdpOffer(
  sdp: string,
  sessionConfig?: RealtimeSessionConfig,
): Promise<{ ok: true; answerSdp: string } | { ok: false; error: string; status: number }> {
  const apiKey = await getInworldApiKey();
  if (!apiKey) {
    return { ok: false, error: "INWORLD_API_KEY missing", status: 503 };
  }

  const body = sessionConfig ? JSON.stringify({ sdp, session: sessionConfig }) : sdp;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
  };
  if (sessionConfig) {
    headers["Content-Type"] = "application/json";
  } else {
    headers["Content-Type"] = "application/sdp";
  }

  try {
    const res = await fetch(`${INWORLD_REALTIME_BASE}/v1/realtime/calls`, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[Cherry Voice Realtime] Inworld SDP exchange failed:", res.status, text.slice(0, 500));
      return {
        ok: false,
        error: text.slice(0, 300) || `Inworld SDP exchange failed (${res.status})`,
        status: res.status,
      };
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const json = (await res.json()) as { sdp?: string };
      if (!json.sdp) {
        return { ok: false, error: "Missing SDP answer from Inworld", status: 502 };
      }
      return { ok: true, answerSdp: json.sdp };
    }

    const answerSdp = await res.text();
    if (!answerSdp.trim()) {
      return { ok: false, error: "Empty SDP answer from Inworld", status: 502 };
    }
    return { ok: true, answerSdp };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      status: 502,
    };
  }
}

export async function checkInworldRealtimeHealth(): Promise<{
  configured: boolean;
  ok: boolean;
  latency_ms?: number;
  error?: string;
  model?: string;
}> {
  const apiKey = await getInworldApiKey();
  if (!apiKey) {
    return { configured: false, ok: false, error: "INWORLD_API_KEY missing" };
  }

  const start = Date.now();
  const model = await getInworldRealtimeModel();

  try {
    const res = await fetch(`${INWORLD_REALTIME_BASE}/v1/realtime/ice-servers`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(8_000),
    });
    return {
      configured: true,
      ok: res.ok,
      latency_ms: Date.now() - start,
      model,
      ...(res.ok ? {} : { error: `HTTP ${res.status}` }),
    };
  } catch (err) {
    return {
      configured: true,
      ok: false,
      latency_ms: Date.now() - start,
      model,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function getInworldRealtimeCallsUrl(): string {
  return `${INWORLD_REALTIME_BASE}/v1/realtime/calls`;
}
