import { cn } from "@/lib/utils";

/**
 * VENTURE mark: two paths converge into one node (connection); the right
 * branch rises higher and ends in a point (progression, ambition).
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className={cn("h-7 w-7", className)}>
      <rect width="32" height="32" rx="9" fill="#7C3AED" />
      <path d="M8 9.5 15.2 22.4a.9.9 0 0 0 1.6 0L24.6 6.8" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="24.6" cy="6.8" r="2" fill="#A78BFA" />
      <circle cx="8" cy="9.5" r="1.5" fill="#fff" fillOpacity=".55" />
    </svg>
  );
}

export function Logo({ className, withText = true }: { className?: string; withText?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      {withText && <span className="text-[15px] font-semibold tracking-[0.18em]">VENTURE</span>}
    </span>
  );
}
