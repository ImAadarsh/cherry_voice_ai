export type VoiceSessionState =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "ended"
  | "error";

export interface SttTranscriptEvent {
  text: string;
  isFinal: boolean;
  speechStarted?: boolean;
  confidence?: number | null;
}

export interface SttProvider {
  connect(): Promise<void>;
  sendAudio(chunk: Buffer): void;
  onTranscript(handler: (event: SttTranscriptEvent) => void): void;
  onError(handler: (error: Error) => void): void;
  onDisconnect?(handler: () => void): void;
  close(): void;
}

export interface TtsSynthesisOptions {
  voiceId: string;
  text: string;
  signal?: AbortSignal;
  modelId?: string;
  onAudioChunk?: (pcm: Buffer) => void;
  onFirstChunk?: () => void;
}

export interface TtsProvider {
  synthesize(options: TtsSynthesisOptions): Promise<void>;
}

export interface LlmMessage {
  role: "user" | "model" | "system";
  content: string;
  toolCalls?: LlmToolCall[];
  toolResults?: Array<{ name: string; result: unknown }>;
}

export interface LlmToolCall {
  name: string;
  args: Record<string, unknown>;
  thoughtSignature?: string;
  id?: string;
}

export interface LlmTurnResult {
  text: string;
  toolCalls: LlmToolCall[];
}

export interface LlmProvider {
  chat(
    messages: LlmMessage[],
    options?: { systemPrompt?: string; signal?: AbortSignal; flash?: boolean },
  ): Promise<LlmTurnResult>;
  continueWithToolResults(
    messages: LlmMessage[],
    toolResults: Array<{ name: string; result: unknown }>,
    options?: { systemPrompt?: string; signal?: AbortSignal },
  ): Promise<LlmTurnResult>;
  chatStream(
    messages: LlmMessage[],
    options?: { systemPrompt?: string; signal?: AbortSignal },
  ): AsyncGenerator<string, LlmTurnResult, undefined>;
}

export interface VoiceSessionEvent {
  type:
    | "state"
    | "transcript"
    | "assistant_text"
    | "audio"
    | "error"
    | "greeting"
    | "text_only_mode"
    | "tts_fallback"
    | "tool_start"
    | "network_warning"
    | "duration_warning";
  payload: Record<string, unknown>;
}
