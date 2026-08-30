"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Loader2,
  MessageSquare,
  AlertCircle,
} from "lucide-react";
import { WebSession, type SessionStatus, type TranscriptEvent } from "@omnidim-ai/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type TranscriptLine = TranscriptEvent & { id: string };

type WebCallPanelProps = {
  agentId: string;
  agentName?: string;
  /** web = full web call; demo = pre-configured demo session */
  mode?: "web" | "demo";
  /** Auto-start when mounted */
  autoStart?: boolean;
  className?: string;
  onEnded?: (transcript: TranscriptLine[]) => void;
};

function statusLabel(status: SessionStatus | "idle" | "starting") {
  if (status === "idle") return "Ready";
  if (status === "starting") return "Connecting…";
  if (status === "connecting") return "Connecting…";
  if (status === "active") return "Live";
  if (typeof status === "object" && status.state === "ended") {
    return `Ended · ${status.reason.replace(/_/g, " ")}`;
  }
  return "Unknown";
}

function statusVariant(
  status: SessionStatus | "idle" | "starting",
): "default" | "success" | "outline" | "destructive" {
  if (status === "active") return "success";
  if (typeof status === "object" && status.state === "ended") return "outline";
  if (status === "connecting" || status === "starting") return "default";
  return "outline";
}

export function WebCallPanel({
  agentId,
  agentName,
  mode = "web",
  autoStart = false,
  className,
  onEnded,
}: WebCallPanelProps) {
  const sessionRef = useRef<WebSession | null>(null);
  const transcriptRef = useRef<TranscriptLine[]>([]);
  const [status, setStatus] = useState<SessionStatus | "idle" | "starting">("idle");
  const [muted, setMuted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [callLog, setCallLog] = useState<Record<string, unknown> | null>(null);

  const appendTranscript = useCallback((event: TranscriptEvent) => {
    setTranscript((prev) => {
      const last = prev[prev.length - 1];
      const next =
        last && last.role === event.role && !last.final && !event.final
          ? [...prev.slice(0, -1), { ...event, id: last.id }]
          : [...prev, { ...event, id: `${event.role}-${Date.now()}-${prev.length}` }];
      transcriptRef.current = next;
      return next;
    });
  }, []);

  const pollCallLog = useCallback(async () => {
    if (mode !== "demo") return;
    try {
      const params = new URLSearchParams({ agent_id: agentId });
      if (sessionId != null) params.set("session_id", String(sessionId));
      const data = await api.get<{ call_log?: Record<string, unknown> | null }>(
        `/api/omnidim/demo-calls?${params}`,
      );
      if (data.call_log) setCallLog(data.call_log);
    } catch {
      // Non-fatal — local transcript is still shown
    }
  }, [agentId, mode, sessionId]);

  const stopSession = useCallback(() => {
    sessionRef.current?.stop();
    sessionRef.current = null;
  }, []);

  const startCall = useCallback(async () => {
    if (busy || status === "active" || status === "connecting") return;
    setBusy(true);
    setError(null);
    setTranscript([]);
    transcriptRef.current = [];
    setCallLog(null);
    setStatus("starting");

    try {
      const endpoint = mode === "demo" ? "/api/omnidim/demo-calls" : "/api/omnidim/web-calls";
      const data = await api.post<{
        session?: { ws_url?: string; session_id?: number };
      }>(endpoint, { agent_id: agentId });

      const wsUrl = data.session?.ws_url;
      if (!wsUrl) throw new Error("No WebSocket URL returned from Omnidim");

      if (data.session?.session_id != null) {
        setSessionId(data.session.session_id);
      }

      const session = new WebSession();
      sessionRef.current = session;

      session.on("status", (s) => {
        setStatus(s);
        if (typeof s === "object" && s.state === "ended") {
          sessionRef.current = null;
          onEnded?.(transcriptRef.current);
          void pollCallLog();
        }
      });
      session.on("transcript", appendTranscript);
      session.on("error", (e) => {
        setError(e.message);
        toast.error(e.message);
      });

      await session.start({ wsUrl });
      toast.success(mode === "demo" ? "Demo call started" : "Web call connected");
    } catch (e) {
      setStatus("idle");
      const message = (e as Error).message;
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }, [agentId, appendTranscript, busy, mode, onEnded, pollCallLog, status]);

  useEffect(() => {
    if (autoStart) void startCall();
    return () => stopSession();
  }, [autoStart]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    sessionRef.current?.mute(muted);
  }, [muted]);

  const isLive = status === "active" || status === "connecting" || status === "starting";
  const isEnded = typeof status === "object" && status.state === "ended";

  const serverTranscript = callLog?.call_conversation
    ? String(callLog.call_conversation)
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/?[^>]+(>|$)/g, "")
        .trim()
    : null;

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
            {status === "active" && (
              <span className="absolute inset-0 animate-ping rounded-full border-2 border-primary/30" />
            )}
          </div>
          <div>
            <p className="font-semibold">{agentName ?? "Voice agent"}</p>
            <p className="text-xs text-muted-foreground">
              {mode === "demo" ? "Browser demo · no phone required" : "Browser voice call"}
            </p>
          </div>
        </div>
        <Badge variant={statusVariant(status)}>{statusLabel(status)}</Badge>
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
        {transcript.length === 0 && !serverTranscript ? (
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
            {isEnded && serverTranscript && (
              <div className="rounded-lg border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
                <p className="mb-1 font-semibold text-foreground">Server transcript</p>
                <pre className="whitespace-pre-wrap font-sans">{serverTranscript}</pre>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {!isLive ? (
          <Button onClick={startCall} disabled={busy} className="gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
            {mode === "demo" ? "Start demo call" : "Start web call"}
          </Button>
        ) : (
          <>
            <Button variant="outline" onClick={() => setMuted((m) => !m)} className="gap-2">
              {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              {muted ? "Unmute" : "Mute"}
            </Button>
            <Button variant="destructive" onClick={stopSession} className="gap-2">
              <PhoneOff className="h-4 w-4" /> End call
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
