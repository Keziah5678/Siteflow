import { FolderKanban } from "lucide-react";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { StaggerGroup, StaggerItem } from "@/components/motion/Reveal";
import { EmptyState } from "@/components/ui/empty-state";
import { NewProjectDialog } from "@/components/dashboard/new-project-dialog";
import { ProjectCard } from "@/components/dashboard/project-card";
import type { Project } from "@/lib/types";

export default async function WorkspaceProjectsPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: workspaceSlug } = await params;
  const supabase = createServiceRoleClient();

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id")
    .eq("slug", workspaceSlug)
    .single();

  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .eq("workspace_id", workspace?.id)
    .order("created_at", { ascending: false });

  const list = (projects ?? []) as Project[];

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 lg:px-10">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-medium tracking-tight">Projets</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Chaque projet regroupe le profil business, le site, les prospects et les automatisations
            d'une activité.
          </p>
        </div>
        <NewProjectDialog workspaceSlug={workspaceSlug} />
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="Aucun projet pour le moment"
          description="Créez votre premier projet pour lancer le questionnaire intelligent et générer votre site."
          action={<NewProjectDialog workspaceSlug={workspaceSlug} />}
        />
      ) : (
        <StaggerGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((project) => (
            <StaggerItem key={project.id}>
              <ProjectCard project={project} workspaceSlug={workspaceSlug} />
            </StaggerItem>
          ))}
        </StaggerGroup>
      )}
    </div>
  );
}
