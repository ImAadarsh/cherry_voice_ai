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
import { PcmPlaybackQueue } from "@/lib/voice/client-audio";
import { playProcessingEarcon, startWorkletMicCapture } from "@/lib/voice/client-mic-capture";
import { sanitizeVoiceError } from "@/lib/voice/user-errors";
import { cn } from "@/lib/utils";

type CherryVoiceSession = {
  session_id: string;
  events_url: string;
  audio_url: string;
  control_url: string;
  processing_earcon_enabled?: boolean;
  restaurant?: { name?: string };
};

type TranscriptLine = {
  id: string;
  role: "user" | "agent";
  text: string;
};

type CallStatus = "idle" | "connecting" | "listening" | "thinking" | "speaking" | "ended";

type CherryVoiceWebCallPanelProps = {
  agentId?: string;
  agentName?: string;
  className?: string;
  onEnded?: () => void;
};

const NETWORK_FAIL_THRESHOLD = 5;
const WORKLET_URL = "/worklets/pcm-capture-processor.js";

export function CherryVoiceWebCallPanel({
  agentId,
  agentName,
  className,
  onEnded,
}: CherryVoiceWebCallPanelProps) {
  const [status, setStatus] = useState<CallStatus>("idle");
  const [busy, setBusy] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [assistantText, setAssistantText] = useState("");
  const [textOnlyMode, setTextOnlyMode] = useState(false);
  const [networkWarning, setNetworkWarning] = useState<string | null>(null);

  const sessionRef = useRef<CherryVoiceSession | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const micHandleRef = useRef<{ stop: () => void } | null>(null);
  const playbackRef = useRef<PcmPlaybackQueue | null>(null);
  const activeRef = useRef(false);
  const closingRef = useRef(false);
  const audioFailCountRef = useRef(0);
  const earconEnabledRef = useRef(false);

  const stopPlayback = useCallback(() => {
    playbackRef.current?.stop();
  }, []);

  const stopAudioPipeline = useCallback(() => {
    micHandleRef.current?.stop();
    micHandleRef.current = null;
    if (playbackRef.current) {
      playbackRef.current.destroy();
      playbackRef.current = null;
    }
    audioFailCountRef.current = 0;
  }, []);

  const sendInterrupt = useCallback(() => {
    const session = sessionRef.current;
    if (!session?.control_url) return;
    void fetch(session.control_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "interrupt" }),
    }).catch(() => {});
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

  const mapServerState = useCallback((state?: string): CallStatus | null => {
    switch (state) {
      case "listening":
        return "listening";
      case "thinking":
        return "thinking";
      case "speaking":
        return "speaking";
      case "ended":
        return "ended";
      default:
        return null;
    }
  }, []);

  const connectEvents = useCallback(
    (session: CherryVoiceSession) => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const es = new EventSource(session.events_url);
      eventSourceRef.current = es;

      es.addEventListener("state", (ev) => {
        try {
          const data = JSON.parse(ev.data) as { state?: string; interrupted?: boolean };
          if (data.interrupted) {
            stopPlayback();
          }
          if (data.state === "ended") {
            endCall();
            return;
          }
          const mapped = mapServerState(data.state);
          if (mapped) setStatus(mapped);
        } catch {
          /* ignore */
        }
      });

      es.addEventListener("transcript", (ev) => {
        try {
          const data = JSON.parse(ev.data) as {
            text?: string;
            isFinal?: boolean;
            role?: string;
          };
          if (!data.text) return;

          if (!data.isFinal && data.role === "user") {
            stopPlayback();
            sendInterrupt();
          }

          if (data.isFinal && data.role === "user") {
            setTranscript((prev) => [
              ...prev,
              { id: `user-${Date.now()}`, role: "user", text: data.text! },
            ]);
          }
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
          if (data.data && playbackRef.current) {
            void playbackRef.current.playPcmChunk(data.data, data.sampleRate ?? 24000);
          }
        } catch {
          /* ignore */
        }
      });

      es.addEventListener("tool_start", () => {
        if (earconEnabledRef.current) playProcessingEarcon();
      });

      es.addEventListener("text_only_mode", (ev) => {
        try {
          const data = JSON.parse(ev.data) as { message?: string };
          setTextOnlyMode(true);
          const msg = data.message ?? "Audio unavailable — read the live transcript below.";
          setNetworkWarning(msg);
          setVoiceNotice(msg);
        } catch {
          setTextOnlyMode(true);
          setVoiceNotice("Audio unavailable — read the live transcript below.");
        }
      });

      es.addEventListener("network_warning", (ev) => {
        try {
          const data = JSON.parse(ev.data) as { message?: string };
          setNetworkWarning(data.message ?? "Poor connection — try ending and calling back.");
        } catch {
          setNetworkWarning("Poor connection detected.");
        }
      });

      es.addEventListener("duration_warning", (ev) => {
        try {
          const data = JSON.parse(ev.data) as { message?: string };
          if (data.message) toast.message(data.message);
        } catch {
          /* ignore */
        }
      });


      es.addEventListener("tts_fallback", (ev) => {
        try {
          const data = JSON.parse((ev as MessageEvent).data) as { text?: string; useWebSpeech?: boolean };
          const line = data.text?.trim();
          if (!line || !data.useWebSpeech || typeof window === "undefined") return;
          const utter = new SpeechSynthesisUtterance(line);
          utter.rate = 1;
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(utter);
        } catch {
          /* ignore */
        }
      });

      es.addEventListener("error", (ev: Event) => {
        try {
          const msg = ev as MessageEvent;
          const data = JSON.parse(msg.data) as { message?: string; recoverable?: boolean };
          const friendly = sanitizeVoiceError(data.message);
          if (!friendly) return;
          if (data.recoverable) {
            setNetworkWarning(friendly);
          } else {
            setVoiceNotice(friendly);
          }
        } catch {
          /* ignore */
        }
      });

      es.onerror = () => {
        if (closingRef.current || !activeRef.current) return;
        if (es.readyState === EventSource.CLOSED) {
          setVoiceNotice("Connection lost. End the call and try again.");
        }
      };
    },
    [endCall, mapServerState, sendInterrupt, stopPlayback],
  );

  const startMic = useCallback(async (session: CherryVoiceSession) => {
    playbackRef.current = new PcmPlaybackQueue();
    await playbackRef.current.ensureContext();

    const { handle } = await startWorkletMicCapture({
      audioUrl: session.audio_url,
      workletUrl: WORKLET_URL,
      isActive: () => activeRef.current,
      onUploadFailure: () => {
        audioFailCountRef.current += 1;
        if (audioFailCountRef.current >= NETWORK_FAIL_THRESHOLD) {
          setNetworkWarning(
            "We're having trouble hearing you — check your connection or try again later.",
          );
        }
      },
    });
    micHandleRef.current = handle;
  }, []);

  const startCall = useCallback(async () => {
    if (busy || activeRef.current) return;
    setBusy(true);
    setVoiceNotice(null);
    setTranscript([]);
    setAssistantText("");
    setTextOnlyMode(false);
    setNetworkWarning(null);
    setStatus("connecting");
    closingRef.current = false;

    try {
      const data = await api.post<CherryVoiceSession>("/api/cherry-voice/dashboard-session", {
        agent_id: agentId,
      });

      sessionRef.current = data;
      earconEnabledRef.current = Boolean(data.processing_earcon_enabled);
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
      const message = sanitizeVoiceError((e as Error).message);
      setVoiceNotice(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }, [agentId, busy, connectEvents, startMic, stopAudioPipeline]);

  useEffect(() => {
    return () => {
      closingRef.current = true;
      activeRef.current = false;
      if (eventSourceRef.current) eventSourceRef.current.close();
      stopAudioPipeline();
    };
  }, [stopAudioPipeline]);

  const isLive = status === "connecting" || status === "listening" || status === "thinking" || status === "speaking";
  const isThinking = status === "thinking";
  const isSpeaking = status === "speaking";

  const statusLabel =
    status === "idle"
      ? "Ready"
      : status === "connecting"
        ? "Connecting…"
        : status === "listening"
          ? "Live"
          : status === "thinking"
            ? "Thinking…"
            : status === "speaking"
              ? "Speaking"
              : "Ended";

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/20 p-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "relative grid h-12 w-12 place-items-center rounded-full",
              isLive ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
              isThinking && "animate-pulse bg-amber-500/15 text-amber-600",
              isSpeaking && "bg-primary/20 text-primary",
            )}
          >
            {isThinking ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Phone className="h-5 w-5" />
            )}
            {(status === "listening" || isSpeaking) && (
              <span
                className={cn(
                  "absolute inset-0 rounded-full border-2",
                  isSpeaking ? "animate-pulse border-primary/50" : "animate-ping border-primary/30",
                )}
              />
            )}
          </div>
          <div>
            <p className="font-semibold">{agentName ?? "Cherry Voice agent"}</p>
            <p className="text-xs text-muted-foreground">
              {isThinking
                ? "Checking details — hang on a moment…"
                : isSpeaking
                  ? "Agent is speaking…"
                  : "Browser voice call · Deepgram + Gemini + Inworld"}
            </p>
          </div>
        </div>
        <Badge variant={isLive ? "success" : status === "ended" ? "outline" : "outline"}>
          {statusLabel}
        </Badge>
      </div>

      {voiceNotice && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{voiceNotice}</span>
        </div>
      )}

      {networkWarning && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-100">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{networkWarning}</span>
        </div>
      )}

      {textOnlyMode && (
        <div className="rounded-lg border-2 border-primary bg-primary/10 p-3 text-center text-sm font-medium">
          Audio unavailable — read the live transcript below.
        </div>
      )}

      <div className={cn("min-h-[200px] space-y-2 rounded-xl border bg-card p-4", textOnlyMode && "ring-2 ring-primary")}>
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
