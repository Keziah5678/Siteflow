import { notFound } from "next/navigation";
import Link from "next/link";
import { UserSquare2, Globe, Users, Search } from "lucide-react";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { StaggerGroup, StaggerItem } from "@/components/motion/Reveal";
import { GenerateSiteCard } from "@/components/project/generate-site-card";
import type { BusinessProfile, Website } from "@/lib/types";

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ workspace: string; project: string }>;
}) {
  const { workspace: workspaceSlug, project: projectSlug } = await params;
  const supabase = createServiceRoleClient();

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id")
    .eq("slug", workspaceSlug)
    .maybeSingle();
  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("workspace_id", workspace?.id)
    .eq("slug", projectSlug)
    .maybeSingle();
  if (!project) notFound();

  const [{ data: profile }, { data: website }, { count: leadCount }] = await Promise.all([
    supabase.from("business_profiles").select("*").eq("project_id", project.id).maybeSingle<BusinessProfile>(),
    supabase.from("websites").select("*").eq("project_id", project.id).maybeSingle<Website>(),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("project_id", project.id),
  ]);

  const { count: pagesCount } = website
    ? await supabase.from("pages").select("id", { count: "exact", head: true }).eq("website_id", website.id)
    : { count: 0 };

  const base = `/dashboard/${workspaceSlug}/projects/${projectSlug}`;
  const completeness = profile?.completeness ?? 0;

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-6 py-10 lg:px-10">
      <div>
        <h1 className="font-display text-2xl font-medium tracking-tight">{project.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vue d'ensemble de votre projet : profil business, site et performance commerciale.
        </p>
      </div>

      <StaggerGroup className="grid gap-4 sm:grid-cols-3">
        <StaggerItem>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm text-muted-foreground">Profil business</CardTitle>
              <UserSquare2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="font-display text-3xl font-medium">{completeness}%</p>
              <p className="mt-1 text-xs text-muted-foreground">complété</p>
            </CardContent>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm text-muted-foreground">Pages publiées</CardTitle>
              <Globe className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="font-display text-3xl font-medium">{pagesCount ?? 0}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                statut : {website?.status === "published" ? "publié" : "brouillon"}
              </p>
            </CardContent>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm text-muted-foreground">Prospects</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="font-display text-3xl font-medium">{leadCount ?? 0}</p>
              <p className="mt-1 text-xs text-muted-foreground">total</p>
            </CardContent>
          </Card>
        </StaggerItem>
      </StaggerGroup>

      {completeness < 60 ? (
        <Card className="border-accent/30 bg-accent/5">
          <CardHeader>
            <CardTitle>Complétez votre profil business</CardTitle>
            <CardDescription>
              Répondez au questionnaire intelligent pour permettre à l'IA de générer un site fidèle à
              votre activité.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LinkButton href={`${base}/profile`} variant="accent">
              Continuer le questionnaire
            </LinkButton>
          </CardContent>
        </Card>
      ) : (
        <GenerateSiteCard
          projectId={project.id}
          hasPages={(pagesCount ?? 0) > 0}
          siteHref={`${base}/site`}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Accès rapide</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          <Link href={`${base}/seo`} className="flex items-center gap-2 rounded-[var(--radius-md)] border border-border p-3 text-sm hover:bg-surface-raised">
            <Search className="h-4 w-4 text-muted-foreground" /> SEO & référencement
          </Link>
          <Link href={`${base}/leads`} className="flex items-center gap-2 rounded-[var(--radius-md)] border border-border p-3 text-sm hover:bg-surface-raised">
            <Users className="h-4 w-4 text-muted-foreground" /> Gérer les prospects
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
