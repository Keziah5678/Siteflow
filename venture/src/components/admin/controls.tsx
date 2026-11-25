"use client";
import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Notice } from "@/components/ui/primitives";
import { moderateAction, resolveReportAction, updatePlanAction, updateSettingAction, updateUserAction } from "@/lib/actions/admin";

function useRunner() {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const run = (fn: () => Promise<{ error?: string } | null>) => start(async () => { const r = await fn(); setErr(r?.error ?? null); });
  return { pending, err, run };
}

export function ReportControls({ reportId, targetType, targetId, status, targetUserId }: { reportId: string; targetType: string; targetId: string; status: string; targetUserId: string | null }) {
  const { pending, err, run } = useRunner();
  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap gap-2">
        {status === "open" && <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => resolveReportAction(reportId, "reviewing"))}>Prendre en charge</Button>}
        <Button size="sm" variant="danger" disabled={pending} onClick={() => run(async () => { const r = await moderateAction(targetType, targetId, true); return r?.error ? r : resolveReportAction(reportId, "resolved", "Contenu masqué"); })}>
          {targetType === "profile" ? "Suspendre le compte" : targetType === "message" ? "Retirer le message" : "Masquer le contenu"}
        </Button>
        {targetUserId && targetType !== "profile" && (
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(async () => { const r = await updateUserAction(targetUserId, { suspended: true }); return r?.error ? r : resolveReportAction(reportId, "resolved", "Auteur suspendu"); })}>Suspendre l'auteur</Button>
        )}
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => resolveReportAction(reportId, "dismissed", "Aucune infraction"))}>Classer sans suite</Button>
      </div>
      {err && <p className="text-[12px] text-danger">{err}</p>}
    </div>
  );
}

export function ContentToggle({ type, id, hidden }: { type: string; id: string; hidden: boolean }) {
  const { pending, err, run } = useRunner();
  return (
    <span>
      <Button size="sm" variant={hidden ? "secondary" : "ghost"} disabled={pending} onClick={() => run(() => moderateAction(type, id, !hidden))}>{hidden ? "Rétablir" : "Masquer"}</Button>
      {err && <span className="ml-2 text-[12px] text-danger">{err}</span>}
    </span>
  );
}

export function UserControls({ userId, plan, verified, suspended, role, accountType, canAdmin, canRoles }: { userId: string; plan: string; verified: boolean; suspended: boolean; role: string; accountType: string; canAdmin: boolean; canRoles: boolean }) {
  const { pending, err, run } = useRunner();
  const sel = "h-8 rounded-lg border border-border bg-bg-2 px-2 text-[12px]";
  return (
    <div className="flex flex-wrap items-center gap-2">
      {canAdmin && (
        <>
          <label className="sr-only" htmlFor={`plan-${userId}`}>Offre</label>
          <select id={`plan-${userId}`} className={sel} defaultValue={plan} disabled={pending} onChange={(e) => run(() => updateUserAction(userId, { plan: e.target.value }))}>
            <option value="free">Free</option><option value="plus">Plus</option><option value="business">Business</option>
          </select>
          <label className="sr-only" htmlFor={`acct-${userId}`}>Type de compte</label>
          <select id={`acct-${userId}`} className={sel} defaultValue={accountType} disabled={pending} onChange={(e) => run(() => updateUserAction(userId, { accountType: e.target.value }))}>
            <option value="personal">Personnel</option><option value="business">Entreprise</option>
          </select>
          <Button size="sm" variant={verified ? "success" : "ghost"} disabled={pending} onClick={() => run(() => updateUserAction(userId, { verified: !verified }))}>{verified ? "Organisateur vérifié" : "Vérifier organisateur"}</Button>
        </>
      )}
      {canRoles && (
        <>
          <label className="sr-only" htmlFor={`role-${userId}`}>Rôle</label>
          <select id={`role-${userId}`} className={sel} defaultValue={role} disabled={pending} onChange={(e) => run(() => updateUserAction(userId, { role: e.target.value }))}>
            <option value="user">Utilisateur</option><option value="moderator">Modérateur</option><option value="admin">Admin</option><option value="superadmin">Super-admin</option>
          </select>
        </>
      )}
      <Button size="sm" variant={suspended ? "secondary" : "danger"} disabled={pending} onClick={() => run(() => updateUserAction(userId, { suspended: !suspended }))}>{suspended ? "Réactiver" : "Suspendre"}</Button>
      {err && <span className="text-[12px] text-danger">{err}</span>}
    </div>
  );
}

export function PlanEditor({ plan, label, priceCents, credits, features }: { plan: string; label: string; priceCents: number; credits: number; features: string[] }) {
  const [state, action] = useActionState(updatePlanAction, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="plan" value={plan} />
      <Field label="Nom" htmlFor={`l-${plan}`}><Input id={`l-${plan}`} name="label" defaultValue={label} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Prix mensuel (€)" htmlFor={`p-${plan}`}><Input id={`p-${plan}`} name="price_eur" type="number" step="0.01" min={0} defaultValue={priceCents / 100} /></Field>
        <Field label="Crédits IA / mois" htmlFor={`c-${plan}`}><Input id={`c-${plan}`} name="ai_monthly_credits" type="number" min={0} defaultValue={credits} /></Field>
      </div>
      <Field label="Avantages (un par ligne)" htmlFor={`f-${plan}`}><Textarea id={`f-${plan}`} name="features" rows={4} defaultValue={features.join("\n")} /></Field>
      {state?.error && <Notice tone="danger">{state.error}</Notice>}
      {state?.ok && <Notice tone="success">{state.message}</Notice>}
      <SubmitButton size="sm">Enregistrer</SubmitButton>
    </form>
  );
}

export function SettingControl({ k, value, kind }: { k: string; value: unknown; kind: "bool" | "number" | "locked" }) {
  const { pending, err, run } = useRunner();
  const [v, setV] = useState(value);
  if (kind === "locked") return <span className="text-[13px] text-subtle">Désactivé (partenaire agréé requis)</span>;
  return (
    <span className="flex items-center gap-2">
      {kind === "bool" ? (
        <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={v === true} disabled={pending} aria-label={k} onChange={(e) => { setV(e.target.checked); run(() => updateSettingAction(k, e.target.checked)); }} />
      ) : (
        <input type="number" className="h-8 w-24 rounded-lg border border-border bg-bg-2 px-2 text-sm" defaultValue={Number(v)} disabled={pending} aria-label={k} onBlur={(e) => run(() => updateSettingAction(k, Number(e.target.value)))} />
      )}
      {err && <span className="text-[12px] text-danger">{err}</span>}
    </span>
  );
}
