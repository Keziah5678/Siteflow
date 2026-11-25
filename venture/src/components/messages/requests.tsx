"use client";
import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Check, Plus, X } from "lucide-react";
import { Avatar, EmptyState, Notice, SectionTitle } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { createGroupAction, respondContactRequestAction } from "@/lib/actions/social";
import { timeAgo } from "@/lib/utils";

type Person = { username: string; display_name: string; avatar_url: string | null } | null;
export type RequestRow = { id: string; message: string | null; created_at: string; from_id: string; to_id: string; from: Person; to: Person };

export function ContactRequests({ incoming, outgoing }: { incoming: RequestRow[]; outgoing: RequestRow[] }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  if (incoming.length === 0 && outgoing.length === 0) return <EmptyState title="Aucune demande en attente" description="Les demandes de contact permettent d'échanger avec des personnes avec qui tu ne partages pas encore de projet." />;
  return (
    <div className="space-y-8">
      {err && <Notice tone="danger">{err}</Notice>}
      {incoming.length > 0 && (
        <section>
          <SectionTitle>Reçues</SectionTitle>
          <ul className="space-y-2">
            {incoming.map((r) => (
              <li key={r.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-3">
                  <Avatar name={r.from?.display_name ?? "?"} src={r.from?.avatar_url} size={36} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/u/${r.from?.username}`} className="text-sm font-medium hover:underline">{r.from?.display_name}</Link>
                    <p className="text-[12px] text-subtle">{timeAgo(r.created_at)}</p>
                  </div>
                </div>
                {r.message && <p className="mt-3 whitespace-pre-wrap text-[14px]">{r.message}</p>}
                <div className="mt-3 flex gap-2">
                  <Button size="sm" disabled={pending} onClick={() => start(async () => { const x = await respondContactRequestAction(r.id, true); setErr(x?.error ?? null); })}><Check /> Accepter</Button>
                  <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => { const x = await respondContactRequestAction(r.id, false); setErr(x?.error ?? null); })}><X /> Refuser</Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {outgoing.length > 0 && (
        <section>
          <SectionTitle>Envoyées</SectionTitle>
          <ul className="space-y-2">
            {outgoing.map((r) => (
              <li key={r.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5">
                <Avatar name={r.to?.display_name ?? "?"} src={r.to?.avatar_url} size={32} />
                <span className="flex-1 text-sm">{r.to?.display_name}</span>
                <span className="text-[12px] text-subtle">En attente · {timeAgo(r.created_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export function NewGroupButton({ contacts }: { contacts: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(createGroupAction, null);
  const [q, setQ] = useState("");
  const shown = contacts.filter((c) => c.name.toLowerCase().includes(q.toLowerCase())).slice(0, 50);
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)} disabled={contacts.length === 0} title={contacts.length === 0 ? "Aucun contact pour l'instant" : undefined}>
        <Plus /> Nouveau groupe
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Nouvelle conversation de groupe" description="Ajoute des personnes avec qui tu es en contact ou partages un projet.">
        <form action={action} className="space-y-4">
          <Field label="Nom du groupe" htmlFor="gtitle"><Input id="gtitle" name="title" required minLength={2} maxLength={80} /></Field>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrer…" aria-label="Filtrer les contacts" />
          <ul className="max-h-60 space-y-1 overflow-y-auto">
            {shown.map((c) => (
              <li key={c.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-bg-2">
                  <input type="checkbox" name="members" value={c.id} className="size-4 accent-[var(--primary)]" />
                  <span className="text-sm">{c.name}</span>
                </label>
              </li>
            ))}
          </ul>
          {state?.error && <Notice tone="danger">{state.error}</Notice>}
          <SubmitButton className="w-full">Créer le groupe</SubmitButton>
        </form>
      </Dialog>
    </>
  );
}
