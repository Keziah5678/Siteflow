import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuditPanel } from "@/components/project/audit-panel";
import type { SeoAudit } from "@/lib/types";

export default async function AuditPage({
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

  const { data: audits } = await supabase
    .from("seo_audits")
    .select("*")
    .eq("project_id", project.id)
    .order("created_at", { ascending: false })
    .limit(1);

  return <AuditPanel projectId={project.id} initialAudit={(audits?.[0] as SeoAudit) ?? null} />;
}
