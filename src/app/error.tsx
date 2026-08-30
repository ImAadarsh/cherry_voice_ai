"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[70svh] flex-col items-center justify-center gap-5 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-destructive/10">
        <AlertTriangle className="h-8 w-8 text-destructive" />
      </div>
      <div className="space-y-1">
        <h1 className="font-display text-xl font-bold">Something broke</h1>
        <p className="max-w-xs text-sm text-muted-foreground">
          An unexpected error occurred. You can try again — if it persists,
          check your connection.
        </p>
      </div>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
