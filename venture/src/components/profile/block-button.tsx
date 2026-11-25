"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban } from "lucide-react";
import { blockUserAction } from "@/lib/actions/social";

export function BlockButton({ userId, blocked }: { userId: string; blocked: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!blocked && !confirm("Bloquer cette personne ? Elle ne pourra plus t'écrire ni t'envoyer de demande de contact.")) return;
          start(async () => {
            const r = await blockUserAction(userId, !blocked);
            if (r?.error) setErr(r.error);
            router.refresh();
          });
        }}
        className="inline-flex items-center gap-1.5 text-[13px] text-subtle hover:text-danger"
      >
        <Ban className="size-3.5" /> {blocked ? "Débloquer" : "Bloquer"}
      </button>
      {err && <span className="text-[12px] text-danger">{err}</span>}
    </span>
  );
}
