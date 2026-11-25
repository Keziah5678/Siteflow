"use client";
import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Chip input; submits values as a comma-separated hidden field. */
export function TagInput({ name, id, defaultValue = [], suggestions = [], max = 15, placeholder, onChange, value: controlled }: { name?: string; id?: string; defaultValue?: string[]; suggestions?: string[]; max?: number; placeholder?: string; onChange?: (v: string[]) => void; value?: string[] }) {
  const [inner, setInner] = useState<string[]>(defaultValue);
  const tags = controlled ?? inner;
  const [draft, setDraft] = useState("");
  const set = (v: string[]) => {
    if (!controlled) setInner(v);
    onChange?.(v);
  };
  function add(raw: string) {
    const t = raw.trim().replace(/,$/, "").slice(0, 40);
    if (!t || tags.length >= max || tags.some((x) => x.toLowerCase() === t.toLowerCase())) return;
    set([...tags, t]);
    setDraft("");
  }
  const remaining = suggestions.filter((s) => !tags.some((t) => t.toLowerCase() === s.toLowerCase())).slice(0, 8);
  return (
    <div>
      {name && <input type="hidden" name={name} value={tags.join(",")} />}
      <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-xl border border-border bg-bg-2 px-2 py-1.5 focus-within:border-primary-2 focus-within:ring-2 focus-within:ring-[var(--ring)]">
        {tags.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-lg bg-primary-soft py-1 pl-2.5 pr-1 text-[13px] text-fg">
            {t}
            <button type="button" onClick={() => set(tags.filter((x) => x !== t))} className="rounded p-0.5 text-muted hover:text-fg" aria-label={`Retirer ${t}`}>
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(e) => (e.target.value.endsWith(",") ? add(e.target.value) : setDraft(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
            } else if (e.key === "Backspace" && !draft && tags.length) set(tags.slice(0, -1));
          }}
          onBlur={() => draft && add(draft)}
          placeholder={tags.length ? "" : placeholder}
          className="h-8 min-w-[8rem] flex-1 bg-transparent px-1.5 text-sm placeholder:text-subtle focus:outline-none"
          disabled={tags.length >= max}
        />
      </div>
      {remaining.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {remaining.map((s) => (
            <button key={s} type="button" onClick={() => add(s)} className={cn("rounded-lg border border-dashed border-border px-2 py-1 text-[12px] text-muted hover:border-primary-2 hover:text-fg")}>
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
