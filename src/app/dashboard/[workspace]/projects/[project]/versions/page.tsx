import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { VersionsPanel } from "@/components/project/versions-panel";

export default async function VersionsPage({
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

  const { data: website } = await supabase.from("websites").select("id").eq("project_id", project.id).maybeSingle();

  const { data: versions } = website
    ? await supabase
        .from("site_versions")
        .select("id, label, created_at")
        .eq("website_id", website.id)
        .order("created_at", { ascending: false })
    : { data: [] };

  return <VersionsPanel projectId={project.id} initialVersions={versions ?? []} />;
}
