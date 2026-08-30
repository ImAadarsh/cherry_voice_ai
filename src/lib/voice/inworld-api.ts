import "server-only";
import { getCherryVoiceTtsModel, getInworldApiKey } from "./config";

const INWORLD_API_BASE = "https://api.inworld.ai";

export type InworldVoice = {
  voiceId: string;
  displayName: string;
  description?: string;
  langCode: string;
  gender?: string;
  ageGroup?: string;
  source?: string;
  tags?: string[];
};

export type InworldVoiceGroup = {
  langCode: string;
  label: string;
  voices: InworldVoice[];
};

const LANG_LABELS: Record<string, string> = {
  EN_US: "English (US)",
  EN_GB: "English (UK)",
  EN_AU: "English (Australia)",
  EN_IN: "English (India)",
  ES_ES: "Spanish (Spain)",
  ES_MX: "Spanish (Mexico)",
  FR_FR: "French (France)",
  DE_DE: "German (Germany)",
  IT_IT: "Italian (Italy)",
  PT_BR: "Portuguese (Brazil)",
  PT_PT: "Portuguese (Portugal)",
  JA_JP: "Japanese (Japan)",
  KO_KR: "Korean (Korea)",
  ZH_CN: "Chinese (Mandarin)",
  HI_IN: "Hindi (India)",
  AR_SA: "Arabic (Saudi Arabia)",
  NL_NL: "Dutch (Netherlands)",
  PL_PL: "Polish (Poland)",
  RU_RU: "Russian (Russia)",
  TR_TR: "Turkish (Turkey)",
};

function langLabel(langCode: string): string {
  if (LANG_LABELS[langCode]) return LANG_LABELS[langCode];
  const parts = langCode.split("_");
  if (parts.length === 2) {
    return `${parts[0].toUpperCase()} (${parts[1].toUpperCase()})`;
  }
  return langCode.replace(/_/g, " ");
}

function mapVoice(raw: Record<string, unknown>): InworldVoice | null {
  const voiceId = String(raw.voiceId ?? raw.voice_id ?? "").trim();
  if (!voiceId) return null;
  return {
    voiceId,
    displayName: String(raw.displayName ?? raw.display_name ?? voiceId),
    description: raw.description ? String(raw.description) : undefined,
    langCode: String(raw.langCode ?? raw.lang_code ?? "EN_US"),
    gender: raw.gender ? String(raw.gender) : undefined,
    ageGroup: raw.ageGroup ? String(raw.ageGroup) : raw.age_group ? String(raw.age_group) : undefined,
    source: raw.source ? String(raw.source) : undefined,
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : undefined,
  };
}

/** Fetch all SYSTEM voices from Inworld (paginated). */
export async function listInworldVoices(langCode?: string): Promise<InworldVoice[]> {
  const apiKey = await getInworldApiKey();
  if (!apiKey) throw new Error("INWORLD_API_KEY is not configured");

  const voices: InworldVoice[] = [];
  let pageToken = "";

  do {
    const params = new URLSearchParams({
      filter: langCode
        ? `source = "SYSTEM" AND lang_code = "${langCode.replace(/_/g, "-").toLowerCase().split("-")[0]}"`
        : 'source = "SYSTEM"',
      orderBy: "display_name asc",
      pageSize: "500",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(`${INWORLD_API_BASE}/voices/v1/voices?${params}`, {
      headers: { Authorization: `Basic ${apiKey}` },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Inworld voices API error (${res.status}): ${errText.slice(0, 300)}`);
    }

    const data = (await res.json()) as {
      voices?: Array<Record<string, unknown>>;
      nextPageToken?: string;
    };

    for (const raw of data.voices ?? []) {
      const voice = mapVoice(raw);
      if (voice) voices.push(voice);
    }

    pageToken = data.nextPageToken ?? "";
  } while (pageToken);

  return voices;
}

/** Group voices by language for the voice picker UI. */
export function groupInworldVoicesByLanguage(voices: InworldVoice[]): InworldVoiceGroup[] {
  const byLang = new Map<string, InworldVoice[]>();

  for (const voice of voices) {
    const list = byLang.get(voice.langCode) ?? [];
    list.push(voice);
    byLang.set(voice.langCode, list);
  }

  return Array.from(byLang.entries())
    .map(([langCode, langVoices]) => ({
      langCode,
      label: langLabel(langCode),
      voices: langVoices.sort((a, b) => a.displayName.localeCompare(b.displayName)),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

const PREVIEW_TEXT = "Hello! Thanks for calling. How can I help you today?";

/** Synthesize a short voice preview and return base64 MP3 audio. */
export async function synthesizeInworldPreview(voiceId: string, text = PREVIEW_TEXT): Promise<string> {
  const apiKey = await getInworldApiKey();
  if (!apiKey) throw new Error("INWORLD_API_KEY is not configured");

  const modelId = await getCherryVoiceTtsModel();
  const res = await fetch(`${INWORLD_API_BASE}/tts/v1/voice`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      voiceId,
      modelId,
      audioConfig: {
        audioEncoding: "MP3",
        sampleRateHertz: 24000,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Inworld TTS preview error (${res.status}): ${errText.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    audioContent?: string;
    result?: { audioContent?: string };
  };

  const audioContent = data.audioContent ?? data.result?.audioContent;
  if (!audioContent) throw new Error("Inworld TTS returned no audio");
  return audioContent;
}
