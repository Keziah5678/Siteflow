"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ toReview, toFollow, isAdmin }: { toReview: number; toFollow: number; isAdmin: boolean }) {
  const path = usePathname();
  const items = [
    { href: "/app", label: "Tableau de bord", icon: "▤" },
    { href: "/app/prospects", label: "Prospects", icon: "◉", count: toFollow, countLabel: "à relancer" },
    { href: "/app/messages", label: "À valider", icon: "✎", count: toReview, countLabel: "messages" },
    { href: "/app/sequences", label: "Séquences", icon: "⟳" },
    { href: "/app/settings", label: "Paramètres", icon: "⚙" },
    { href: "/app/billing", label: "Facturation", icon: "€" },
    ...(isAdmin ? [{ href: "/admin", label: "Administration", icon: "★" }] : [])
  ];
  return (
    <nav aria-label="Navigation de l'application" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible">
      {items.map(i => {
        const on = i.href === "/app" ? path === "/app" : path.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} aria-current={on ? "page" : undefined}
            className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${on ? "bg-brand-500/10 text-brand-600 dark:text-brand-400" : "muted hover:bg-[var(--surface-2)] hover:text-[var(--text)]"}`}>
            <span aria-hidden className="w-4 text-center">{i.icon}</span>{i.label}
            {!!i.count && <span className="ml-auto rounded-full bg-brand-500 px-1.5 text-[11px] font-semibold text-white" aria-label={`${i.count} ${i.countLabel}`}>{i.count}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
