"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CherryVoiceWebCallPanel } from "./web-call-panel";

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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Web call · {agentName ?? "Cherry Voice agent"}</DialogTitle>
        </DialogHeader>
        {open && (
          <CherryVoiceWebCallPanel
            agentId={agentId}
            agentName={agentName}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
