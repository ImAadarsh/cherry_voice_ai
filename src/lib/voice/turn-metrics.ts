import type { TurnMetricEntry } from "@/lib/repositories/calls";

export type TurnMetric = TurnMetricEntry;

export type TurnTiming = {
  turn: number;
  sttFinalAt: number;
  llmStartAt: number;
  llmEndAt: number;
  toolStartAt: number;
  toolEndAt: number;
  ttsStartAt: number;
  firstAudioAt: number | null;
  audioFallbackEmitted?: boolean;
};

export function createTurnTiming(turn: number, sttFinalAt: number): TurnTiming {
  return {
    turn,
    sttFinalAt,
    llmStartAt: 0,
    llmEndAt: 0,
    toolStartAt: 0,
    toolEndAt: 0,
    ttsStartAt: 0,
    firstAudioAt: null,
  };
}

export function finalizeTurnMetric(
  timing: TurnTiming,
  extra?: {
    zeroAudio?: boolean;
    bargeIn?: boolean;
    conf?: number | null;
    user?: string;
    agent?: string;
  },
): TurnMetricEntry {
  const now = Date.now();
  return {
    turn: timing.turn,
    stt_ms: timing.llmStartAt ? timing.llmStartAt - timing.sttFinalAt : 0,
    llm_ms: timing.llmEndAt && timing.llmStartAt ? timing.llmEndAt - timing.llmStartAt : 0,
    tool_ms: timing.toolEndAt && timing.toolStartAt ? timing.toolEndAt - timing.toolStartAt : 0,
    tts_ttfa_ms:
      timing.firstAudioAt && timing.ttsStartAt ? timing.firstAudioAt - timing.ttsStartAt : 0,
    total_ms: now - timing.sttFinalAt,
    timestamp: new Date().toISOString(),
    ...(extra?.zeroAudio ? { zero_audio_chunks: true } : {}),
    ...(extra?.bargeIn ? { barge_in: true } : {}),
    ...(extra?.conf != null ? { stt_confidence: extra.conf } : {}),
    ...(extra?.user ? { user_text: extra.user } : {}),
    ...(extra?.agent ? { agent_text: extra.agent } : {}),
  };
}

/** Split buffered LLM text into speakable sentences; keeps incomplete tail in remainder. */
export function extractCompleteSentences(buffer: string): { sentences: string[]; remainder: string } {
  const sentences: string[] = [];
  let rest = buffer.trimStart();
  const endPunct = /([^.!?\n]+[.!?]+|[^\n]+\n+)/;

  while (rest.length > 0) {
    const m = rest.match(endPunct);
    if (!m || m.index !== 0) break;
    const chunk = m[0].trim();
    if (chunk) sentences.push(chunk);
    rest = rest.slice(m[0].length).trimStart();
  }

  return { sentences, remainder: rest };
}
