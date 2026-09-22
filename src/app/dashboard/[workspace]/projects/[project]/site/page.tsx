import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { SiteEditor } from "@/components/project/site-editor";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";
import { Globe } from "lucide-react";
import type { BusinessProfile, DesignSystem, Message, Page, ProjectForm, Section } from "@/lib/types";

export default async function SitePage({
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
    .select("id")
    .eq("workspace_id", workspace?.id)
    .eq("slug", projectSlug)
    .maybeSingle();
  if (!project) notFound();

  const { data: website } = await supabase
    .from("websites")
    .select("*")
    .eq("project_id", project.id)
    .maybeSingle();

  const [{ data: pages }, { data: designSystem }, { data: businessProfile }, { data: forms }] = await Promise.all([
    website
      ? supabase.from("pages").select("*, sections(*)").eq("website_id", website.id).order("nav_order")
      : Promise.resolve({ data: null }),
    supabase.from("design_systems").select("*").eq("project_id", project.id).maybeSingle<DesignSystem>(),
    supabase.from("business_profiles").select("*").eq("project_id", project.id).maybeSingle<BusinessProfile>(),
    supabase.from("forms").select("*").eq("project_id", project.id),
  ]);

  if (!website || !designSystem || !businessProfile || !pages || pages.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <EmptyState
          icon={Globe}
          title="Aucun site généré pour le moment"
          description="Complétez le profil business puis générez votre site depuis la page d'aperçu du projet."
          action={
            <LinkButton href={`/dashboard/${workspaceSlug}/projects/${projectSlug}`} variant="accent">
              Retour à l'aperçu du projet
            </LinkButton>
          }
        />
      </div>
    );
  }

  let conversationMessages: Message[] = [];
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id")
    .eq("project_id", project.id)
    .eq("type", "modification")
    .maybeSingle();
  if (conversation) {
    const { data: messages } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true });
    conversationMessages = (messages ?? []) as Message[];
  }

  const orderedPages = pages.map((p) => ({
    ...p,
    sections: [...(p.sections as Section[])].sort((a, b) => a.position - b.position),
  })) as (Page & { sections: Section[] })[];

  return (
    <SiteEditor
      projectId={project.id}
      pages={orderedPages}
      designSystem={designSystem}
      businessProfile={businessProfile}
      forms={(forms ?? []) as ProjectForm[]}
      initialMessages={conversationMessages}
    />
  );
}
