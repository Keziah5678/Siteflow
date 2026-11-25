"use client";
import { useEffect, useRef } from "react";
import { Search } from "lucide-react";

export function SearchForm({ universe, q, autoFocus, extra }: { universe: string; q: string; autoFocus: boolean; extra: Record<string, string> }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);
  return (
    <form action="/explore" method="get" role="search" className="relative">
      <input type="hidden" name="u" value={universe} />
      {Object.entries(extra).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
      <label htmlFor="explore-q" className="sr-only">Rechercher</label>
      <input ref={ref} id="explore-q" name="q" defaultValue={q} maxLength={100} placeholder="Projet, compétence, ville, personne…" className="h-12 w-full rounded-2xl border border-border bg-card pl-10 pr-4 text-[15px] placeholder:text-subtle focus:border-primary-2 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]" />
    </form>
  );
}
