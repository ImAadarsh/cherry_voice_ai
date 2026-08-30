import { WifiOff } from "lucide-react";
import { CherryMark } from "@/components/brand/logo";

export const metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <div className="flex min-h-[70svh] flex-col items-center justify-center gap-4 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-muted">
        <WifiOff className="h-8 w-8 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <h1 className="font-display text-xl font-bold">You&apos;re offline</h1>
        <p className="max-w-xs text-sm text-muted-foreground">
          Cherry Voice AI can&apos;t reach the network right now. Cached pages
          are still available — reconnect to see live orders.
        </p>
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <CherryMark className="h-4 w-4" /> Cherry Voice AI
      </div>
    </div>
  );
}
