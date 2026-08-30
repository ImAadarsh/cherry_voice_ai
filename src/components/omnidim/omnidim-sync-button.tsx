"use client";

import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { manualOmnidimSync } from "@/hooks/use-omnidim-sync";

export function OmnidimSyncButton({
  onSynced,
  variant = "outline",
  size = "sm",
}: {
  onSynced?: () => void;
  variant?: "outline" | "default" | "ghost";
  size?: "sm" | "default";
}) {
  return (
    <Button
      variant={variant}
      size={size}
      className="gap-2"
      onClick={async () => {
        try {
          const result = await manualOmnidimSync();
          toast.success("Synced from Omnidim", {
            description: `${result.agents?.synced ?? 0} agents, ${result.calls?.synced ?? 0} calls`,
          });
          onSynced?.();
        } catch (e) {
          toast.error((e as Error).message);
        }
      }}
    >
      <RefreshCw className="h-4 w-4" /> Sync
    </Button>
  );
}
