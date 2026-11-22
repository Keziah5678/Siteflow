import type { Metadata } from "next";
import { requireContext } from "@/lib/auth/session";
import { PLANS, planLabel, type PlanId } from "@/lib/billing/plans";
import { stripeConfigured } from "@/lib/billing/stripe";
import { aiActionsThisMonth } from "@/lib/app/messages";
import { Flash, PageHeader, dateFr } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { checkoutAction, portalAction } from "../actions";

export const metadata: Metadata = { title: "Facturation" };

export default async function Billing({ searchParams }: PageProps<"/app/billing">) {
  const { ctx } = await requireContext();
  const sp = await searchParams;
  const sub = ctx.subscription;
  const paid = sub?.plan && ["active", "past_due", "trialing"].includes(sub.status);
  const ai = await aiActionsThisMonth(ctx.orgId);
  const admin = ctx.role !== "member";
  return (
    <>
      <PageHeader title="Facturation" />
      <Flash ok={sp.status === "success" ? "Merci ! Votre abonnement est en cours d'activation : il apparaît ici dès la confirmation de Stripe." : typeof sp.ok === "string" ? sp.ok : null} error={sp.status === "cancelled" ? "Paiement annulé : aucun montant n'a été prélevé." : typeof sp.error === "string" ? sp.error : null} />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card p-5"><p className="muted text-xs font-semibold uppercase tracking-wider">Formule actuelle</p><p className="mt-1 text-2xl font-bold">{planLabel(ctx.plan)}</p>
          <p className="muted mt-1 text-sm">{ctx.plan === "trial" ? `Essai jusqu'au ${dateFr(ctx.org.trialEndsAt)}` : sub?.status === "past_due" ? "Paiement en échec — Stripe réessaie automatiquement" : sub?.cancelAtPeriodEnd ? `Résiliée, active jusqu'au ${dateFr(sub.currentPeriodEnd)}` : sub?.currentPeriodEnd ? `Prochain renouvellement : ${dateFr(sub.currentPeriodEnd)}` : ""}</p></div>
        <div className="card p-5"><p className="muted text-xs font-semibold uppercase tracking-wider">Rédactions IA ce mois</p><p className="mt-1 text-2xl font-bold">{ai} / {ctx.limits.aiActionsPerMonth}</p><p className="muted mt-1 text-sm">Au-delà, les relances sont rédigées par le modèle RelancePro (sans coût IA).</p></div>
        <div className="card p-5"><p className="muted text-xs font-semibold uppercase tracking-wider">Factures et moyen de paiement</p>
          {sub?.stripeCustomerId && admin ? <form action={portalAction} className="mt-3"><SubmitButton className="btn">Ouvrir le portail de facturation</SubmitButton></form> : <p className="muted mt-2 text-sm">Disponible après la première souscription.</p>}
          <p className="muted mt-2 text-xs">Changement de formule, factures, carte, résiliation.</p></div>
      </div>
      {!paid && (
        <>
          <h2 className="mb-3 mt-8 font-semibold">Choisir une formule</h2>
          {!stripeConfigured() && <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">Le paiement en ligne n&apos;est pas encore activé sur cette instance. Contactez-nous pour souscrire.</div>}
          <div className="grid gap-4 md:grid-cols-3">
            {(Object.keys(PLANS) as PlanId[]).map(id => (
              <form key={id} action={checkoutAction} className="card flex flex-col p-5">
                <input type="hidden" name="plan" value={id} />
                <h3 className="font-bold">{PLANS[id].name}</h3><p className="mt-1 text-3xl font-bold">{PLANS[id].priceEuros} €<span className="muted text-sm font-normal"> HT / mois</span></p>
                <ul className="muted mt-3 flex-1 space-y-1 text-sm">{PLANS[id].features.map(f => <li key={f}>✓ {f}</li>)}</ul>
                <SubmitButton className={`btn mt-4 ${id === "pro" ? "btn-primary" : ""}`} disabled={!stripeConfigured() || !admin}>Souscrire</SubmitButton>
              </form>
            ))}
          </div>
          <p className="muted mt-3 text-xs">Paiement sécurisé par Stripe. Les jours d&apos;essai restants sont conservés. Sans engagement.</p>
        </>
      )}
    </>
  );
}
