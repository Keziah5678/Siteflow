import type { Metadata } from "next";
import Link from "next/link";
import { requireViewer } from "@/lib/auth";
import { getQuota } from "@/lib/ai/service";
import { Page, PageHeader } from "@/components/layout/page";
import { Card, SectionTitle } from "@/components/ui/primitives";
import { ProfileForm } from "@/components/profile/profile-form";
import { AvatarUploader, BusinessPanel, DataPanel, PrivacyPanel } from "@/components/settings/panels";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { buttonClass } from "@/components/ui/button";

export const metadata: Metadata = { title: "Paramètres" };

const PLAN_LABEL = { free: "VENTURE Free", plus: "VENTURE Plus", business: "VENTURE Business" } as const;

export default async function SettingsPage() {
  const { user, profile, supabase } = await requireViewer("/settings");
  const [{ data: priv }, quota, { data: sub }] = await Promise.all([
    supabase.from("profile_private").select("lat, email_notifications, stripe_customer_id").eq("id", user.id).single(),
    getQuota(supabase),
    supabase.from("subscriptions").select("plan, status, current_period_end").eq("user_id", user.id).maybeSingle(),
  ]);
  return (
    <Page>
      <PageHeader title="Paramètres" description={user.email ?? undefined} />
      <div className="space-y-10">
        <section id="profile">
          <SectionTitle>Profil</SectionTitle>
          <Card className="space-y-6 p-5">
            <AvatarUploader userId={user.id} name={profile.display_name} src={profile.avatar_url} />
            <ProfileForm profile={profile} locationShared={priv?.lat != null} />
          </Card>
        </section>
        <section id="privacy">
          <SectionTitle>Confidentialité</SectionTitle>
          <Card className="p-5">
            <PrivacyPanel initial={{ visibility: profile.visibility, is_discoverable: profile.is_discoverable, show_joined_projects: profile.show_joined_projects, share_location: priv?.lat != null, email_notifications: priv?.email_notifications ?? true }} />
          </Card>
        </section>
        <section id="plan">
          <SectionTitle>Abonnement et crédits IA</SectionTitle>
          <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div>
              <p className="font-medium">{PLAN_LABEL[profile.plan]}</p>
              <p className="mt-0.5 text-[13px] text-muted">
                {quota ? `${quota.remaining}/${quota.monthly_credits} crédits IA restants ce mois-ci.` : ""}
                {sub?.current_period_end ? ` Renouvellement le ${new Date(sub.current_period_end).toLocaleDateString("fr-FR")}.` : ""}
              </p>
            </div>
            <div className="flex gap-2">
              {priv?.stripe_customer_id && (
                <form action="/api/stripe/portal" method="post"><button className={buttonClass("secondary", "sm")}>Gérer la facturation</button></form>
              )}
              <Link href="/pricing" className={buttonClass("primary", "sm")}>Voir les offres</Link>
            </div>
          </Card>
        </section>
        <section id="business">
          <SectionTitle>Compte professionnel</SectionTitle>
          <Card className="p-5"><BusinessPanel isBusiness={profile.account_type === "business"} company={profile.company_name} /></Card>
        </section>
        <section id="appearance">
          <SectionTitle>Apparence</SectionTitle>
          <Card className="p-5"><ThemeToggle withLabel /></Card>
        </section>
        <section id="data">
          <SectionTitle>Mes données</SectionTitle>
          <Card className="p-5"><DataPanel /></Card>
        </section>
      </div>
    </Page>
  );
}
