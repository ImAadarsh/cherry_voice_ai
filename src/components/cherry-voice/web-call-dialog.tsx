"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CherryVoiceWebCallPanel } from "./web-call-panel";
import { RealtimeWebCallPanel } from "./realtime-web-call-panel";

type CherryVoiceWebCallDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId?: string;
  agentName?: string;
};

export function CherryVoiceWebCallDialog({
  open,
  onOpenChange,
  agentId,
  agentName,
}: CherryVoiceWebCallDialogProps) {
  const [mode, setMode] = useState<"inworld_realtime" | "pipeline">("inworld_realtime");

  useEffect(() => {
    if (!open) return;
    void fetch("/api/cherry-voice/config")
      .then((r) => r.json())
      .then((body: { data?: { mode?: string } }) => {
        if (body?.data?.mode === "pipeline") setMode("pipeline");
      })
      .catch(() => {});
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Web call · {agentName ?? "Cherry Voice agent"}</DialogTitle>
        </DialogHeader>
        {open &&
          (mode === "inworld_realtime" ? (
            <RealtimeWebCallPanel agentId={agentId} agentName={agentName} />
          ) : (
            <CherryVoiceWebCallPanel agentId={agentId} agentName={agentName} />
          ))}
      </DialogContent>
    </Dialog>
  );
}
