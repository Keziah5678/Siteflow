import type { Metadata } from "next";
import { Check } from "lucide-react";
import { getViewer } from "@/lib/auth";
import { isStripeConfigured } from "@/lib/env";
import { getAppSettings } from "@/lib/queries";
import { formatEuros } from "@/lib/utils";
import { Page, PageHeader } from "@/components/layout/page";
import { Badge, Card, Notice } from "@/components/ui/primitives";
import { buttonClass } from "@/components/ui/button";
import Link from "next/link";

export const metadata: Metadata = { title: "Offres" };

export default async function PricingPage(props: PageProps<"/pricing">) {
  const sp = await props.searchParams;
  const { user, profile, supabase } = await getViewer();
  const [{ data: plans }, settings] = await Promise.all([supabase.from("plan_settings").select("*").order("price_cents"), getAppSettings()]);
  const stripeOn = isStripeConfigured();
  return (
    <Page wide>
      <PageHeader title="Offres VENTURE" description="L'essentiel de VENTURE est gratuit et le restera : publier, participer, échanger." />
      {sp.billing === "cancelled" && <Notice className="mb-5">Paiement annulé. Aucun montant n'a été débité.</Notice>}
      {!stripeOn && <Notice tone="warning" className="mb-5" title="Paiements pas encore activés">Les abonnements seront disponibles dès la configuration du prestataire de paiement. Toutes les fonctionnalités gratuites sont accessibles dès maintenant.</Notice>}
      <div className="grid gap-4 md:grid-cols-3">
        {(plans ?? []).map((p) => {
          const current = profile?.plan === p.plan;
          return (
            <Card key={p.plan} className={`flex flex-col p-6 ${p.plan === "plus" ? "border-primary/50 v-glow" : ""}`}>
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">{p.label}</h2>
                {current && <Badge tone="success">Offre actuelle</Badge>}
              </div>
              <p className="mt-4"><span className="text-3xl font-semibold tracking-tight">{p.price_cents === 0 ? "Gratuit" : formatEuros(p.price_cents)}</span>{p.price_cents > 0 && <span className="text-sm text-muted"> / mois</span>}</p>
              <p className="mt-1 text-[13px] text-subtle">{p.ai_monthly_credits} crédits VENTURE AI par mois</p>
              <ul className="mt-5 flex-1 space-y-2 text-sm">
                {p.features.map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-success" />{f}</li>)}
              </ul>
              <div className="mt-6">
                {p.plan === "free" ? (
                  !user && <Link href="/signup" className={buttonClass("secondary", "md", "w-full")}>Créer un compte</Link>
                ) : current ? null : !user ? (
                  <Link href="/login?next=/pricing" className={buttonClass(p.plan === "plus" ? "primary" : "secondary", "md", "w-full")}>Se connecter pour souscrire</Link>
                ) : stripeOn ? (
                  <form action="/api/stripe/checkout" method="post">
                    <input type="hidden" name="plan" value={p.plan} />
                    <button className={buttonClass(p.plan === "plus" ? "primary" : "secondary", "md", "w-full")}>Choisir {p.label.replace("VENTURE ", "")}</button>
                  </form>
                ) : (
                  <p className="text-center text-[13px] text-subtle">Bientôt disponible</p>
                )}
              </div>
            </Card>
          );
        })}
      </div>
      <div className="mt-8 grid gap-4 text-[13px] text-muted sm:grid-cols-2">
        <Card className="p-5">
          <p className="font-medium text-fg">Commissions</p>
          <p className="mt-1">Billetterie : {settings.ticketingCommission} % (à venir). Prestations réalisées via la plateforme : {settings.servicesCommission} % (à venir).</p>
        </Card>
        <Card className="p-5">
          <p className="font-medium text-fg">Financement participatif</p>
          <p className="mt-1">Les fonctionnalités de financement réglementé sont désactivées tant qu'un partenaire agréé et les validations nécessaires ne sont pas en place.</p>
        </Card>
      </div>
      <p className="mt-6 text-[12px] text-subtle">Prix TTC. Résiliable à tout moment depuis les paramètres. Les contenus sponsorisés et publicités sont toujours signalés comme tels. VENTURE ne vend jamais les données personnelles de ses membres.</p>
    </Page>
  );
}
