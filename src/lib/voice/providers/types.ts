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
}

export interface SttProvider {
  connect(): Promise<void>;
  sendAudio(chunk: Buffer): void;
  onTranscript(handler: (event: SttTranscriptEvent) => void): void;
  onError(handler: (error: Error) => void): void;
  close(): void;
}

export interface TtsSynthesisOptions {
  voiceId: string;
  text: string;
  signal?: AbortSignal;
  onAudioChunk?: (pcm: Buffer) => void;
}

export interface TtsProvider {
  synthesize(options: TtsSynthesisOptions): Promise<void>;
}

export interface LlmMessage {
  role: "user" | "model" | "system";
  content: string;
}

export interface LlmToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface LlmTurnResult {
  text: string;
  toolCalls: LlmToolCall[];
}

export interface LlmProvider {
  chat(
    messages: LlmMessage[],
    options?: { systemPrompt?: string; signal?: AbortSignal },
  ): Promise<LlmTurnResult>;
  continueWithToolResults(
    messages: LlmMessage[],
    toolResults: Array<{ name: string; result: unknown }>,
    options?: { systemPrompt?: string; signal?: AbortSignal },
  ): Promise<LlmTurnResult>;
}

export interface VoiceSessionEvent {
  type:
    | "state"
    | "transcript"
    | "assistant_text"
    | "audio"
    | "error"
    | "greeting";
  payload: Record<string, unknown>;
}
