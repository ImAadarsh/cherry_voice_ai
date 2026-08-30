import type { PersonalityPreset } from "./personality";

export type VoiceTransport = "web" | "phone";

export type OrchestratorSessionInput = {
  restaurantId: number;
  voiceId: string;
  greeting: string | null;
  agentId?: number | null;
  callLogId?: number | null;
  personalityPreset?: PersonalityPreset;
  transport?: VoiceTransport;
  callerPhone?: string | null;
  branchLabel?: string | null;
};

/** Shared port for web widget and future PSTN media streams. */
export interface VoiceOrchestratorPort {
  start(sessionId: string): Promise<void>;
  stop(sessionId: string): Promise<void>;
  sendAudio(sessionId: string, chunk: Buffer): void;
  interrupt(sessionId: string): void;
}
