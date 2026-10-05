import { cn } from "@/lib/utils";

/** Nexis Lens mark — a lens over lines of code. Family grammar: 48×48,
 * rx=12 tile in currentColor, marks drawn in var(--background) so they punch
 * through in both light and dark mode (PITFALLS.md §5); coral is the brand. */
export function AppLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={cn("size-5 text-foreground", className)} aria-label="Nexis Lens">
      <rect width="48" height="48" rx="12" fill="currentColor" />
      <g stroke="var(--background)" strokeWidth="3" strokeLinecap="round" opacity="0.55">
        <path d="M10 14h14M13 20h18M13 26h8M10 32h16" />
      </g>
      <circle cx="27" cy="23" r="8.5" stroke="var(--brand)" strokeWidth="3.2" fill="none" />
      <path d="M33.2 29.2 37.5 33.5" stroke="var(--brand)" strokeWidth="3.6" strokeLinecap="round" />
    </svg>
  );
}
