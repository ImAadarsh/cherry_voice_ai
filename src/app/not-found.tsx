import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CherryMark } from "@/components/brand/logo";

export default function NotFound() {
  return (
    <div className="flex min-h-[70svh] flex-col items-center justify-center gap-5 text-center">
      <CherryMark className="h-12 w-12" />
      <div className="space-y-1">
        <p className="font-display text-5xl font-bold tracking-tight">404</p>
        <p className="text-sm text-muted-foreground">
          We couldn&apos;t find that page.
        </p>
      </div>
      <Button asChild>
        <Link href="/dashboard">Back to dashboard</Link>
      </Button>
    </div>
  );
}
