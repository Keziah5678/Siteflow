import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DesignEditor } from "@/components/project/design-editor";
import type { DesignSystem } from "@/lib/types";

export default async function DesignPage({
  params,
}: {
  params: Promise<{ workspace: string; project: string }>;
}) {
  const { workspace: workspaceSlug, project: projectSlug } = await params;
  const supabase = await createClient();

  const { data: workspace } = await supabase.from("workspaces").select("id").eq("slug", workspaceSlug).maybeSingle();
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("workspace_id", workspace?.id)
    .eq("slug", projectSlug)
    .maybeSingle();
  if (!project) notFound();

  const { data: designSystem } = await supabase
    .from("design_systems")
    .select("*")
    .eq("project_id", project.id)
    .maybeSingle<DesignSystem>();
  if (!designSystem) notFound();

  return <DesignEditor projectId={project.id} initial={designSystem} />;
}
