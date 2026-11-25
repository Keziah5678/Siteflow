import { Sparkles } from "lucide-react";
import { Avatar } from "@/components/ui/primitives";
import { buttonClass } from "@/components/ui/button";

/** "Qu'aimerais-tu réaliser ?" — submits the idea to the creation flow. */
export function Composer({ name, avatar }: { name: string | null; avatar: string | null }) {
  return (
    <form action="/create" method="get" className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <label htmlFor="composer-idea" className="mb-3 block text-[15px] font-semibold tracking-tight">
        Qu'aimerais-tu réaliser ?
      </label>
      <div className="flex items-start gap-3">
        {name && <Avatar name={name} src={avatar} size={40} className="hidden sm:inline-flex" />}
        <textarea
          id="composer-idea"
          name="idea"
          rows={2}
          maxLength={2000}
          placeholder="Ex. : J'aimerais créer une marque de vêtements avec d'autres personnes."
          className="min-h-[52px] flex-1 resize-none rounded-xl border border-border bg-bg-2 px-3.5 py-3 text-sm placeholder:text-subtle focus:border-primary-2 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-[12px] text-subtle">VENTURE AI t'aide à le transformer en projet concret.</p>
        <button type="submit" className={buttonClass("primary", "sm")}>
          <Sparkles /> Commencer
        </button>
      </div>
    </form>
  );
}
