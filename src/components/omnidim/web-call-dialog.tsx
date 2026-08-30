"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WebCallPanel } from "./web-call-panel";

type WebCallDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  agentName?: string;
  mode?: "web" | "demo";
};

export function WebCallDialog({
  open,
  onOpenChange,
  agentId,
  agentName,
  mode = "web",
}: WebCallDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "demo" ? "Demo call" : "Web call"} · {agentName ?? "Agent"}
          </DialogTitle>
        </DialogHeader>
        {open && (
          <WebCallPanel
            agentId={agentId}
            agentName={agentName}
            mode={mode}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
