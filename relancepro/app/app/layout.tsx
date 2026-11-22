import Link from "next/link";
import { requireContext } from "@/lib/auth/session";
import { memberships } from "@/lib/auth/service";
import { withTenant } from "@/lib/db";
import { planLabel } from "@/lib/billing/plans";
import { Logo } from "@/components/ui";
import { ThemeToggle } from "@/components/client";
import { logoutAction } from "../(auth)/actions";
import { switchOrgAction } from "./actions";
import { NavLinks } from "./nav";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, ctx } = await requireContext();
  const orgs = await memberships(user.id);
  const [counts] = await withTenant(user.id, tx => tx`select
    (select count(*)::int from rp.messages where org_id = ${ctx.orgId} and status in ('draft','needs_review','blocked','failed')) as to_review,
    (select count(*)::int from rp.prospects where org_id = ${ctx.orgId} and status = 'to_follow_up') as to_follow`);
  const trialDays = Math.ceil((ctx.org.trialEndsAt.getTime() - Date.now()) / 86400_000);
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      <a href="#app-main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-black">Aller au contenu</a>
      <aside className="border-b line bg-[var(--surface)] lg:sticky lg:top-0 lg:h-dvh lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between px-4 py-4"><Link href="/app" aria-label="Tableau de bord"><Logo /></Link><span className="lg:hidden"><ThemeToggle /></span></div>
        <NavLinks toReview={Number(counts.toReview)} toFollow={Number(counts.toFollow)} isAdmin={user.isPlatformAdmin} />
        <div className="hidden space-y-3 border-t line p-4 lg:block">
          {orgs.length > 1 ? (
            <form action={switchOrgAction} className="flex gap-1">
              <select name="orgId" defaultValue={ctx.orgId} className="input py-1.5 text-xs" aria-label="Entreprise active">{orgs.map(o => <option key={o.id as string} value={o.id as string}>{o.name as string}</option>)}</select>
              <button className="btn btn-sm">OK</button>
            </form>
          ) : <p className="truncate text-sm font-semibold">{ctx.org.name}</p>}
          <p className="muted truncate text-xs">{user.email}</p>
          <div className="flex items-center gap-1"><ThemeToggle /><form action={logoutAction}><button className="btn btn-ghost btn-sm">Déconnexion</button></form></div>
        </div>
      </aside>
      <div className="min-w-0">
        {ctx.plan === "trial" && <div className="border-b line bg-brand-500/10 px-4 py-2 text-center text-sm">Essai gratuit : {Math.max(0, trialDays)} jour(s) restant(s). <Link href="/app/billing" className="font-semibold underline">Choisir une formule</Link></div>}
        {ctx.plan === "expired" && <div role="alert" className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">Votre essai est terminé : vos données sont conservées, mais les modifications sont suspendues. <Link href="/app/billing" className="font-semibold underline">Souscrire</Link></div>}
        {ctx.subscription?.status === "past_due" && <div role="alert" className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900">Le dernier paiement a échoué. <Link href="/app/billing" className="font-semibold underline">Mettre à jour le moyen de paiement</Link></div>}
        {ctx.org.automationPaused && <div role="status" className="border-b border-red-300 bg-red-50 px-4 py-2 text-center text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">Automatisations arrêtées : aucun envoi automatique ne partira. <Link href="/app/sequences" className="font-semibold underline">Gérer</Link></div>}
        <main id="app-main" className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
        <p className="muted pb-6 text-center text-xs">Formule : {planLabel(ctx.plan)} · <Link href="/aide" className="underline">Aide</Link></p>
      </div>
    </div>
  );
}
