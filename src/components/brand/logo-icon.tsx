import { cn } from "@/lib/utils";

export function LogoIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("h-8 w-8", className)}
      fill="none"
      aria-hidden
    >
      <defs>
        <linearGradient id="cherryIconGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F87171" />
          <stop offset="100%" stopColor="#DC2626" />
        </linearGradient>
      </defs>
      <path
        d="M18 5c0 4 1.5 6 5 7"
        stroke="#0D9488"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M18 5c-3 3-6 4-9 4"
        stroke="#0D9488"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="10" cy="20" r="7" fill="url(#cherryIconGrad)" />
      <circle cx="23" cy="18" r="6" fill="url(#cherryIconGrad)" />
      <circle cx="8" cy="18" r="1.6" fill="#fff" fillOpacity="0.55" />
      <circle cx="21.5" cy="16.5" r="1.3" fill="#fff" fillOpacity="0.55" />
    </svg>
  );
}
