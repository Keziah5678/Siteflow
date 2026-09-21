import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AutomationsPanel } from "@/components/project/automations-panel";
import type { Automation } from "@/lib/types";

export default async function AutomationsPage({
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

  const { data: automations } = await supabase
    .from("automations")
    .select("*")
    .eq("project_id", project.id)
    .order("created_at", { ascending: false });

  return <AutomationsPanel projectId={project.id} initial={(automations ?? []) as Automation[]} />;
}
