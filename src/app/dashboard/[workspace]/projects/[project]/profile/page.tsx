import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileWizard } from "@/components/wizard/profile-wizard";
import type { BusinessProfile } from "@/lib/types";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ workspace: string; project: string }>;
}) {
  const { workspace: workspaceSlug, project: projectSlug } = await params;
  const supabase = await createClient();

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

  const { data: profile } = await supabase
    .from("business_profiles")
    .select("*")
    .eq("project_id", project.id)
    .maybeSingle<BusinessProfile>();
  if (!profile) notFound();

  return (
    <ProfileWizard
      projectId={project.id}
      overviewHref={`/dashboard/${workspaceSlug}/projects/${projectSlug}`}
      initialProfile={profile}
    />
  );
}
