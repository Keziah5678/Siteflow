"use client";
import { useActionState, useState, useTransition } from "react";
import { BadgeCheck, CalendarDays, Check, Info, MapPin, Ticket, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Badge, Card, Notice } from "@/components/ui/primitives";
import { EVENT_STAGES, type EventStage } from "@/lib/constants";
import { formatDate, formatEuros } from "@/lib/utils";
import { proposeOrganizationAction, respondProposalAction, setEventStageAction } from "@/lib/actions/projects";

export type EventInfo = { stage: EventStage; venue_idea: string | null; capacity: number | null; price_min_cents: number | null; price_max_cents: number | null; date_options: string[]; confirmed_date: string | null };
export type Proposal = { id: string; message: string; proposed_date: string | null; proposed_venue: string | null; proposed_price_cents: number | null; status: string; organizer: { display_name: string; username: string } | null };

const stageTone: Record<EventStage, "primary" | "warning" | "success" | "danger"> = { proposed: "primary", preparing: "warning", confirmed: "success", cancelled: "danger" };

export function EventBlock({ projectId, event, proposals, isManager, isVerifiedOrganizer, hasProposed, signedIn }: { projectId: string; event: EventInfo; proposals: Proposal[]; isManager: boolean; isVerifiedOrganizer: boolean; hasProposed: boolean; signedIn: boolean }) {
  const [proposeOpen, setProposeOpen] = useState(false);
  const [stageOpen, setStageOpen] = useState(false);
  const [state, action] = useActionState(proposeOrganizationAction, null);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [stage, setStage] = useState<EventStage>(event.stage);
  const [confirmedDate, setConfirmedDate] = useState(event.confirmed_date ?? event.date_options[0] ?? "");
  const current = EVENT_STAGES.find((s) => s.value === event.stage)!;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold">
          <Ticket className="size-4 text-primary-2" /> Événement à la demande
        </h2>
        <Badge tone={stageTone[event.stage]}>{current.label}</Badge>
      </div>
      {/* Stage tracker */}
      <ol className="mt-4 grid grid-cols-3 gap-2" aria-label="Étapes de l'événement">
        {EVENT_STAGES.filter((s) => s.value !== "cancelled").map((s, i) => {
          const idx = ["proposed", "preparing", "confirmed"].indexOf(event.stage);
          const reached = event.stage !== "cancelled" && i <= idx;
          return (
            <li key={s.value} className={`rounded-lg border px-2.5 py-2 text-[12px] ${reached ? "border-primary/40 bg-primary-soft text-fg" : "border-border text-subtle"}`}>
              {s.label.replace("Événement ", "")}
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-[13px] text-muted">{current.description}</p>

      <dl className="mt-4 grid gap-3 text-[13px] sm:grid-cols-2">
        {event.venue_idea && (
          <div className="flex gap-2"><MapPin className="mt-0.5 size-3.5 shrink-0 text-subtle" /><div><dt className="text-subtle">Lieu envisagé</dt><dd>{event.venue_idea}</dd></div></div>
        )}
        {event.capacity && (
          <div className="flex gap-2"><Users className="mt-0.5 size-3.5 shrink-0 text-subtle" /><div><dt className="text-subtle">Capacité envisagée</dt><dd>{event.capacity} personnes</dd></div></div>
        )}
        {(event.price_min_cents != null || event.price_max_cents != null) && (
          <div className="flex gap-2"><Ticket className="mt-0.5 size-3.5 shrink-0 text-subtle" /><div><dt className="text-subtle">Prix indicatif</dt><dd>{event.price_min_cents != null && event.price_max_cents != null && event.price_min_cents !== event.price_max_cents ? `${formatEuros(event.price_min_cents)} – ${formatEuros(event.price_max_cents)}` : formatEuros(event.price_min_cents ?? event.price_max_cents)}</dd></div></div>
        )}
        {(event.confirmed_date || event.date_options.length > 0) && (
          <div className="flex gap-2"><CalendarDays className="mt-0.5 size-3.5 shrink-0 text-subtle" /><div><dt className="text-subtle">{event.confirmed_date ? "Date confirmée" : "Dates envisagées"}</dt><dd>{event.confirmed_date ? formatDate(event.confirmed_date) : event.date_options.map((d) => formatDate(d)).join(" · ")}</dd></div></div>
        )}
      </dl>

      <Notice className="mt-4">
        <span className="inline-flex items-start gap-1.5"><Info className="mt-0.5 size-3.5 shrink-0" />Manifester son intérêt ne constitue ni un achat ni une réservation. La billetterie sécurisée sera proposée une fois l'événement confirmé.</span>
      </Notice>

      {/* Organizer proposals */}
      {isManager && proposals.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-2 text-[13px] font-semibold">Propositions d'organisateurs vérifiés</h3>
          <ul className="space-y-2">
            {proposals.map((p) => (
              <li key={p.id} className="rounded-xl border border-border bg-bg-2 p-3 text-[13px]">
                <div className="flex items-center gap-2">
                  <BadgeCheck className="size-4 text-primary-2" />
                  <span className="font-medium">{p.organizer?.display_name}</span>
                  <Badge tone={p.status === "accepted" ? "success" : p.status === "declined" ? "danger" : "neutral"} className="ml-auto">
                    {p.status === "accepted" ? "Acceptée" : p.status === "declined" ? "Déclinée" : "En attente"}
                  </Badge>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-muted">{p.message}</p>
                <p className="mt-1 text-subtle">
                  {[p.proposed_venue, p.proposed_date && formatDate(p.proposed_date), p.proposed_price_cents != null && `${formatEuros(p.proposed_price_cents)} / pers.`].filter(Boolean).join(" · ")}
                </p>
                {p.status === "pending" && (
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" disabled={pending} onClick={() => start(async () => { const r = await respondProposalAction(p.id, true, projectId); setErr(r?.error ?? null); })}><Check /> Accepter</Button>
                    <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => { const r = await respondProposalAction(p.id, false, projectId); setErr(r?.error ?? null); })}><X /> Décliner</Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        {isManager && <Button size="sm" variant="secondary" onClick={() => setStageOpen(true)}>Mettre à jour l'étape</Button>}
        {!isManager && signedIn && isVerifiedOrganizer && event.stage !== "cancelled" && event.stage !== "confirmed" && (
          hasProposed || state?.ok ? <Badge tone="success"><Check /> Proposition envoyée</Badge> : <Button size="sm" variant="outline" onClick={() => setProposeOpen(true)}><BadgeCheck /> Proposer d'organiser</Button>
        )}
      </div>
      {!isManager && signedIn && !isVerifiedOrganizer && event.stage === "proposed" && (
        <p className="mt-3 text-[12px] text-subtle">Les organisateurs vérifiés peuvent proposer de concrétiser cet événement.</p>
      )}
      {err && <p className="mt-2 text-[12px] text-danger">{err}</p>}

      <Dialog open={proposeOpen} onClose={() => setProposeOpen(false)} title="Proposer d'organiser cet événement" description="Le créateur pourra accepter ta proposition. Tu rejoindras alors l'équipe en tant qu'organisateur.">
        {state?.ok ? (
          <Notice tone="success">{state.message}</Notice>
        ) : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="project_id" value={projectId} />
            <Field label="Ta proposition" htmlFor="pmsg" error={state?.fields?.message}>
              <Textarea id="pmsg" name="message" rows={4} minLength={10} maxLength={2000} required placeholder="Expérience, approche, conditions…" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Date proposée" htmlFor="pdate"><Input id="pdate" name="proposed_date" type="date" /></Field>
              <Field label="Lieu proposé" htmlFor="pvenue"><Input id="pvenue" name="proposed_venue" maxLength={200} /></Field>
              <Field label="Prix / pers. (€)" htmlFor="pprice"><Input id="pprice" name="proposed_price_eur" type="number" min={0} /></Field>
            </div>
            {state?.error && <Notice tone="danger">{state.error}</Notice>}
            <SubmitButton className="w-full">Envoyer la proposition</SubmitButton>
          </form>
        )}
      </Dialog>

      <Dialog open={stageOpen} onClose={() => setStageOpen(false)} title="Étape de l'événement" description="Les personnes intéressées et l'équipe sont notifiées à chaque changement.">
        <div className="space-y-4">
          <Field label="Étape" htmlFor="stage">
            <Select id="stage" value={stage} onChange={(e) => setStage(e.target.value as EventStage)}>
              {EVENT_STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
          </Field>
          {stage === "confirmed" && (
            <Field label="Date confirmée" htmlFor="cdate"><Input id="cdate" type="date" value={confirmedDate} onChange={(e) => setConfirmedDate(e.target.value)} /></Field>
          )}
          {err && <Notice tone="danger">{err}</Notice>}
          <Button className="w-full" disabled={pending} onClick={() => start(async () => { const r = await setEventStageAction(projectId, stage, confirmedDate || null); if (r?.error) setErr(r.error); else setStageOpen(false); })}>Enregistrer</Button>
        </div>
      </Dialog>
    </Card>
  );
}
