"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Mic,
  Phone,
  PhoneOff,
  Loader2,
  MessageSquare,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type CherryVoiceSession = {
  session_id: string;
  events_url: string;
  audio_url: string;
  control_url: string;
  restaurant?: { name?: string };
};

type TranscriptLine = {
  id: string;
  role: "user" | "agent";
  text: string;
};

type CherryVoiceWebCallPanelProps = {
  agentId?: string;
  agentName?: string;
  className?: string;
  onEnded?: () => void;
};

function floatTo16BitPCM(float32: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(float32.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

function downsample(buffer: Float32Array, inputRate: number, outputRate: number): Float32Array {
  if (outputRate === inputRate) return buffer;
  const ratio = inputRate / outputRate;
  const newLength = Math.round(buffer.length / ratio);
  const result = new Float32Array(newLength);
  let offset = 0;
  for (let i = 0; i < newLength; i++) {
    const nextOffset = Math.round((i + 1) * ratio);
    let sum = 0;
    let count = 0;
    for (let j = offset; j < nextOffset && j < buffer.length; j++) {
      sum += buffer[j];
      count++;
    }
    result[i] = count ? sum / count : 0;
    offset = nextOffset;
  }
  return result;
}

export function CherryVoiceWebCallPanel({
  agentId,
  agentName,
  className,
  onEnded,
}: CherryVoiceWebCallPanelProps) {
  const [status, setStatus] = useState<"idle" | "connecting" | "listening" | "ended">("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [assistantText, setAssistantText] = useState("");

  const sessionRef = useRef<CherryVoiceSession | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef(0);
  const activeRef = useRef(false);
  const closingRef = useRef(false);

  const playPcmChunk = useCallback((base64: string, sampleRate = 24000) => {
    if (!playbackContextRef.current) {
      playbackContextRef.current = new AudioContext({ sampleRate: 24000 });
      nextPlayTimeRef.current = playbackContextRef.current.currentTime;
    }
    const ctx = playbackContextRef.current;
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const samples = new Float32Array(bytes.length / 2);
    const view = new DataView(bytes.buffer);
    for (let j = 0; j < samples.length; j++) {
      samples[j] = view.getInt16(j * 2, true) / 32768;
    }
    const buffer = ctx.createBuffer(1, samples.length, sampleRate);
    buffer.getChannelData(0).set(samples);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    const startAt = Math.max(ctx.currentTime, nextPlayTimeRef.current);
    source.start(startAt);
    nextPlayTimeRef.current = startAt + buffer.duration;
  }, []);

  const stopAudioPipeline = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current.onaudioprocess = null;
      processorRef.current = null;
    }
    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (playbackContextRef.current) {
      void playbackContextRef.current.close();
      playbackContextRef.current = null;
      nextPlayTimeRef.current = 0;
    }
  }, []);

  const endCall = useCallback(() => {
    closingRef.current = true;
    activeRef.current = false;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const session = sessionRef.current;
    if (session?.control_url) {
      void fetch(session.control_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "end" }),
      }).catch(() => {});
    }

    stopAudioPipeline();
    sessionRef.current = null;
    setStatus("ended");
    onEnded?.();
  }, [onEnded, stopAudioPipeline]);

  const connectEvents = useCallback(
    (session: CherryVoiceSession) => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const es = new EventSource(session.events_url);
      eventSourceRef.current = es;

      es.addEventListener("state", (ev) => {
        try {
          const data = JSON.parse(ev.data) as { state?: string };
          if (data.state === "ended") {
            endCall();
            return;
          }
          if (data.state) {
            const label = data.state.charAt(0).toUpperCase() + data.state.slice(1);
            setStatus(label === "Listening" ? "listening" : "connecting");
          }
        } catch {
          /* ignore */
        }
      });

      es.addEventListener("transcript", (ev) => {
        try {
          const data = JSON.parse(ev.data) as { text?: string };
          if (!data.text) return;
          setTranscript((prev) => [
            ...prev,
            { id: `user-${Date.now()}`, role: "user", text: data.text! },
          ]);
        } catch {
          /* ignore */
        }
      });

      es.addEventListener("assistant_text", (ev) => {
        try {
          const data = JSON.parse(ev.data) as { text?: string };
          if (data.text) {
            setAssistantText(data.text);
            setTranscript((prev) => [
              ...prev,
              { id: `agent-${Date.now()}`, role: "agent", text: data.text! },
            ]);
          }
        } catch {
          /* ignore */
        }
      });

      es.addEventListener("audio", (ev) => {
        try {
          const data = JSON.parse(ev.data) as { data?: string; sampleRate?: number };
          if (data.data) playPcmChunk(data.data, data.sampleRate ?? 24000);
        } catch {
          /* ignore */
        }
      });

      es.addEventListener("error", (ev: Event) => {
        try {
          const msg = ev as MessageEvent;
          const data = JSON.parse(msg.data) as { message?: string };
          setError(data.message ?? "Voice error");
        } catch {
          /* ignore */
        }
      });

      es.onerror = () => {
        if (closingRef.current || !activeRef.current) return;
        if (es.readyState === EventSource.CLOSED) {
          setError("Connection lost. End the call and try again.");
        }
      };
    },
    [endCall, playPcmChunk],
  );

  const startMic = useCallback(async (session: CherryVoiceSession) => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaStreamRef.current = stream;
    const audioContext = new AudioContext();
    audioContextRef.current = audioContext;
    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    processorRef.current = processor;

    processor.onaudioprocess = (e) => {
      if (!activeRef.current || !session.audio_url) return;
      const input = e.inputBuffer.getChannelData(0);
      const down = downsample(input, audioContext.sampleRate, 16000);
      const pcm = floatTo16BitPCM(down);
      void fetch(session.audio_url, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: pcm,
      }).catch(() => {});
    };

    source.connect(processor);
    processor.connect(audioContext.destination);
  }, []);

  const startCall = useCallback(async () => {
    if (busy || activeRef.current) return;
    setBusy(true);
    setError(null);
    setTranscript([]);
    setAssistantText("");
    setStatus("connecting");
    closingRef.current = false;

    try {
      const data = await api.post<CherryVoiceSession>("/api/cherry-voice/dashboard-session", {
        agent_id: agentId,
      });

      sessionRef.current = data;
      activeRef.current = true;
      connectEvents(data);
      await startMic(data);
      setStatus("listening");
      toast.success("Web call connected");
    } catch (e) {
      closingRef.current = true;
      activeRef.current = false;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      stopAudioPipeline();
      sessionRef.current = null;
      setStatus("idle");
      const message = (e as Error).message;
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }, [agentId, busy, connectEvents, endCall, startMic]);

  useEffect(() => {
    return () => {
      closingRef.current = true;
      activeRef.current = false;
      if (eventSourceRef.current) eventSourceRef.current.close();
      stopAudioPipeline();
    };
  }, [stopAudioPipeline]);

  const isLive = status === "connecting" || status === "listening";
  const statusLabel =
    status === "idle"
      ? "Ready"
      : status === "connecting"
        ? "Connecting…"
        : status === "listening"
          ? "Live"
          : "Ended";

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/20 p-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "relative grid h-12 w-12 place-items-center rounded-full",
              isLive ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
            )}
          >
            <Phone className="h-5 w-5" />
            {status === "listening" && (
              <span className="absolute inset-0 animate-ping rounded-full border-2 border-primary/30" />
            )}
          </div>
          <div>
            <p className="font-semibold">{agentName ?? "Cherry Voice agent"}</p>
            <p className="text-xs text-muted-foreground">Browser voice call · Deepgram + Gemini + Inworld</p>
          </div>
        </div>
        <Badge variant={isLive ? "success" : status === "ended" ? "outline" : "outline"}>
          {statusLabel}
        </Badge>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="min-h-[200px] space-y-2 rounded-xl border bg-card p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <MessageSquare className="h-4 w-4" /> Transcript
        </div>
        {transcript.length === 0 && !assistantText ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {isLive ? "Listening… speak to your agent." : "Start a call to see the live transcript."}
          </p>
        ) : (
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {transcript.map((line) => (
              <div
                key={line.id}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm",
                  line.role === "agent" ? "bg-muted" : "bg-primary/10 text-foreground",
                )}
              >
                <span className="text-xs font-semibold uppercase text-muted-foreground">
                  {line.role === "agent" ? "Agent" : "You"}
                </span>
                <p>{line.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {!isLive ? (
          <Button onClick={() => void startCall()} disabled={busy} className="gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
            Start web call
          </Button>
        ) : (
          <Button variant="destructive" onClick={endCall} className="gap-2">
            <PhoneOff className="h-4 w-4" /> End call
          </Button>
        )}
      </div>
    </div>
  );
}
