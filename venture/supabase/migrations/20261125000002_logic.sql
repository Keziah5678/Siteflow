-- =============================================================================
-- VENTURE — triggers & RPCs (business rules enforced in the database)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Notifications helper
-- ---------------------------------------------------------------------------
create or replace function public.notify(
  p_user uuid, p_type text, p_title text, p_body text, p_link text, p_actor uuid default auth.uid()
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_user is null or p_user = p_actor then
    return;
  end if;
  insert into public.notifications (user_id, type, title, body, link, actor_id)
  values (p_user, p_type, left(p_title, 200), left(p_body, 500), p_link, p_actor);
end $$;
revoke execute on function public.notify(uuid, text, text, text, text, uuid) from public, anon, authenticated;

create or replace function public.actor_name(p uuid default auth.uid()) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select display_name from public.profiles where id = p), 'Quelqu''un')
$$;

-- ---------------------------------------------------------------------------
-- Rate limiting
-- ---------------------------------------------------------------------------
-- Trigger form: enforce_insert_rate(<owner column>, <max rows>, <window seconds>)
create or replace function public.enforce_insert_rate() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  col text := TG_ARGV[0];
  max_rows int := TG_ARGV[1]::int;
  window_s int := TG_ARGV[2]::int;
  owner uuid;
  recent int;
begin
  -- Service-role / admin maintenance (seeding, migrations) is not limited.
  if auth.uid() is null then
    return new;
  end if;
  execute format('select ($1).%I', col) into owner using new;
  execute format(
    'select count(*) from %I.%I where %I = $1 and created_at > now() - make_interval(secs => $2)',
    TG_TABLE_SCHEMA, TG_TABLE_NAME, col
  ) into recent using owner, window_s;
  if recent >= max_rows then
    raise exception 'VENTURE_RATE_LIMITED' using errcode = 'P0001',
      hint = format('max %s per %s s on %s', max_rows, window_s, TG_TABLE_NAME);
  end if;
  return new;
end $$;

create trigger rl_projects before insert on public.projects
  for each row execute function public.enforce_insert_rate('owner_id', '10', '86400');
create trigger rl_comments before insert on public.comments
  for each row execute function public.enforce_insert_rate('author_id', '30', '600');
create trigger rl_messages before insert on public.messages
  for each row execute function public.enforce_insert_rate('sender_id', '60', '60');
create trigger rl_applications before insert on public.applications
  for each row execute function public.enforce_insert_rate('applicant_id', '20', '3600');
create trigger rl_contacts before insert on public.contact_requests
  for each row execute function public.enforce_insert_rate('from_id', '20', '86400');
create trigger rl_reports before insert on public.reports
  for each row execute function public.enforce_insert_rate('reporter_id', '20', '86400');
create trigger rl_updates before insert on public.project_updates
  for each row execute function public.enforce_insert_rate('author_id', '20', '3600');
create trigger rl_opportunities before insert on public.opportunities
  for each row execute function public.enforce_insert_rate('company_id', '10', '86400');
create trigger rl_tasks before insert on public.tasks
  for each row execute function public.enforce_insert_rate('created_by', '120', '3600');

-- Used by API routes (service role only), e.g. signup attempts per IP.
create or replace function public.check_rate_limit(p_key text, p_max int, p_window_seconds int) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  delete from public.rate_limit_hits where hit_at < now() - interval '1 day';
  select count(*) into n from public.rate_limit_hits
    where key = p_key and hit_at > now() - make_interval(secs => p_window_seconds);
  if n >= p_max then
    return false;
  end if;
  insert into public.rate_limit_hits (key) values (p_key);
  return true;
end $$;
revoke execute on function public.check_rate_limit(text, int, int) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Projects lifecycle
-- ---------------------------------------------------------------------------
create or replace function public.on_project_created() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  conv uuid;
begin
  insert into public.project_members (project_id, user_id, role) values (new.id, new.owner_id, 'owner');
  insert into public.conversations (kind, project_id, title, created_by)
    values ('project', new.id, left(new.title, 80), new.owner_id) returning id into conv;
  insert into public.conversation_participants (conversation_id, user_id) values (conv, new.owner_id)
    on conflict do nothing;
  if new.category = 'event' then
    insert into public.event_details (project_id) values (new.id) on conflict do nothing;
  end if;
  return new;
end $$;
create trigger projects_after_insert after insert on public.projects
  for each row execute function public.on_project_created();

create or replace function public.on_project_updated() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  m record;
  labels jsonb := '{"idea":"Idée","recruiting":"Recherche de participants","preparing":"Préparation","in_progress":"En cours","completed":"Réalisé","cancelled":"Annulé"}';
begin
  if new.category = 'event' and old.category <> 'event' then
    insert into public.event_details (project_id) values (new.id) on conflict do nothing;
  end if;
  if new.status is distinct from old.status then
    for m in select user_id from public.project_members where project_id = new.id loop
      perform public.notify(m.user_id, 'project_status', 'Nouveau statut : ' || (labels ->> new.status::text),
        new.title, '/projects/' || new.id);
    end loop;
    if new.status = 'completed' then
      update public.profiles p set completed_projects_count = completed_projects_count + 1
        from public.project_members pm where pm.project_id = new.id and pm.user_id = p.id;
    elsif old.status = 'completed' then
      update public.profiles p set completed_projects_count = greatest(completed_projects_count - 1, 0)
        from public.project_members pm where pm.project_id = new.id and pm.user_id = p.id;
    end if;
  end if;
  if new.title is distinct from old.title then
    update public.conversations set title = left(new.title, 80) where project_id = new.id;
  end if;
  return new;
end $$;
create trigger projects_after_update after update on public.projects
  for each row execute function public.on_project_updated();

-- ---------------------------------------------------------------------------
-- Membership ↔ project conversation, counters, guards
-- ---------------------------------------------------------------------------
create or replace function public.on_member_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  conv uuid;
begin
  if TG_OP = 'INSERT' then
    select id into conv from public.conversations where project_id = new.project_id;
    if conv is not null then
      insert into public.conversation_participants (conversation_id, user_id) values (conv, new.user_id)
        on conflict do nothing;
    end if;
    update public.projects set member_count = (select count(*) from public.project_members where project_id = new.project_id)
      where id = new.project_id;
    return new;
  elsif TG_OP = 'DELETE' then
    select id into conv from public.conversations where project_id = old.project_id;
    delete from public.conversation_participants where conversation_id = conv and user_id = old.user_id;
    update public.projects set member_count = (select count(*) from public.project_members where project_id = old.project_id)
      where id = old.project_id;
    return old;
  end if;
  return null;
end $$;
create trigger project_members_after after insert or delete on public.project_members
  for each row execute function public.on_member_change();

-- The owner row is immutable through the API; admins cannot promote to owner.
create or replace function public.guard_member_update() returns trigger
language plpgsql as $$
begin
  if auth.uid() is null then
    return coalesce(new, old);
  end if;
  if TG_OP = 'DELETE' then
    if old.role = 'owner' and exists (select 1 from public.projects where id = old.project_id) then
      raise exception 'VENTURE_CANNOT_REMOVE_OWNER' using errcode = 'P0001';
    end if;
    return old;
  end if;
  if old.role = 'owner' and new.role <> 'owner' then
    raise exception 'VENTURE_CANNOT_DEMOTE_OWNER' using errcode = 'P0001';
  end if;
  if new.role = 'owner' and old.role <> 'owner' then
    raise exception 'VENTURE_CANNOT_PROMOTE_OWNER' using errcode = 'P0001';
  end if;
  if new.role = 'admin' and old.role <> 'admin' and public.project_role(new.project_id) <> 'owner' then
    raise exception 'VENTURE_ONLY_OWNER_PROMOTES' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger project_members_guard before update or delete on public.project_members
  for each row execute function public.guard_member_update();

-- ---------------------------------------------------------------------------
-- Engagements (interest / participation)
-- ---------------------------------------------------------------------------
create or replace function public.on_engagement_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  pid uuid := coalesce(new.project_id, old.project_id);
  k public.engagement_kind := coalesce(new.kind, old.kind);
  delta int := case when TG_OP = 'INSERT' then 1 else -1 end;
  proj record;
begin
  if k = 'interested' then
    update public.projects set interest_count = greatest(interest_count + delta, 0) where id = pid
      returning owner_id, title, interest_count, interest_goal into proj;
  else
    update public.projects set participant_count = greatest(participant_count + delta, 0) where id = pid
      returning owner_id, title, participant_count as interest_count, interest_goal into proj;
  end if;
  if TG_OP = 'INSERT' then
    perform public.notify(proj.owner_id,
      case when k = 'interested' then 'interest' else 'participation' end,
      public.actor_name() || case when k = 'interested' then ' est intéressé(e) par votre projet' else ' souhaite participer' end,
      proj.title, '/projects/' || pid);
  end if;
  return coalesce(new, old);
end $$;
create trigger project_engagements_after after insert or delete on public.project_engagements
  for each row execute function public.on_engagement_change();

-- ---------------------------------------------------------------------------
-- Applications ("Je peux aider")
-- ---------------------------------------------------------------------------
create or replace function public.on_application_created() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  m record;
  t text;
begin
  select title into t from public.projects where id = new.project_id;
  for m in select user_id from public.project_members where project_id = new.project_id and role in ('owner', 'admin') loop
    perform public.notify(m.user_id, 'application', public.actor_name() || ' propose son aide',
      coalesce(new.skill || ' — ', '') || t, '/projects/' || new.project_id || '/space?tab=team');
  end loop;
  return new;
end $$;
create trigger applications_after_insert after insert on public.applications
  for each row execute function public.on_application_created();

create or replace function public.decide_application(p_application uuid, p_accept boolean, p_responsibility text default null)
returns public.application_status
language plpgsql security definer set search_path = public as $$
declare
  a record;
  t text;
  new_status public.application_status := case when p_accept then 'accepted' else 'rejected' end;
begin
  select * into a from public.applications where id = p_application for update;
  if a is null then
    raise exception 'VENTURE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not public.is_project_manager(a.project_id) then
    raise exception 'VENTURE_FORBIDDEN' using errcode = '42501';
  end if;
  if a.status <> 'pending' then
    raise exception 'VENTURE_ALREADY_DECIDED' using errcode = 'P0001';
  end if;
  update public.applications set status = new_status, decided_by = auth.uid(), decided_at = now()
    where id = p_application;
  select title into t from public.projects where id = a.project_id;
  if p_accept then
    insert into public.project_members (project_id, user_id, role, responsibility)
      values (a.project_id, a.applicant_id, 'member', coalesce(left(p_responsibility, 120), a.skill))
      on conflict (project_id, user_id) do nothing;
    perform public.notify(a.applicant_id, 'application_accepted', 'Candidature acceptée', t,
      '/projects/' || a.project_id || '/space');
  else
    perform public.notify(a.applicant_id, 'application_rejected', 'Candidature non retenue', t,
      '/projects/' || a.project_id);
  end if;
  return new_status;
end $$;

create or replace function public.withdraw_application(p_application uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.applications set status = 'withdrawn', decided_at = now()
    where id = p_application and applicant_id = auth.uid() and status = 'pending';
  if not found then
    raise exception 'VENTURE_NOT_FOUND' using errcode = 'P0002';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Milestones → progress (derived from steps actually completed)
-- ---------------------------------------------------------------------------
create or replace function public.recount_milestones(p uuid) returns void
language sql security definer set search_path = public as $$
  update public.projects set
    milestones_total = (select count(*) from public.milestones where project_id = p),
    milestones_done = (select count(*) from public.milestones where project_id = p and done)
  where id = p;
$$;
revoke execute on function public.recount_milestones(uuid) from public, anon, authenticated;

create or replace function public.on_milestone_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  m record;
  t text;
begin
  perform public.recount_milestones(coalesce(new.project_id, old.project_id));
  if TG_OP = 'UPDATE' and new.done and not old.done then
    select title into t from public.projects where id = new.project_id;
    for m in select user_id from public.project_members where project_id = new.project_id loop
      perform public.notify(m.user_id, 'milestone_done', 'Étape terminée : ' || new.title, t,
        '/projects/' || new.project_id || '/space?tab=steps');
    end loop;
  end if;
  return coalesce(new, old);
end $$;
create trigger milestones_after after insert or update or delete on public.milestones
  for each row execute function public.on_milestone_change();

create or replace function public.stamp_milestone_done() returns trigger
language plpgsql as $$
begin
  if new.done and (TG_OP = 'INSERT' or not old.done) then
    new.done_at := now();
    new.done_by := auth.uid();
  elsif not new.done then
    new.done_at := null;
    new.done_by := null;
  end if;
  return new;
end $$;
create trigger milestones_stamp before insert or update on public.milestones
  for each row execute function public.stamp_milestone_done();

-- Any team member may tick a step; structure edits stay with managers (RLS).
create or replace function public.set_milestone_done(p_milestone uuid, p_done boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  pid uuid;
begin
  select project_id into pid from public.milestones where id = p_milestone;
  if pid is null then
    raise exception 'VENTURE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not public.is_project_member(pid) then
    raise exception 'VENTURE_FORBIDDEN' using errcode = '42501';
  end if;
  update public.milestones set done = p_done where id = p_milestone;
end $$;

-- ---------------------------------------------------------------------------
-- Tasks, comments, updates, proposals → notifications
-- ---------------------------------------------------------------------------
create or replace function public.on_task_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.assignee_id is not null and (TG_OP = 'INSERT' or new.assignee_id is distinct from old.assignee_id) then
    perform public.notify(new.assignee_id, 'task_assigned', 'Nouvelle tâche : ' || new.title,
      (select title from public.projects where id = new.project_id),
      '/projects/' || new.project_id || '/space?tab=tasks');
  end if;
  return new;
end $$;
create trigger tasks_after after insert or update on public.tasks
  for each row execute function public.on_task_change();

-- Assignees must be members of the project.
create or replace function public.guard_task_assignee() returns trigger
language plpgsql as $$
begin
  if new.assignee_id is not null and not public.is_project_member(new.project_id, new.assignee_id) then
    raise exception 'VENTURE_ASSIGNEE_NOT_MEMBER' using errcode = 'P0001';
  end if;
  if new.milestone_id is not null and not exists (
    select 1 from public.milestones where id = new.milestone_id and project_id = new.project_id
  ) then
    raise exception 'VENTURE_MILESTONE_MISMATCH' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger tasks_guard before insert or update on public.tasks
  for each row execute function public.guard_task_assignee();

create or replace function public.on_comment_created() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  p record;
begin
  select owner_id, title into p from public.projects where id = new.project_id;
  perform public.notify(p.owner_id, 'comment', public.actor_name() || ' a commenté', p.title,
    '/projects/' || new.project_id || '?tab=discussion');
  return new;
end $$;
create trigger comments_after_insert after insert on public.comments
  for each row execute function public.on_comment_created();

create or replace function public.on_update_posted() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  m record;
  t text;
begin
  select title into t from public.projects where id = new.project_id;
  for m in
    select user_id from public.project_members where project_id = new.project_id
    union
    select user_id from public.project_engagements where project_id = new.project_id
  loop
    perform public.notify(m.user_id, 'project_update', 'Actualité : ' || t, left(new.body, 140),
      '/projects/' || new.project_id);
  end loop;
  return new;
end $$;
create trigger project_updates_after_insert after insert on public.project_updates
  for each row execute function public.on_update_posted();

create or replace function public.on_proposal_created() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  p record;
begin
  select owner_id, title into p from public.projects where id = new.project_id;
  perform public.notify(p.owner_id, 'organizer_proposal', public.actor_name() || ' propose d''organiser votre événement',
    p.title, '/projects/' || new.project_id || '?tab=overview');
  return new;
end $$;
create trigger organizer_proposals_after_insert after insert on public.organizer_proposals
  for each row execute function public.on_proposal_created();

create or replace function public.respond_proposal(p_proposal uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  pr record;
  t text;
begin
  select * into pr from public.organizer_proposals where id = p_proposal for update;
  if pr is null then
    raise exception 'VENTURE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not public.is_project_manager(pr.project_id) then
    raise exception 'VENTURE_FORBIDDEN' using errcode = '42501';
  end if;
  if pr.status <> 'pending' then
    raise exception 'VENTURE_ALREADY_DECIDED' using errcode = 'P0001';
  end if;
  update public.organizer_proposals set status = case when p_accept then 'accepted'::public.proposal_status else 'declined'::public.proposal_status end
    where id = p_proposal;
  select title into t from public.projects where id = pr.project_id;
  if p_accept then
    -- The organizer joins the team as admin; the event moves to "en préparation".
    insert into public.project_members (project_id, user_id, role, responsibility)
      values (pr.project_id, pr.organizer_id, 'admin', 'Organisateur')
      on conflict (project_id, user_id) do update set role = 'admin', responsibility = 'Organisateur';
    update public.event_details set stage = 'preparing' where project_id = pr.project_id and stage = 'proposed';
    perform public.notify(pr.organizer_id, 'proposal_accepted', 'Proposition d''organisation acceptée', t,
      '/projects/' || pr.project_id || '/space');
  else
    perform public.notify(pr.organizer_id, 'proposal_declined', 'Proposition d''organisation déclinée', t,
      '/projects/' || pr.project_id);
  end if;
end $$;

create or replace function public.on_event_stage_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  m record;
  t text;
  labels jsonb := '{"proposed":"Événement proposé","preparing":"Événement en préparation","confirmed":"Événement confirmé","cancelled":"Événement annulé"}';
begin
  if new.stage is distinct from old.stage then
    select title into t from public.projects where id = new.project_id;
    for m in
      select user_id from public.project_engagements where project_id = new.project_id
      union select user_id from public.project_members where project_id = new.project_id
    loop
      perform public.notify(m.user_id, 'event_stage', labels ->> new.stage::text, t, '/projects/' || new.project_id);
    end loop;
  end if;
  return new;
end $$;
create trigger event_details_after_update after update on public.event_details
  for each row execute function public.on_event_stage_change();

-- ---------------------------------------------------------------------------
-- Messaging
-- ---------------------------------------------------------------------------
create or replace function public.are_contacts(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.contact_requests
    where status = 'accepted' and ((from_id = a and to_id = b) or (from_id = b and to_id = a))
  ) or exists (
    select 1 from public.project_members m1 join public.project_members m2 on m1.project_id = m2.project_id
    where m1.user_id = a and m2.user_id = b
  )
$$;

create or replace function public.get_or_create_direct_conversation(p_other uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  k text;
  conv uuid;
begin
  if me is null or p_other is null or me = p_other then
    raise exception 'VENTURE_INVALID' using errcode = '22023';
  end if;
  if not public.is_active_user() then
    raise exception 'VENTURE_FORBIDDEN' using errcode = '42501';
  end if;
  if public.is_blocked_between(me, p_other) then
    raise exception 'VENTURE_BLOCKED' using errcode = '42501';
  end if;
  if not public.are_contacts(me, p_other) then
    raise exception 'VENTURE_CONTACT_REQUIRED' using errcode = '42501';
  end if;
  k := least(me::text, p_other::text) || ':' || greatest(me::text, p_other::text);
  select id into conv from public.conversations where direct_key = k;
  if conv is null then
    insert into public.conversations (kind, direct_key, created_by) values ('direct', k, me) returning id into conv;
    insert into public.conversation_participants (conversation_id, user_id) values (conv, me), (conv, p_other);
  end if;
  return conv;
end $$;

create or replace function public.create_group_conversation(p_title text, p_members uuid[]) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  conv uuid;
  u uuid;
begin
  if me is null or not public.is_active_user() then
    raise exception 'VENTURE_FORBIDDEN' using errcode = '42501';
  end if;
  if coalesce(array_length(p_members, 1), 0) < 1 or array_length(p_members, 1) > 50 then
    raise exception 'VENTURE_INVALID' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_title, ''))) not between 2 and 80 then
    raise exception 'VENTURE_INVALID_TITLE' using errcode = '22023';
  end if;
  foreach u in array p_members loop
    if u <> me and (not public.are_contacts(me, u) or public.is_blocked_between(me, u)) then
      raise exception 'VENTURE_CONTACT_REQUIRED' using errcode = '42501';
    end if;
  end loop;
  insert into public.conversations (kind, title, created_by) values ('group', btrim(p_title), me) returning id into conv;
  insert into public.conversation_participants (conversation_id, user_id)
    select conv, x from (select unnest(p_members || me) as x) s group by x;
  return conv;
end $$;

create or replace function public.mark_conversation_read(p_conversation uuid) returns void
language sql security definer set search_path = public as $$
  update public.conversation_participants set last_read_at = now()
  where conversation_id = p_conversation and user_id = auth.uid();
$$;

create or replace function public.guard_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  c record;
  other uuid;
begin
  select * into c from public.conversations where id = new.conversation_id;
  if c.kind = 'direct' then
    select user_id into other from public.conversation_participants
      where conversation_id = c.id and user_id <> new.sender_id limit 1;
    if public.is_blocked_between(new.sender_id, other) then
      raise exception 'VENTURE_BLOCKED' using errcode = '42501';
    end if;
  end if;
  if new.attachment_path is not null and split_part(new.attachment_path, '/', 1) <> new.conversation_id::text then
    raise exception 'VENTURE_INVALID_ATTACHMENT' using errcode = '22023';
  end if;
  return new;
end $$;
create trigger messages_guard before insert on public.messages
  for each row execute function public.guard_message();

create or replace function public.on_message_created() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  p record;
  c record;
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id
    returning * into c;
  update public.conversation_participants set last_read_at = new.created_at
    where conversation_id = new.conversation_id and user_id = new.sender_id;
  -- One unread "message" notification per conversation per recipient (no spam).
  for p in
    select cp.user_id from public.conversation_participants cp
    where cp.conversation_id = new.conversation_id and cp.user_id <> new.sender_id
      and not public.is_blocked_between(cp.user_id, new.sender_id)
      and not exists (
        select 1 from public.notifications n
        where n.user_id = cp.user_id and n.type = 'message' and n.read_at is null
          and n.link = '/messages/' || new.conversation_id
      )
  loop
    perform public.notify(p.user_id, 'message',
      case when c.kind = 'direct' then 'Nouveau message de ' || public.actor_name(new.sender_id)
           else 'Nouveau message dans « ' || coalesce(c.title, 'Groupe') || ' »' end,
      left(new.body, 140), '/messages/' || new.conversation_id, new.sender_id);
  end loop;
  return new;
end $$;
create trigger messages_after_insert after insert on public.messages
  for each row execute function public.on_message_created();

-- Contact requests
create or replace function public.guard_contact_request() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_blocked_between(new.from_id, new.to_id) then
    raise exception 'VENTURE_BLOCKED' using errcode = '42501';
  end if;
  if public.are_contacts(new.from_id, new.to_id) then
    raise exception 'VENTURE_ALREADY_CONTACTS' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger contact_requests_guard before insert on public.contact_requests
  for each row execute function public.guard_contact_request();

create or replace function public.on_contact_request_created() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.notify(new.to_id, 'contact_request', public.actor_name() || ' souhaite échanger avec vous',
    new.message, '/messages?tab=requests');
  return new;
end $$;
create trigger contact_requests_after_insert after insert on public.contact_requests
  for each row execute function public.on_contact_request_created();

create or replace function public.respond_contact_request(p_request uuid, p_accept boolean) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  r record;
  conv uuid;
begin
  select * into r from public.contact_requests where id = p_request for update;
  if r is null or r.to_id <> auth.uid() then
    raise exception 'VENTURE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if r.status <> 'pending' then
    raise exception 'VENTURE_ALREADY_DECIDED' using errcode = 'P0001';
  end if;
  update public.contact_requests
    set status = case when p_accept then 'accepted'::public.contact_status else 'declined'::public.contact_status end,
        responded_at = now()
    where id = p_request;
  if p_accept then
    conv := public.get_or_create_direct_conversation(r.from_id);
    update public.contact_requests set conversation_id = conv where id = p_request;
    if coalesce(btrim(r.message), '') <> '' then
      insert into public.messages (conversation_id, sender_id, body) values (conv, r.from_id, r.message);
    end if;
    perform public.notify(r.from_id, 'contact_accepted', public.actor_name() || ' a accepté votre demande',
      null, '/messages/' || conv);
  end if;
  return conv;
end $$;

-- Blocking removes pending contact requests in both directions.
create or replace function public.on_block_created() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.contact_requests set status = 'declined', responded_at = now()
    where status = 'pending'
      and ((from_id = new.blocker_id and to_id = new.blocked_id) or (from_id = new.blocked_id and to_id = new.blocker_id));
  return new;
end $$;
create trigger blocks_after_insert after insert on public.blocks
  for each row execute function public.on_block_created();

-- ---------------------------------------------------------------------------
-- Search & matching
-- ---------------------------------------------------------------------------
create or replace function public.search_projects(
  p_query text, p_category public.project_category default null, p_limit int default 30
) returns setof public.projects
language sql stable security invoker set search_path = public, extensions as $$
  select p.* from public.projects p
  where p.moderation = 'visible'
    and (p_category is null or p.category = p_category)
    and (
      coalesce(btrim(p_query), '') = ''
      or p.search @@ websearch_to_tsquery('simple', p_query)
      or p.title ilike '%' || p_query || '%'
      or similarity(p.title, p_query) > 0.25
      or exists (select 1 from unnest(p.skills_needed) s where s ilike p_query)
    )
  order by
    case when coalesce(btrim(p_query), '') = '' then 0
         else ts_rank(p.search, websearch_to_tsquery('simple', p_query)) + similarity(p.title, p_query) end desc,
    p.created_at desc
  limit least(greatest(p_limit, 1), 100)
$$;

-- Candidate pool for matching. Only project managers may ask, only
-- discoverable, non-suspended, non-blocked people are returned, and the
-- caller never sees coordinates — only a rounded distance in km.
create or replace function public.matching_candidates(p_project uuid, p_limit int default 200)
returns table (
  id uuid, username text, display_name text, avatar_url text, bio text,
  skills text[], interests text[], ambitions text[], city text,
  availability public.availability, experience public.experience_level,
  completed_projects_count int, distance_km int, is_interested boolean, has_applied boolean
)
language plpgsql stable security definer set search_path = public as $$
declare
  proj record;
begin
  if not public.is_project_manager(p_project) then
    raise exception 'VENTURE_FORBIDDEN' using errcode = '42501';
  end if;
  select * into proj from public.projects where projects.id = p_project;
  return query
  select pr.id, pr.username, pr.display_name, pr.avatar_url, pr.bio,
         pr.skills, pr.interests, pr.ambitions, pr.city, pr.availability, pr.experience,
         pr.completed_projects_count,
         case when proj.lat is null or pp.lat is null then null
              else round(6371 * 2 * asin(sqrt(
                power(sin(radians(pp.lat - proj.lat) / 2), 2) +
                cos(radians(proj.lat)) * cos(radians(pp.lat)) * power(sin(radians(pp.lng - proj.lng) / 2), 2)
              )))::int end,
         exists (select 1 from public.project_engagements e where e.project_id = p_project and e.user_id = pr.id),
         exists (select 1 from public.applications a where a.project_id = p_project and a.applicant_id = pr.id and a.status = 'pending')
  from public.profiles pr
  left join public.profile_private pp on pp.id = pr.id
  where pr.is_discoverable and not pr.is_suspended and pr.onboarded
    and pr.availability <> 'unavailable'
    and not public.is_project_member(p_project, pr.id)
    and not public.is_blocked_between(auth.uid(), pr.id)
  order by (pr.skills && proj.skills_needed) desc, pr.updated_at desc
  limit least(greatest(p_limit, 1), 500);
end $$;

-- Distance from the caller to each project (for "À proximité"), without
-- revealing the caller's own coordinates to anyone else.
create or replace function public.projects_near_me(p_radius_km int default 50, p_limit int default 50)
returns table (project_id uuid, distance_km int)
language plpgsql stable security definer set search_path = public as $$
declare
  me record;
begin
  select lat, lng into me from public.profile_private where id = auth.uid();
  if me.lat is null then
    return;
  end if;
  return query
  select p.id, d.km from public.projects p,
    lateral (select round(6371 * 2 * asin(sqrt(
      power(sin(radians(p.lat - me.lat) / 2), 2) +
      cos(radians(me.lat)) * cos(radians(p.lat)) * power(sin(radians(p.lng - me.lng) / 2), 2)
    )))::int as km) d
  where p.lat is not null and p.moderation = 'visible' and p.status not in ('cancelled')
    and d.km <= p_radius_km
  order by d.km asc, p.created_at desc
  limit least(greatest(p_limit, 1), 200);
end $$;

-- ---------------------------------------------------------------------------
-- AI quota
-- ---------------------------------------------------------------------------
create or replace function public.ai_quota(p_user uuid default auth.uid())
returns table (plan public.plan_tier, monthly_credits int, used int, remaining int)
language sql stable security definer set search_path = public as $$
  select pr.plan, ps.ai_monthly_credits,
    coalesce((select sum(credits)::int from public.ai_usage u where u.user_id = pr.id and u.created_at >= date_trunc('month', now())), 0),
    greatest(ps.ai_monthly_credits - coalesce((select sum(credits)::int from public.ai_usage u where u.user_id = pr.id and u.created_at >= date_trunc('month', now())), 0), 0)
  from public.profiles pr join public.plan_settings ps on ps.plan = pr.plan
  where pr.id = p_user and (p_user = auth.uid() or public.has_platform_role('admin') or auth.uid() is null)
$$;

-- ---------------------------------------------------------------------------
-- Aggregated statistics (no personal data)
-- ---------------------------------------------------------------------------
create or replace function public.community_demand_stats()
returns table (dimension text, label text, count bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.has_platform_role('admin') or exists (
    select 1 from public.profiles where id = auth.uid() and account_type = 'business' and plan = 'business' and not is_suspended
  )) then
    raise exception 'VENTURE_PLAN_REQUIRED' using errcode = '42501';
  end if;
  return query
    select 'category'::text, p.category::text, count(*) from public.projects p
      where p.moderation = 'visible' and not p.is_demo and p.status not in ('cancelled', 'completed')
      group by p.category
    union all
    select 'skill', lower(s), count(*) from public.projects p, unnest(p.skills_needed) s
      where p.moderation = 'visible' and not p.is_demo and p.status not in ('cancelled', 'completed')
      group by lower(s) having count(*) >= 1
    union all
    select 'city', p.city, count(*) from public.projects p
      where p.city is not null and p.moderation = 'visible' and not p.is_demo and p.status not in ('cancelled', 'completed')
      group by p.city having count(*) >= 3  -- k-anonymity threshold for locations
    union all
    select 'event_interest', 'total', coalesce(sum(p.interest_count), 0)::bigint from public.projects p
      where p.category = 'event' and not p.is_demo and p.moderation = 'visible';
end $$;

create or replace function public.admin_stats()
returns table (metric text, value bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_platform_role('admin') then
    raise exception 'VENTURE_FORBIDDEN' using errcode = '42501';
  end if;
  return query
    select 'users', count(*) from public.profiles
    union all select 'users_business', count(*) from public.profiles where account_type = 'business'
    union all select 'projects', count(*) from public.projects where not is_demo
    union all select 'projects_completed', count(*) from public.projects where status = 'completed' and not is_demo
    union all select 'applications', count(*) from public.applications
    union all select 'messages', count(*) from public.messages
    union all select 'reports_open', count(*) from public.reports where status in ('open', 'reviewing')
    union all select 'subscriptions_active', count(*) from public.subscriptions where status in ('active', 'trialing')
    union all select 'ai_credits_month', coalesce(sum(credits), 0)::bigint from public.ai_usage where created_at >= date_trunc('month', now());
end $$;

-- ---------------------------------------------------------------------------
-- Moderation & administration (audited)
-- ---------------------------------------------------------------------------
create or replace function public.log_admin(p_action text, p_type text, p_id text, p_details jsonb default null) returns void
language sql security definer set search_path = public as $$
  insert into public.admin_audit_log (actor_id, action, target_type, target_id, details)
  values (auth.uid(), p_action, p_type, p_id, p_details);
$$;
revoke execute on function public.log_admin(text, text, text, jsonb) from public, anon, authenticated;

create or replace function public.moderate_content(p_type public.report_target, p_id uuid, p_hide boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  st public.moderation_state := case when p_hide then 'hidden'::public.moderation_state else 'visible'::public.moderation_state end;
begin
  if not public.has_platform_role('moderator') then
    raise exception 'VENTURE_FORBIDDEN' using errcode = '42501';
  end if;
  case p_type
    when 'project' then update public.projects set moderation = st where id = p_id;
    when 'comment' then update public.comments set moderation = st where id = p_id;
    when 'opportunity' then update public.opportunities set moderation = st where id = p_id;
    when 'message' then
      if p_hide then update public.messages set body = '[message retiré par la modération]', attachment_path = null, attachment_name = null where id = p_id; end if;
    when 'profile' then update public.profiles set is_suspended = p_hide where id = p_id and platform_role < 'admin';
  end case;
  perform public.log_admin(case when p_hide then 'hide' else 'restore' end, p_type::text, p_id::text);
end $$;

create or replace function public.resolve_report(p_report uuid, p_status public.report_status, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_platform_role('moderator') then
    raise exception 'VENTURE_FORBIDDEN' using errcode = '42501';
  end if;
  update public.reports set status = p_status, resolution_note = left(p_note, 1000),
    resolved_by = case when p_status in ('resolved', 'dismissed') then auth.uid() end,
    resolved_at = case when p_status in ('resolved', 'dismissed') then now() end
  where id = p_report;
  perform public.log_admin('report_' || p_status::text, 'report', p_report::text, jsonb_build_object('note', p_note));
end $$;

create or replace function public.admin_update_user(
  p_user uuid,
  p_plan public.plan_tier default null,
  p_verified_organizer boolean default null,
  p_suspended boolean default null,
  p_role public.platform_role default null,
  p_account_type public.account_type default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  target record;
begin
  select * into target from public.profiles where id = p_user;
  if target is null then
    raise exception 'VENTURE_NOT_FOUND' using errcode = 'P0002';
  end if;
  -- Suspension: moderators+, but never on staff of equal or higher rank.
  if p_suspended is not null then
    if not public.has_platform_role('moderator') or target.platform_role >= 'moderator' and not public.has_platform_role('superadmin') then
      raise exception 'VENTURE_FORBIDDEN' using errcode = '42501';
    end if;
  end if;
  if (p_plan is not null or p_verified_organizer is not null or p_account_type is not null) and not public.has_platform_role('admin') then
    raise exception 'VENTURE_FORBIDDEN' using errcode = '42501';
  end if;
  if p_role is not null and (not public.has_platform_role('superadmin') or p_user = auth.uid()) then
    raise exception 'VENTURE_FORBIDDEN' using errcode = '42501';
  end if;
  update public.profiles set
    plan = coalesce(p_plan, plan),
    is_verified_organizer = coalesce(p_verified_organizer, is_verified_organizer),
    is_suspended = coalesce(p_suspended, is_suspended),
    platform_role = coalesce(p_role, platform_role),
    account_type = coalesce(p_account_type, account_type)
  where id = p_user;
  perform public.log_admin('update_user', 'profile', p_user::text, jsonb_build_object(
    'plan', p_plan, 'verified_organizer', p_verified_organizer, 'suspended', p_suspended, 'role', p_role, 'account_type', p_account_type));
end $$;

create or replace function public.audit_settings_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.log_admin('update_' || TG_TABLE_NAME, TG_TABLE_NAME,
    coalesce(to_jsonb(new) ->> 'plan', to_jsonb(new) ->> 'key'),
    jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new)));
  return new;
end $$;
create trigger plan_settings_audit after update on public.plan_settings
  for each row execute function public.audit_settings_change();
create trigger app_settings_audit after update on public.app_settings
  for each row execute function public.audit_settings_change();

-- Business accounts: a user may convert their own account to "business".
-- Publishing opportunities additionally requires the Business plan (RLS).
create or replace function public.become_business(p_company text, p_website text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if length(btrim(coalesce(p_company, ''))) not between 2 and 80 then
    raise exception 'VENTURE_INVALID' using errcode = '22023';
  end if;
  if p_website is not null and p_website !~ '^https?://' then
    raise exception 'VENTURE_INVALID_URL' using errcode = '22023';
  end if;
  update public.profiles set account_type = 'business', company_name = btrim(p_company), company_website = p_website
    where id = auth.uid();
end $$;

create or replace function public.on_opportunity_response() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  o record;
begin
  select company_id, title into o from public.opportunities where id = new.opportunity_id;
  perform public.notify(o.company_id, 'opportunity_response', public.actor_name() || ' a répondu à votre opportunité', o.title, '/business?tab=responses');
  return new;
end $$;
create trigger opportunity_responses_after_insert after insert on public.opportunity_responses
  for each row execute function public.on_opportunity_response();
