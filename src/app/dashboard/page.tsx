import { redirect } from "next/navigation";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

export default async function DashboardIndexPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const db = createServiceRoleClient();
  const { data: memberships } = await db
    .from("workspace_members")
    .select("workspace:workspaces(slug)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1);

  const firstWorkspace = memberships?.[0]?.workspace as unknown as { slug: string } | null;

  if (!firstWorkspace) redirect("/dashboard/onboarding");
  redirect(`/dashboard/${firstWorkspace.slug}`);
}
