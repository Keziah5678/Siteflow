import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { FormsPanel } from "@/components/project/forms-panel";
import type { ProjectForm } from "@/lib/types";

export default async function FormsPage({
  params,
}: {
  params: Promise<{ workspace: string; project: string }>;
}) {
  const { workspace: workspaceSlug, project: projectSlug } = await params;
  const supabase = createServiceRoleClient();

  const { data: workspace } = await supabase.from("workspaces").select("id").eq("slug", workspaceSlug).maybeSingle();
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("workspace_id", workspace?.id)
    .eq("slug", projectSlug)
    .maybeSingle();
  if (!project) notFound();

  const { data: forms } = await supabase.from("forms").select("*").eq("project_id", project.id);

  return <FormsPanel projectId={project.id} initialForms={(forms ?? []) as ProjectForm[]} />;
}
