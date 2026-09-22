import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { AssistantTestPanel } from "@/components/project/assistant-test-panel";

export default async function AssistantPage({
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

  const { data: website } = await supabase.from("websites").select("status").eq("project_id", project.id).maybeSingle();

  return <AssistantTestPanel projectId={project.id} published={website?.status === "published"} />;
}
