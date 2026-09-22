import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { LeadsBoard } from "@/components/crm/leads-board";
import type { Lead } from "@/lib/types";

export default async function LeadsPage({
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

  const { data: leads } = await supabase
    .from("leads")
    .select("*")
    .eq("project_id", project.id)
    .order("created_at", { ascending: false });

  return (
    <div className="flex h-screen flex-col">
      <div className="border-b border-border px-6 py-5">
        <h1 className="font-display text-2xl font-medium tracking-tight">Prospects</h1>
        <p className="mt-1 text-sm text-muted-foreground">Suivez vos prospects depuis leur arrivée jusqu'à la vente.</p>
      </div>
      <div className="min-h-0 flex-1">
        <LeadsBoard initialLeads={(leads ?? []) as Lead[]} />
      </div>
    </div>
  );
}
