import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Explicit, application-level authorization checks — used by server actions
 * and API routes that perform their writes through the service-role client
 * (bypassing RLS) after already establishing the caller's identity via the
 * cookie-scoped client's `auth.getUser()`. RLS still protects every direct
 * client-side query; these checks stand in for it on the server-side write
 * paths that need to trust their own logic instead.
 */
export async function isWorkspaceMember(userId: string, workspaceId: string): Promise<boolean> {
  const db = createServiceRoleClient();
  const { data } = await db
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(data);
}

export async function isProjectMember(userId: string, projectId: string): Promise<boolean> {
  const db = createServiceRoleClient();
  const { data: project } = await db
    .from("projects")
    .select("workspace_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return false;
  return isWorkspaceMember(userId, project.workspace_id);
}
