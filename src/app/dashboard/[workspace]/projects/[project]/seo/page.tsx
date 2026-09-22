import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { SeoPanel } from "@/components/project/seo-panel";
import type { Page, Website } from "@/lib/types";

export default async function SeoPage({
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

  const { data: website } = await supabase
    .from("websites")
    .select("*")
    .eq("project_id", project.id)
    .maybeSingle<Website>();
  if (!website) notFound();

  const { data: pages } = await supabase
    .from("pages")
    .select("*")
    .eq("website_id", website.id)
    .order("nav_order");

  const headerList = await headers();
  const host = headerList.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";
  const publicOrigin = process.env.NEXT_PUBLIC_APP_URL || (host ? `${protocol}://${host}` : "");

  return (
    <SeoPanel projectId={project.id} website={website} pages={(pages ?? []) as Page[]} publicOrigin={publicOrigin} />
  );
}
