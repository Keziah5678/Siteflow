-- ============================================================================
-- Fix infinite recursion in RLS policies (Postgres error 42P17).
--
-- "owners/admins can manage membership" (on workspace_members) queried
-- workspace_members from within its own USING/WITH CHECK clause without a
-- SECURITY DEFINER wrapper. Evaluating the policy re-triggers RLS on that
-- same subquery, which re-evaluates the policy, forever.
--
-- "owners/admins can update workspace" (on workspaces) had the same
-- indirect problem: its subquery against workspace_members is itself
-- subject to workspace_members' RLS, which hits the recursive policy above.
--
-- Fix: route both through a SECURITY DEFINER helper (same pattern already
-- used by is_workspace_member), which bypasses RLS internally instead of
-- re-entering it.
-- ============================================================================

create or replace function public.is_workspace_admin(target_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = target_workspace_id
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$;

drop policy if exists "owners/admins can update workspace" on public.workspaces;
create policy "owners/admins can update workspace"
  on public.workspaces for update
  using (public.is_workspace_admin(id));

drop policy if exists "owners/admins can manage membership" on public.workspace_members;
create policy "owners/admins can manage membership"
  on public.workspace_members for all
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));
