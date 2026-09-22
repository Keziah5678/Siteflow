import { createServiceRoleClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UpgradeButton } from "@/components/dashboard/upgrade-button";
import { initials } from "@/lib/utils";

export default async function WorkspaceSettingsPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: workspaceSlug } = await params;
  const supabase = createServiceRoleClient();

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name, slug, created_at")
    .eq("slug", workspaceSlug)
    .single();

  const { data: members } = await supabase
    .from("workspace_members")
    .select("role, user_id")
    .eq("workspace_id", workspace?.id);

  const { data: settings } = await supabase
    .from("settings")
    .select("billing")
    .eq("workspace_id", workspace?.id)
    .maybeSingle();

  const plan = (settings?.billing as { plan?: string } | undefined)?.plan ?? "free";
  const stripeConfigured = Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-10 lg:px-10">
      <div>
        <h1 className="font-display text-2xl font-medium tracking-tight">Paramètres</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Informations générales et facturation de l'espace de travail.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Espace de travail</CardTitle>
          <CardDescription>Identifiant : {workspace?.slug}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Nom : <span className="text-foreground">{workspace?.name}</span>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Membres</CardTitle>
          <CardDescription>Personnes ayant accès à cet espace de travail.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {(members ?? []).map((m) => (
            <div key={m.user_id} className="flex items-center justify-between rounded-[var(--radius-md)] border border-border px-3 py-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                  {initials(m.user_id.slice(0, 2))}
                </span>
                Utilisateur {m.user_id.slice(0, 8)}
              </div>
              <Badge tone={m.role === "owner" ? "accent" : "neutral"}>{m.role}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Facturation</CardTitle>
          <CardDescription>Gérée via Stripe.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Plan actuel : <Badge tone={plan === "pro" ? "accent" : "neutral"}>{plan === "pro" ? "Pro" : "Gratuit"}</Badge>
          </p>
          {stripeConfigured ? (
            plan !== "pro" && workspace ? (
              <UpgradeButton workspaceId={workspace.id} />
            ) : (
              <p>Abonnement actif.</p>
            )
          ) : (
            <p>
              Stripe n'est pas encore configuré. Renseignez <code className="rounded bg-surface-raised px-1">STRIPE_SECRET_KEY</code>,{" "}
              <code className="rounded bg-surface-raised px-1">STRIPE_WEBHOOK_SECRET</code>,{" "}
              <code className="rounded bg-surface-raised px-1">STRIPE_PRICE_ID_PRO</code> et{" "}
              <code className="rounded bg-surface-raised px-1">NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> pour activer les paiements.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
