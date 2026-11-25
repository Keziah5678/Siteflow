-- =============================================================================
-- VENTURE — Row Level Security & privileges
-- Principle: deny by default. Writes are granted per column, and policies
-- restrict rows. Anything sensitive goes through SECURITY DEFINER RPCs that
-- re-check permissions.
-- =============================================================================

-- Enable RLS everywhere
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Strip default write privileges; re-grant precisely below.
revoke insert, update, delete, truncate, references, trigger on all tables in schema public from anon, authenticated;
revoke select on public.rate_limit_hits, public.stripe_events, public.profile_private from anon;
revoke select on public.rate_limit_hits, public.stripe_events from authenticated;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy profiles_select on public.profiles for select using (
  visibility = 'public'
  or (auth.uid() is not null and visibility = 'members')
  or id = auth.uid()
);
create policy profiles_update_self on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
grant update (
  username, display_name, avatar_url, bio, skills, interests, ambitions, city, portfolio_url,
  availability, experience, visibility, is_discoverable, show_joined_projects, onboarded
) on public.profiles to authenticated;

-- profile_private: owner only
create policy profile_private_self_select on public.profile_private for select using (id = auth.uid());
create policy profile_private_self_update on public.profile_private for update
  using (id = auth.uid()) with check (id = auth.uid());
grant update (lat, lng, email_notifications) on public.profile_private to authenticated;

-- blocks: you see and manage only your own blocks
create policy blocks_select on public.blocks for select using (blocker_id = auth.uid());
create policy blocks_insert on public.blocks for insert with check (blocker_id = auth.uid());
create policy blocks_delete on public.blocks for delete using (blocker_id = auth.uid());
grant insert (blocker_id, blocked_id), delete on public.blocks to authenticated;

-- ---------------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------------
create policy projects_select on public.projects for select using (
  moderation = 'visible' or owner_id = auth.uid() or public.has_platform_role('moderator')
);
create policy projects_insert on public.projects for insert with check (
  owner_id = auth.uid() and public.is_active_user()
);
create policy projects_update on public.projects for update
  using (public.is_project_manager(id)) with check (public.is_project_manager(id));
create policy projects_delete on public.projects for delete using (owner_id = auth.uid());
grant insert (
  owner_id, title, description, category, status, goal, interest_goal, skills_needed, resources_needed,
  budget_estimate_cents, cover_url, city, lat, lng, is_remote
) on public.projects to authenticated;
grant update (
  title, description, category, status, goal, interest_goal, skills_needed, resources_needed,
  budget_estimate_cents, cover_url, city, lat, lng, is_remote
) on public.projects to authenticated;
grant delete on public.projects to authenticated;

-- members: visible on the project page, honouring "show_joined_projects"
create policy members_select on public.project_members for select using (
  public.is_project_member(project_id)
  or public.has_platform_role('moderator')
  or (
    public.can_view_project(project_id)
    and (role = 'owner' or exists (select 1 from public.profiles p where p.id = user_id and p.show_joined_projects))
  )
);
create policy members_update on public.project_members for update
  using (public.is_project_manager(project_id)) with check (public.is_project_manager(project_id));
create policy members_delete on public.project_members for delete using (
  user_id = auth.uid() or public.is_project_manager(project_id)
);
grant update (role, responsibility) on public.project_members to authenticated;
grant delete on public.project_members to authenticated;

-- event details
create policy event_details_select on public.event_details for select using (public.can_view_project(project_id));
create policy event_details_update on public.event_details for update
  using (public.is_project_manager(project_id)) with check (public.is_project_manager(project_id));
grant update (stage, venue_idea, capacity, price_min_cents, price_max_cents, date_options, confirmed_date)
  on public.event_details to authenticated;

-- organizer proposals: verified organizers only
create policy proposals_select on public.organizer_proposals for select using (
  organizer_id = auth.uid() or public.is_project_manager(project_id)
);
create policy proposals_insert on public.organizer_proposals for insert with check (
  organizer_id = auth.uid()
  and exists (select 1 from public.profiles where id = auth.uid() and is_verified_organizer and not is_suspended)
  and exists (select 1 from public.projects where id = project_id and category = 'event' and moderation = 'visible')
  and not public.is_project_manager(project_id)
);
grant insert (project_id, organizer_id, message, proposed_date, proposed_venue, proposed_price_cents)
  on public.organizer_proposals to authenticated;

-- engagements: individuals visible to themselves and the project team only
create policy engagements_select on public.project_engagements for select using (
  user_id = auth.uid() or public.is_project_manager(project_id)
);
create policy engagements_insert on public.project_engagements for insert with check (
  user_id = auth.uid() and public.is_active_user() and public.can_view_project(project_id)
  and not exists (select 1 from public.projects p where p.id = project_id and (p.status in ('completed', 'cancelled') or public.is_blocked_between(auth.uid(), p.owner_id)))
);
create policy engagements_delete on public.project_engagements for delete using (user_id = auth.uid());
grant insert (project_id, user_id, kind), delete on public.project_engagements to authenticated;

-- applications
create policy applications_select on public.applications for select using (
  applicant_id = auth.uid() or public.is_project_manager(project_id)
);
create policy applications_insert on public.applications for insert with check (
  applicant_id = auth.uid() and public.is_active_user()
  and not public.is_project_member(project_id)
  and exists (
    select 1 from public.projects p where p.id = project_id and p.moderation = 'visible'
      and p.status not in ('completed', 'cancelled') and not public.is_blocked_between(auth.uid(), p.owner_id)
  )
);
grant insert (project_id, applicant_id, skill, message) on public.applications to authenticated;

-- milestones: public read (progress is public), managers edit
create policy milestones_select on public.milestones for select using (public.can_view_project(project_id));
create policy milestones_insert on public.milestones for insert with check (public.is_project_manager(project_id));
create policy milestones_update on public.milestones for update
  using (public.is_project_manager(project_id)) with check (public.is_project_manager(project_id));
create policy milestones_delete on public.milestones for delete using (public.is_project_manager(project_id));
grant insert (project_id, title, description, position, due_date, done) on public.milestones to authenticated;
grant update (title, description, position, due_date, done) on public.milestones to authenticated;
grant delete on public.milestones to authenticated;

-- tasks: team only
create policy tasks_select on public.tasks for select using (public.is_project_member(project_id));
create policy tasks_insert on public.tasks for insert with check (
  public.is_project_member(project_id) and created_by = auth.uid()
);
create policy tasks_update on public.tasks for update
  using (public.is_project_member(project_id)) with check (public.is_project_member(project_id));
create policy tasks_delete on public.tasks for delete using (
  created_by = auth.uid() or public.is_project_manager(project_id)
);
grant insert (project_id, milestone_id, title, description, status, assignee_id, due_date, created_by) on public.tasks to authenticated;
grant update (milestone_id, title, description, status, assignee_id, due_date) on public.tasks to authenticated;
grant delete on public.tasks to authenticated;

-- updates (actualités): public read, managers post
create policy updates_select on public.project_updates for select using (public.can_view_project(project_id));
create policy updates_insert on public.project_updates for insert with check (
  author_id = auth.uid() and public.is_project_manager(project_id)
);
create policy updates_delete on public.project_updates for delete using (
  author_id = auth.uid() or public.is_project_manager(project_id)
);
grant insert (project_id, author_id, body), delete on public.project_updates to authenticated;

-- comments
create policy comments_select on public.comments for select using (
  (moderation = 'visible' and public.can_view_project(project_id))
  or author_id = auth.uid() or public.has_platform_role('moderator')
);
create policy comments_insert on public.comments for insert with check (
  author_id = auth.uid() and public.is_active_user() and public.can_view_project(project_id)
  and not exists (select 1 from public.projects p where p.id = project_id and public.is_blocked_between(auth.uid(), p.owner_id))
);
create policy comments_delete on public.comments for delete using (
  author_id = auth.uid() or public.is_project_manager(project_id)
);
grant insert (project_id, author_id, body), delete on public.comments to authenticated;

-- calendar & documents: team only
create policy calendar_select on public.calendar_events for select using (public.is_project_member(project_id));
create policy calendar_insert on public.calendar_events for insert with check (
  public.is_project_member(project_id) and created_by = auth.uid()
);
create policy calendar_delete on public.calendar_events for delete using (
  created_by = auth.uid() or public.is_project_manager(project_id)
);
grant insert (project_id, title, starts_at, ends_at, location, created_by), delete on public.calendar_events to authenticated;

create policy documents_select on public.project_documents for select using (public.is_project_member(project_id));
create policy documents_insert on public.project_documents for insert with check (
  public.is_project_member(project_id) and uploaded_by = auth.uid()
  and split_part(storage_path, '/', 1) = project_id::text
);
create policy documents_delete on public.project_documents for delete using (
  uploaded_by = auth.uid() or public.is_project_manager(project_id)
);
grant insert (project_id, name, storage_path, size_bytes, mime_type, uploaded_by), delete on public.project_documents to authenticated;

-- ---------------------------------------------------------------------------
-- messaging: participants only. Conversations are created through RPCs.
-- ---------------------------------------------------------------------------
create policy conversations_select on public.conversations for select using (public.is_conversation_participant(id));
create policy participants_select on public.conversation_participants for select using (
  public.is_conversation_participant(conversation_id)
);
create policy participants_leave on public.conversation_participants for delete using (
  user_id = auth.uid() and exists (select 1 from public.conversations c where c.id = conversation_id and c.kind = 'group')
);
grant delete on public.conversation_participants to authenticated;

create policy messages_select on public.messages for select using (public.is_conversation_participant(conversation_id));
create policy messages_insert on public.messages for insert with check (
  sender_id = auth.uid() and public.is_active_user() and public.is_conversation_participant(conversation_id)
);
grant insert (conversation_id, sender_id, body, attachment_path, attachment_name) on public.messages to authenticated;

create policy contacts_select on public.contact_requests for select using (from_id = auth.uid() or to_id = auth.uid());
create policy contacts_insert on public.contact_requests for insert with check (
  from_id = auth.uid() and public.is_active_user()
);
grant insert (from_id, to_id, message) on public.contact_requests to authenticated;

-- ---------------------------------------------------------------------------
-- notifications, reports, endorsements
-- ---------------------------------------------------------------------------
create policy notifications_select on public.notifications for select using (user_id = auth.uid());
create policy notifications_update on public.notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_delete on public.notifications for delete using (user_id = auth.uid());
grant update (read_at), delete on public.notifications to authenticated;

create policy reports_select on public.reports for select using (
  reporter_id = auth.uid() or public.has_platform_role('moderator')
);
create policy reports_insert on public.reports for insert with check (reporter_id = auth.uid());
grant insert (reporter_id, target_type, target_id, reason, details) on public.reports to authenticated;

create policy endorsements_select on public.endorsements for select using (true);
create policy endorsements_insert on public.endorsements for insert with check (
  author_id = auth.uid() and public.is_active_user()
  and public.is_project_member(project_id, author_id) and public.is_project_member(project_id, recipient_id)
);
create policy endorsements_delete on public.endorsements for delete using (author_id = auth.uid() or recipient_id = auth.uid());
grant insert (author_id, recipient_id, project_id, body), delete on public.endorsements to authenticated;

-- ---------------------------------------------------------------------------
-- opportunities (business accounts on the Business plan)
-- ---------------------------------------------------------------------------
create policy opportunities_select on public.opportunities for select using (
  (moderation = 'visible' and is_open) or company_id = auth.uid() or public.has_platform_role('moderator')
);
create policy opportunities_insert on public.opportunities for insert with check (
  company_id = auth.uid() and exists (
    select 1 from public.profiles where id = auth.uid() and account_type = 'business'
      and (plan = 'business' or platform_role >= 'admin') and not is_suspended
  )
);
create policy opportunities_update on public.opportunities for update
  using (company_id = auth.uid()) with check (company_id = auth.uid());
create policy opportunities_delete on public.opportunities for delete using (company_id = auth.uid());
grant insert (company_id, kind, title, description, skills, city, is_remote, compensation, related_project_id)
  on public.opportunities to authenticated;
grant update (kind, title, description, skills, city, is_remote, compensation, is_open) on public.opportunities to authenticated;
grant delete on public.opportunities to authenticated;

create policy opp_responses_select on public.opportunity_responses for select using (
  user_id = auth.uid() or exists (select 1 from public.opportunities o where o.id = opportunity_id and o.company_id = auth.uid())
);
create policy opp_responses_insert on public.opportunity_responses for insert with check (
  user_id = auth.uid() and public.is_active_user()
  and exists (select 1 from public.opportunities o where o.id = opportunity_id and o.is_open and o.moderation = 'visible' and o.company_id <> auth.uid())
);
grant insert (opportunity_id, user_id, message) on public.opportunity_responses to authenticated;

-- ---------------------------------------------------------------------------
-- monetisation, settings, logs
-- ---------------------------------------------------------------------------
create policy plan_settings_select on public.plan_settings for select using (true);
create policy plan_settings_update on public.plan_settings for update
  using (public.has_platform_role('admin')) with check (public.has_platform_role('admin'));
grant update (label, price_cents, ai_monthly_credits, features) on public.plan_settings to authenticated;

create policy app_settings_select on public.app_settings for select using (true);
create policy app_settings_update on public.app_settings for update
  using (public.has_platform_role('admin')) with check (public.has_platform_role('admin'));
grant update (value) on public.app_settings to authenticated;

create policy subscriptions_select on public.subscriptions for select using (
  user_id = auth.uid() or public.has_platform_role('admin')
);
create policy payments_select on public.payments for select using (
  user_id = auth.uid() or public.has_platform_role('admin')
);
create policy ai_usage_select on public.ai_usage for select using (
  user_id = auth.uid() or public.has_platform_role('admin')
);
create policy audit_select on public.admin_audit_log for select using (public.has_platform_role('admin'));
-- stripe_events / rate_limit_hits: no policies → service role only.

-- Internal helpers must not be callable from the API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.enforce_insert_rate() from public, anon, authenticated;
revoke execute on function public.clean_tags(text[], int) from anon;
