"use client";

import { useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CallOutcomeBadge } from "@/components/shared/status-badge";
import { api } from "@/lib/api-client";
import { formatDuration } from "@/lib/utils";
import type { CallLog, CallOutcome } from "@/types";

type OmnidimCallLog = {
  id?: number | string;
  call_status?: string;
  status?: string;
  from_number?: string;
  to_number?: string;
  call_conversation?: string;
  transcript?: string;
  recording_url?: string;
  duration?: number;
  duration_seconds?: number;
  sentiment_score?: number;
  sentiment?: string;
  summary?: string;
  bot_name?: string;
  created_at?: string;
};

function mapOutcome(status?: string): CallOutcome {
  if (!status) return "inquiry";
  const s = status.toLowerCase();
  if (s.includes("no_answer") || s.includes("busy") || s.includes("missed")) return "missed";
  if (s.includes("transfer")) return "transferred";
  if (s.includes("reservation")) return "reservation";
  if (s.includes("completed")) return "order_placed";
  return "inquiry";
}

function sentimentLabel(score?: number, text?: string): CallLog["sentiment"] {
  if (text) {
    const t = text.toLowerCase();
    if (t.includes("positive")) return "positive";
    if (t.includes("negative")) return "negative";
  }
  if (score == null) return "neutral";
  if (score >= 0.6) return "positive";
  if (score <= 0.4) return "negative";
  return "neutral";
}

export function CallDetailDrawer({
  callId,
  fallback,
  onClose,
}: {
  callId: string | null;
  fallback?: Partial<CallLog>;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState<OmnidimCallLog | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!callId) {
      setLog(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    api
      .get<{ log: OmnidimCallLog }>(`/api/calls/${callId}`)
      .then((res) => setLog(res.log))
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [callId]);

  const status = log?.call_status ?? log?.status ?? fallback?.outcome;
  const outcome = typeof status === "string" ? mapOutcome(status) : fallback?.outcome ?? "inquiry";
  const transcript =
    log?.call_conversation ?? log?.transcript ?? (fallback as { transcript?: string })?.transcript;
  const recordingUrl = log?.recording_url ?? fallback?.recordingUrl;
  const duration = log?.duration_seconds ?? log?.duration ?? fallback?.duration ?? 0;
  const phone = log?.from_number ?? log?.to_number ?? fallback?.customerPhone ?? "—";
  const sentiment = sentimentLabel(log?.sentiment_score, log?.sentiment);

  return (
    <Sheet open={!!callId} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Call details</SheetTitle>
          <SheetDescription>{phone}</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-6 pb-8">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading call log…
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex flex-wrap items-center gap-2">
            <CallOutcomeBadge outcome={outcome} />
            <Badge variant="outline" className="capitalize">
              {sentiment} sentiment
            </Badge>
            <span className="text-sm tabular text-muted-foreground">
              {duration ? formatDuration(duration) : "—"}
            </span>
          </div>

          {log?.summary && (
            <div className="rounded-xl border bg-muted/30 p-3">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Summary</p>
              <p className="mt-1 text-sm">{log.summary}</p>
            </div>
          )}

          {recordingUrl && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Recording</p>
              <audio controls className="w-full" src={recordingUrl}>
                <track kind="captions" />
              </audio>
              <Button variant="outline" size="sm" className="gap-2" asChild>
                <a href={recordingUrl} download target="_blank" rel="noreferrer">
                  <Download className="h-4 w-4" /> Download
                </a>
              </Button>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Transcript</p>
            <ScrollArea className="h-64 rounded-xl border bg-muted/20 p-3">
              <pre className="whitespace-pre-wrap font-sans text-sm">
                {transcript || "No transcript available."}
              </pre>
            </ScrollArea>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
