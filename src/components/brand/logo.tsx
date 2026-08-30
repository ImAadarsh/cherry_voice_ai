import { cn } from "@/lib/utils";

export function CherryMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("h-7 w-7", className)}
      fill="none"
      aria-hidden
    >
      <defs>
        <linearGradient id="cherryGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F87171" />
          <stop offset="100%" stopColor="#B91C1C" />
        </linearGradient>
      </defs>
      <path
        d="M18 5c0 4 1.5 6 5 7"
        stroke="#15803D"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M18 5c-3 3-6 4-9 4"
        stroke="#15803D"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="10" cy="20" r="7" fill="url(#cherryGrad)" />
      <circle cx="23" cy="18" r="6" fill="url(#cherryGrad)" />
      <circle cx="8" cy="18" r="1.6" fill="#fff" fillOpacity="0.55" />
      <circle cx="21.5" cy="16.5" r="1.3" fill="#fff" fillOpacity="0.55" />
    </svg>
  );
}

export function Logo({
  className,
  collapsed = false,
}: {
  className?: string;
  collapsed?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 ring-1 ring-primary/15">
        <CherryMark className="h-6 w-6" />
      </div>
      {!collapsed && (
        <div className="leading-tight">
          <p className="font-display text-sm font-bold tracking-tight">
            Cherry Voice AI
          </p>
          <p className="text-[11px] text-muted-foreground">Restaurant OS</p>
        </div>
      )}
    </div>
  );
}
