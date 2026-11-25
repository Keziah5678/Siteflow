import Link from "next/link";
import { cn } from "@/lib/utils";

/** URL-driven tabs (shareable, work without JS). */
export function LinkTabs({ tabs, active, className }: { tabs: { href: string; label: string; key: string; count?: number }[]; active: string; className?: string }) {
  return (
    <nav className={cn("scrollbar-none -mx-1 flex gap-1 overflow-x-auto border-b border-border px-1", className)} aria-label="Onglets">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          scroll={false}
          aria-current={active === t.key ? "page" : undefined}
          className={cn(
            "relative shrink-0 px-3 pb-3 pt-1 text-sm font-medium text-muted transition-colors hover:text-fg",
            active === t.key && "text-fg after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-primary",
          )}
        >
          {t.label}
          {t.count != null && t.count > 0 && <span className="ml-1.5 rounded-full bg-bg-2 px-1.5 text-[11px] text-subtle">{t.count}</span>}
        </Link>
      ))}
    </nav>
  );
}

export function FilterChips({ items, active, className }: { items: { href: string; label: string; key: string }[]; active: string; className?: string }) {
  return (
    <div className={cn("scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0", className)} role="tablist">
      {items.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          scroll={false}
          role="tab"
          aria-selected={active === t.key}
          className={cn(
            "shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors",
            active === t.key ? "border-primary bg-primary-soft text-fg" : "border-border text-muted hover:border-border-strong hover:text-fg",
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
