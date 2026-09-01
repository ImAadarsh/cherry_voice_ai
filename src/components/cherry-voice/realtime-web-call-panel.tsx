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
import { playProcessingEarcon } from "@/lib/voice/client-mic-capture";
import { sanitizeVoiceError, formatInworldRealtimeError } from "@/lib/voice/user-errors";
import { cn } from "@/lib/utils";

type RealtimeBootstrap = {
  session_id: string;
  ice_servers: RTCIceServer[];
  sdp_proxy_url: string;
  tools_url: string;
  transcript_url?: string;
  end_url: string;
  session_config: Record<string, unknown>;
  greeting?: string | null;
  processing_earcon_enabled?: boolean;
  restaurant?: { name?: string };
};

type TranscriptLine = {
  id: string;
  role: "user" | "agent";
  text: string;
};

type CallStatus = "idle" | "connecting" | "listening" | "thinking" | "speaking" | "tool_running" | "ended";

type RealtimeWebCallPanelProps = {
  agentId?: string;
  agentName?: string;
  className?: string;
  onEnded?: () => void;
};

async function waitForIceGathering(pc: RTCPeerConnection, timeoutMs = 3000): Promise<void> {
  if (pc.iceGatheringState === "complete") return;

  await new Promise<void>((resolve) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const done = () => {
      if (timer) clearTimeout(timer);
      resolve();
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(done, 500);
      }
    };
    pc.onicegatheringstatechange = () => {
      if (pc.iceGatheringState === "complete") done();
    };
    setTimeout(done, timeoutMs);
  });
}

export function RealtimeWebCallPanel({
  agentId,
  agentName,
  className,
  onEnded,
}: RealtimeWebCallPanelProps) {
  const [status, setStatus] = useState<CallStatus>("idle");
  const [busy, setBusy] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [networkWarning, setNetworkWarning] = useState<string | null>(null);

  const bootstrapRef = useRef<RealtimeBootstrap | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const activeRef = useRef(false);
  const closingRef = useRef(false);
  const statusRef = useRef<CallStatus>("idle");
  const earconEnabledRef = useRef(false);
  const pendingAgentTextRef = useRef("");
  const toolCallsInFlightRef = useRef(new Set<string>());
  const sessionReadyRef = useRef(false);
  const greetingSentRef = useRef(false);
  const greetingFallbackTimerRef = useRef<number | null>(null);

  const attachRemoteAudio = useCallback((stream: MediaStream) => {
    if (!audioElRef.current) {
      const audio = document.createElement("audio");
      audio.autoplay = true;
      audio.setAttribute("playsinline", "true");
      audio.style.display = "none";
      document.body.appendChild(audio);
      audioElRef.current = audio;
    }

    const audio = audioElRef.current;
    audio.srcObject = stream;
    void audio.play().catch((err) => {
      console.warn("[Cherry Voice Realtime] Remote audio autoplay blocked:", err);
    });
  }, []);

  const sendInitialGreeting = useCallback(() => {
    if (greetingSentRef.current || !sessionReadyRef.current) return;

    const bootstrap = bootstrapRef.current;
    const dc = dcRef.current;
    if (!bootstrap || dc?.readyState !== "open") return;

    const greeting = bootstrap.greeting?.trim();
    if (!greeting) return;

    greetingSentRef.current = true;
    dc.send(
      JSON.stringify({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Greet the customer warmly. Say or paraphrase: "${greeting}"`,
            },
          ],
        },
      }),
    );
    dc.send(JSON.stringify({ type: "response.create" }));
  }, []);

  const appendTranscript = useCallback((role: "user" | "agent", text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setTranscript((prev) => {
      const last = prev[prev.length - 1];
      if (last?.role === role && last.text === trimmed) return prev;
      return [...prev, { id: `${role}-${Date.now()}`, role, text: trimmed }];
    });

    const bootstrap = bootstrapRef.current;
    if (bootstrap?.transcript_url) {
      void api
        .post(bootstrap.transcript_url, {
          role: role === "agent" ? "assistant" : "user",
          text: trimmed,
        })
        .catch(() => {});
    }
  }, []);

  const executeToolCall = useCallback(
    async (callId: string, name: string, argsRaw: string) => {
      const bootstrap = bootstrapRef.current;
      if (!bootstrap || toolCallsInFlightRef.current.has(callId)) return;
      toolCallsInFlightRef.current.add(callId);

      if (earconEnabledRef.current) playProcessingEarcon();
      statusRef.current = "tool_running";
      setStatus("tool_running");

      try {
        const result = await api.post<{ call_id: string; output: string }>(bootstrap.tools_url, {
          call_id: callId,
          name,
          arguments: argsRaw,
        });

        const dc = dcRef.current;
        if (dc?.readyState === "open") {
          dc.send(
            JSON.stringify({
              type: "conversation.item.create",
              item: {
                type: "function_call_output",
                call_id: result.call_id ?? callId,
                output: result.output,
              },
            }),
          );
          dc.send(JSON.stringify({ type: "response.create" }));
        }
      } catch (err) {
        const dc = dcRef.current;
        if (dc?.readyState === "open") {
          dc.send(
            JSON.stringify({
              type: "conversation.item.create",
              item: {
                type: "function_call_output",
                call_id: callId,
                output: JSON.stringify({
                  error: sanitizeVoiceError((err as Error).message),
                }),
              },
            }),
          );
          dc.send(JSON.stringify({ type: "response.create" }));
        }
      } finally {
        toolCallsInFlightRef.current.delete(callId);
        if (activeRef.current) {
          statusRef.current = "listening";
          setStatus("listening");
        }
      }
    },
    [],
  );

  const handleRealtimeEvent = useCallback(
    (msg: Record<string, unknown>) => {
      const type = String(msg.type ?? "");

      if (type === "error") {
        const errObj = msg.error as
          | { type?: string; code?: string; message?: string; param?: string; event_id?: string }
          | undefined;
        const friendly = formatInworldRealtimeError(errObj);
        if (friendly) setVoiceNotice(friendly);
        return;
      }

      if (type === "session.created" || type === "session.updated") {
        sessionReadyRef.current = true;
        sendInitialGreeting();
        if (activeRef.current) {
          statusRef.current = "listening";
          setStatus("listening");
        }
        return;
      }

      if (type === "input_audio_buffer.speech_started") {
        statusRef.current = "listening";
        setStatus("listening");
        return;
      }

      if (type === "input_audio_buffer.speech_stopped") {
        statusRef.current = "thinking";
        setStatus("thinking");
        return;
      }

      if (type === "response.created") {
        statusRef.current = "speaking";
        setStatus("speaking");
        pendingAgentTextRef.current = "";
        return;
      }

      if (type === "response.output_text.delta") {
        const delta = String(msg.delta ?? "");
        pendingAgentTextRef.current += delta;
        return;
      }

      if (type === "response.output_audio_transcript.delta") {
        const delta = String(msg.delta ?? "");
        pendingAgentTextRef.current += delta;
        return;
      }

      if (type === "response.output_text.done") {
        const text = String(msg.text ?? pendingAgentTextRef.current);
        pendingAgentTextRef.current = "";
        if (text.trim()) appendTranscript("agent", text);
        return;
      }

      if (type === "response.output_audio_transcript.done") {
        const text = String(msg.transcript ?? pendingAgentTextRef.current);
        pendingAgentTextRef.current = "";
        if (text.trim()) appendTranscript("agent", text);
        return;
      }

      if (type === "conversation.item.input_audio_transcription.completed") {
        const text = String(msg.transcript ?? "");
        if (text.trim()) appendTranscript("user", text);
        return;
      }

      if (type === "response.output_item.done") {
        const item = msg.item as Record<string, unknown> | undefined;
        if (item?.type === "function_call") {
          const callId = String(item.call_id ?? "");
          const name = String(item.name ?? "");
          const args = String(item.arguments ?? "{}");
          if (callId && name) void executeToolCall(callId, name, args);
        }
        return;
      }

      if (type === "response.done") {
        statusRef.current = "listening";
        setStatus("listening");
      }
    },
    [appendTranscript, executeToolCall, sendInitialGreeting],
  );

  const teardown = useCallback(() => {
    if (greetingFallbackTimerRef.current) {
      clearTimeout(greetingFallbackTimerRef.current);
      greetingFallbackTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (dcRef.current) {
      try {
        dcRef.current.close();
      } catch {
        /* ignore */
      }
      dcRef.current = null;
    }
    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch {
        /* ignore */
      }
      pcRef.current = null;
    }
    if (audioElRef.current) {
      audioElRef.current.remove();
      audioElRef.current = null;
    }
  }, []);

  const endCall = useCallback(() => {
    closingRef.current = true;
    activeRef.current = false;

    const bootstrap = bootstrapRef.current;
    if (bootstrap?.end_url) {
      void api.post(bootstrap.end_url, {}).catch(() => {});
    }

    teardown();
    bootstrapRef.current = null;
    statusRef.current = "ended";
    setStatus("ended");
    onEnded?.();
  }, [onEnded, teardown]);

  const startCall = useCallback(async () => {
    if (busy || activeRef.current) return;
    setBusy(true);
    setVoiceNotice(null);
    setTranscript([]);
    setNetworkWarning(null);
    closingRef.current = false;
    sessionReadyRef.current = false;
    greetingSentRef.current = false;
    statusRef.current = "connecting";
    setStatus("connecting");

    try {
      const bootstrap = await api.post<RealtimeBootstrap>("/api/cherry-voice/realtime/session", {
        agent_id: agentId,
      });

      bootstrapRef.current = bootstrap;
      earconEnabledRef.current = Boolean(bootstrap.processing_earcon_enabled);
      activeRef.current = true;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;

      const pc = new RTCPeerConnection({ iceServers: bootstrap.ice_servers ?? [] });
      pcRef.current = pc;

      const dc = pc.createDataChannel("oai-events", { ordered: true });
      dcRef.current = dc;

      stream.getAudioTracks().forEach((track) => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        const remoteStream = event.streams[0] ?? new MediaStream([event.track]);
        attachRemoteAudio(remoteStream);
        event.track.onunmute = () => {
          if (audioElRef.current) void audioElRef.current.play().catch(() => {});
        };
      };

      pc.onconnectionstatechange = () => {
        if (!activeRef.current || closingRef.current) return;
        if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
          setNetworkWarning("Connection lost — try ending and calling back.");
        }
      };

      dc.onopen = () => {
        dc.send(
          JSON.stringify({
            type: "session.update",
            session: bootstrap.session_config,
          }),
        );

        // Fallback: if session.updated never arrives (already configured via SDP), greet after a short delay.
        greetingFallbackTimerRef.current = window.setTimeout(() => {
          greetingFallbackTimerRef.current = null;
          if (!sessionReadyRef.current && activeRef.current) {
            sessionReadyRef.current = true;
            sendInitialGreeting();
            statusRef.current = "listening";
            setStatus("listening");
          }
        }, 1500);
      };

      dc.onmessage = (e) => {
        try {
          handleRealtimeEvent(JSON.parse(e.data) as Record<string, unknown>);
        } catch {
          /* ignore malformed events */
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitForIceGathering(pc);

      const sdpRes = await fetch(bootstrap.sdp_proxy_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          sdp: pc.localDescription?.sdp,
          session_id: bootstrap.session_id,
          session_config: bootstrap.session_config,
        }),
      });

      if (!sdpRes.ok) {
        const errBody = await sdpRes.json().catch(() => ({}));
        const errMsg = (errBody as { error?: string }).error ?? `WebRTC signaling failed (${sdpRes.status})`;
        console.error("[Cherry Voice Realtime] SDP proxy failed:", sdpRes.status, errMsg);
        throw new Error(errMsg);
      }

      const answerSdp = await sdpRes.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

      toast.success("Web call connected");
    } catch (e) {
      closingRef.current = true;
      activeRef.current = false;
      teardown();
      bootstrapRef.current = null;
      statusRef.current = "idle";
      setStatus("idle");
      const message = sanitizeVoiceError((e as Error).message);
      setVoiceNotice(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }, [agentId, attachRemoteAudio, busy, handleRealtimeEvent, sendInitialGreeting, teardown]);

  useEffect(() => {
    return () => {
      closingRef.current = true;
      activeRef.current = false;
      teardown();
    };
  }, [teardown]);

  const isLive =
    status === "connecting" ||
    status === "listening" ||
    status === "thinking" ||
    status === "speaking" ||
    status === "tool_running";

  const statusLabel =
    status === "idle"
      ? "Ready"
      : status === "connecting"
        ? "Connecting…"
        : status === "listening"
          ? "Listening"
          : status === "thinking"
            ? "Thinking…"
            : status === "speaking"
              ? "Speaking"
              : status === "tool_running"
                ? "Working…"
                : "Ended";

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/20 p-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "relative grid h-12 w-12 place-items-center rounded-full",
              isLive ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
              status === "thinking" && "animate-pulse bg-amber-500/15 text-amber-600",
              (status === "speaking" || status === "tool_running") && "bg-primary/20 text-primary",
            )}
          >
            {status === "thinking" || status === "connecting" ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Phone className="h-5 w-5" />
            )}
            {(status === "listening" || status === "speaking") && (
              <span
                className={cn(
                  "absolute inset-0 rounded-full border-2",
                  status === "speaking" ? "animate-pulse border-primary/50" : "animate-ping border-primary/30",
                )}
              />
            )}
          </div>
          <div>
            <p className="font-semibold">{agentName ?? "Cherry Voice agent"}</p>
            <p className="text-xs text-muted-foreground">
              Inworld Realtime · semantic VAD · full-duplex
            </p>
          </div>
        </div>
        <Badge variant={isLive ? "success" : "outline"}>{statusLabel}</Badge>
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

      <div className="min-h-[200px] space-y-2 rounded-xl border bg-card p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <MessageSquare className="h-4 w-4" /> Transcript
        </div>
        {transcript.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {isLive ? "Speak naturally — Inworld handles turn-taking." : "Start a call to see the live transcript."}
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
