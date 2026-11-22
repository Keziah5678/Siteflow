-- =====================================================================
-- ARTHENIS v2 — schéma complet, reproductible.
--
-- Idempotent et compatible avec la base bêta existante :
--   * worlds, world_members, profiles sont étendus (jamais recréés) ;
--   * les nouvelles tables portent des noms qui ne collisionnent pas avec
--     les tables bêta (regions, characters, timeline_events…), importées
--     ensuite par 20261122000200_arthenis_legacy_import.sql.
--
-- Principes :
--   * les données structurées sont la source de vérité ;
--   * l'histoire ne s'efface pas : aucune permission DELETE sur le canon,
--     révisions en append-only, corrections traçables ;
--   * les lois ne changent que par amendement du créateur, historisé.
-- =====================================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------ profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'display_name',''), split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- -------------------------------------------------------------- worlds
create table if not exists public.worlds (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.worlds add column if not exists visibility text not null default 'private';
alter table public.worlds add column if not exists constitution jsonb not null default '{}'::jsonb;
alter table public.worlds add column if not exists constitution_version integer not null default 1;
alter table public.worlds add column if not exists visual_bible jsonb not null default '{}'::jsonb;
alter table public.worlds add column if not exists tick bigint not null default 0;
alter table public.worlds add column if not exists cover_url text;
alter table public.worlds add column if not exists archived_at timestamptz;

-- Beta columns stay readable but must not block v2 inserts.
do $$
declare col text;
begin
  foreach col in array array['theme','magic_enabled','fiction_enabled','fictional_creatures_enabled','world_memory','is_public'] loop
    if exists (select 1 from information_schema.columns where table_schema='public' and table_name='worlds' and column_name=col and is_nullable='NO' and column_default is null) then
      execute format('alter table public.worlds alter column %I drop not null', col);
    end if;
  end loop;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='worlds_visibility_check') then
    alter table public.worlds add constraint worlds_visibility_check check (visibility in ('private','public'));
  end if;
  if not exists (select 1 from pg_constraint where conname='worlds_name_len') then
    alter table public.worlds add constraint worlds_name_len check (char_length(name) between 1 and 120);
  end if;
  if not exists (select 1 from pg_constraint where conname='worlds_tick_nonneg') then
    alter table public.worlds add constraint worlds_tick_nonneg check (tick >= 0);
  end if;
end $$;
create index if not exists worlds_owner_idx on public.worlds(owner_id);
create index if not exists worlds_public_idx on public.worlds(visibility) where visibility = 'public';

-- --------------------------------------------------------- world_members
create table if not exists public.world_members (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'reader',
  created_at timestamptz not null default now()
);
alter table public.world_members add column if not exists invited_by uuid references auth.users(id) on delete set null;
alter table public.world_members add column if not exists created_at timestamptz not null default now();

-- Drop beta role checks, then map beta roles onto v2 roles.
do $$
declare c record;
begin
  for c in select conname from pg_constraint where conrelid='public.world_members'::regclass and contype='c' loop
    execute format('alter table public.world_members drop constraint %I', c.conname);
  end loop;
end $$;
-- Beta semantics: 'owner' = co-owner, 'creator' = could create (≈ guardian), 'viewer' = reader.
update public.world_members set role = case role when 'owner' then 'admin' when 'creator' then 'guardian' when 'viewer' then 'reader' else role end
where role in ('owner','creator','viewer');
update public.world_members m set role='creator' from public.worlds w where w.id=m.world_id and w.owner_id=m.user_id;
update public.world_members set role='reader' where role not in ('creator','admin','guardian','contributor','reader');
alter table public.world_members add constraint world_members_role_check check (role in ('creator','admin','guardian','contributor','reader'));
delete from public.world_members a using public.world_members b where a.world_id=b.world_id and a.user_id=b.user_id and a.ctid > b.ctid;
create unique index if not exists world_members_world_user_idx on public.world_members(world_id, user_id);
create index if not exists world_members_user_idx on public.world_members(user_id);

-- ------------------------------------------------------- role helpers
create or replace function public.arthenis_role_rank(p_role text) returns integer
language sql immutable set search_path = '' as $$
  select case p_role when 'creator' then 5 when 'admin' then 4 when 'guardian' then 3 when 'contributor' then 2 when 'reader' then 1 else 0 end
$$;

-- Caller's rank in a world: 5 creator … 1 reader, 0 none. SECURITY DEFINER so
-- policies on world_members can call it without recursing into themselves.
create or replace function public.world_role_rank(p_world uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select coalesce(max(r), 0) from (
    select 5 as r from public.worlds w where w.id = p_world and w.owner_id = (select auth.uid())
    union all
    select public.arthenis_role_rank(m.role) from public.world_members m where m.world_id = p_world and m.user_id = (select auth.uid())
  ) s
$$;

create or replace function public.can_read_world(p_world uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.world_role_rank(p_world) >= 1
      or exists (select 1 from public.worlds w where w.id = p_world and w.visibility = 'public' and w.archived_at is null)
$$;

-- Direct canon writes: guardians and above, or contributors in an "open" world.
create or replace function public.can_write_world(p_world uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when public.world_role_rank(p_world) >= 3 then true
    when public.world_role_rank(p_world) = 2 then coalesce((select w.constitution->'contribution'->>'mode' from public.worlds w where w.id = p_world), 'proposals') = 'open'
    else false end
$$;

-- Keep the legacy helpers working for any remaining beta policy or trigger.
create or replace function public.is_world_member(p_world uuid) returns boolean
language sql stable security definer set search_path = '' as $$ select public.world_role_rank(p_world) >= 1 $$;
create or replace function public.is_world_editor(p_world uuid) returns boolean
language sql stable security definer set search_path = '' as $$ select public.can_write_world(p_world) $$;
create or replace function public.can_manage_world_members(p_world uuid) returns boolean
language sql stable security definer set search_path = '' as $$ select public.world_role_rank(p_world) >= 4 $$;

-- Creator membership row for every world (and backfill).
create or replace function public.arthenis_world_created() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.world_members(world_id, user_id, role) values (new.id, new.owner_id, 'creator')
  on conflict (world_id, user_id) do update set role = 'creator';
  return new;
end $$;
drop trigger if exists arthenis_world_created on public.worlds;
create trigger arthenis_world_created after insert on public.worlds for each row execute function public.arthenis_world_created();
insert into public.world_members(world_id, user_id, role)
select w.id, w.owner_id, 'creator' from public.worlds w
on conflict (world_id, user_id) do update set role = 'creator';

-- Guard rails on worlds: constitution only by the creator, time only forward,
-- owner immutable. Applies to every client, whatever the policies say.
create or replace function public.arthenis_world_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare rank integer := public.world_role_rank(old.id);
begin
  if (select auth.uid()) is null then return new; end if; -- service role / migrations
  if new.owner_id <> old.owner_id then raise exception 'owner_immutable'; end if;
  if new.constitution is distinct from old.constitution and coalesce(current_setting('arthenis.amendment', true), '') <> 'on' then
    raise exception 'constitution_changes_require_amendment';
  end if;
  if new.tick < old.tick then raise exception 'time_cannot_go_backwards'; end if;
  if new.tick <> old.tick and rank < 4 then raise exception 'forbidden_time_advance'; end if;
  if (new.archived_at is distinct from old.archived_at or new.visibility <> old.visibility) and rank < 5 then raise exception 'creator_only'; end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists arthenis_world_guard on public.worlds;
create trigger arthenis_world_guard before update on public.worlds for each row execute function public.arthenis_world_guard();

-- ------------------------------------------------------------ entities
create table if not exists public.entities (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds(id) on delete cascade,
  kind text not null check (kind in (
    'universe','galaxy','star_system','planet','continent','country','region','city','village','place',
    'character','npc','animal','creature','species','deity',
    'civilization','faction','dynasty','family','organization','religion',
    'language','technology','resource','item','quest')),
  name text not null check (char_length(name) between 1 and 160),
  summary text not null default '' check (char_length(summary) <= 4000),
  parent_id uuid references public.entities(id) on delete cascade,
  x double precision check (x is null or (x >= 0 and x <= 100)),
  y double precision check (y is null or (y >= 0 and y <= 100)),
  status text not null default 'active' check (status in ('active','dead','destroyed','dissolved','completed','failed','archived')),
  importance smallint not null default 3 check (importance between 1 and 5),
  data jsonb not null default '{}'::jsonb,
  image_url text,
  born_tick bigint,
  ended_tick bigint,
  tensions text[] not null default '{}',
  version integer not null default 1,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists entities_world_idx on public.entities(world_id, kind);
create index if not exists entities_parent_idx on public.entities(parent_id);

create table if not exists public.entity_relations (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds(id) on delete cascade,
  source_id uuid not null references public.entities(id) on delete cascade,
  target_id uuid not null references public.entities(id) on delete cascade,
  type text not null check (type in ('member_of','rules','ally','war','trade','rival','enemy','parent_of','spouse','friend','worships','speaks','owns','knows','serves','origin')),
  data jsonb not null default '{}'::jsonb,
  since_tick bigint not null default 0,
  until_tick bigint,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (source_id <> target_id),
  check (until_tick is null or until_tick >= since_tick)
);
create index if not exists entity_relations_world_idx on public.entity_relations(world_id);
create index if not exists entity_relations_source_idx on public.entity_relations(source_id);
create index if not exists entity_relations_target_idx on public.entity_relations(target_id);

-- ---------------------------------------------------------- timeline
create table if not exists public.simulations (
  id uuid primary key,
  world_id uuid not null references public.worlds(id) on delete cascade,
  from_tick bigint not null,
  to_tick bigint not null check (to_tick > from_tick),
  seed bigint not null,
  stats jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  applied_at timestamptz not null default now()
);
create index if not exists simulations_world_idx on public.simulations(world_id, from_tick);

create table if not exists public.world_events (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds(id) on delete cascade,
  tick bigint not null check (tick >= 0),
  title text not null check (char_length(title) between 1 and 240),
  description text not null default '',
  kind text not null default 'narrative' check (kind in ('creation','narrative','law_change','correction','retcon','birth','death','war','peace','alliance','catastrophe','growth','decline','tech','migration','depletion','politics','quest','simulation')),
  entity_ids uuid[] not null default '{}',
  consequences jsonb not null default '[]'::jsonb,
  source text not null default 'creator' check (source in ('creator','contributor','simulation','system')),
  simulation_id uuid references public.simulations(id) on delete set null,
  canon boolean not null default true,
  superseded_by uuid references public.world_events(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists world_events_world_idx on public.world_events(world_id, tick);

-- Events are history: only their canon flag / supersession may change.
create or replace function public.arthenis_event_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.tick <> old.tick or new.title <> old.title or new.description <> old.description or new.kind <> old.kind
     or new.entity_ids <> old.entity_ids or new.world_id <> old.world_id or new.consequences <> old.consequences then
    raise exception 'history_is_immutable: use a correction';
  end if;
  return new;
end $$;
drop trigger if exists arthenis_event_guard on public.world_events;
create trigger arthenis_event_guard before update on public.world_events for each row execute function public.arthenis_event_guard();

-- ----------------------------------------------------------- revisions
create table if not exists public.revisions (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds(id) on delete cascade,
  target_type text not null check (target_type in ('entity','constitution','event')),
  target_id uuid not null,
  version integer not null,
  change_type text not null check (change_type in ('create','update','correction','retcon','simulation','law_change','status')),
  before jsonb,
  after jsonb,
  reason text not null default '',
  author_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists revisions_target_idx on public.revisions(target_id, version);
create index if not exists revisions_world_idx on public.revisions(world_id, created_at desc);

create or replace function public.arthenis_append_only() returns trigger
language plpgsql set search_path = '' as $$
begin
  -- Account / world purges by the service role (no end-user JWT) may cascade.
  if tg_op = 'DELETE' and (select auth.uid()) is null then return old; end if;
  raise exception 'append_only: % rows cannot be modified or deleted', tg_table_name;
end $$;
drop trigger if exists revisions_append_only on public.revisions;
create trigger revisions_append_only before update or delete on public.revisions for each row execute function public.arthenis_append_only();

-- Every entity write leaves a revision. The change type and reason come from
-- the RPCs below (set_config); a plain UPDATE is recorded as 'update'.
create or replace function public.arthenis_entity_before() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if new.world_id <> old.world_id or new.id <> old.id then raise exception 'entity_identity_immutable'; end if;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    if row(new.*) is distinct from row(old.*) then
      new.version := old.version + 1;
      new.updated_at := now();
    end if;
  end if;
  if new.parent_id is not null and not exists (select 1 from public.entities p where p.id = new.parent_id and p.world_id = new.world_id) then
    raise exception 'parent_outside_world';
  end if;
  return new;
end $$;
drop trigger if exists arthenis_entity_before on public.entities;
create trigger arthenis_entity_before before insert or update on public.entities for each row execute function public.arthenis_entity_before();

create or replace function public.arthenis_entity_after() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.version = old.version then return new; end if;
  insert into public.revisions(world_id, target_type, target_id, version, change_type, before, after, reason, author_id)
  values (new.world_id, 'entity', new.id, new.version,
    case when tg_op = 'INSERT' then 'create' else coalesce(nullif(current_setting('arthenis.change_type', true), ''), 'update') end,
    case when tg_op = 'UPDATE' then to_jsonb(old) else null end, to_jsonb(new),
    coalesce(current_setting('arthenis.change_reason', true), ''), (select auth.uid()));
  return new;
end $$;
drop trigger if exists arthenis_entity_after on public.entities;
create trigger arthenis_entity_after after insert or update on public.entities for each row execute function public.arthenis_entity_after();

-- ----------------------------------------------------------- proposals
create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('create','update','law_change')),
  target_id uuid references public.entities(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  guardian jsonb,
  status text not null default 'pending' check (status in ('pending','approved','rejected','withdrawn')),
  review_note text not null default '',
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index if not exists proposals_world_idx on public.proposals(world_id, status);

create or replace function public.arthenis_proposal_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null then return new; end if;
  if old.status <> 'pending' then raise exception 'proposal_already_closed'; end if;
  if new.payload <> old.payload or new.author_id <> old.author_id or new.world_id <> old.world_id or new.action <> old.action then
    raise exception 'proposal_content_immutable';
  end if;
  if new.status = 'withdrawn' then
    if uid <> old.author_id then raise exception 'only_author_can_withdraw'; end if;
  elsif new.status in ('approved','rejected') then
    if public.world_role_rank(old.world_id) < 3 then raise exception 'only_reviewers'; end if;
    if new.action = 'law_change' and public.world_role_rank(old.world_id) < 5 then raise exception 'creator_only'; end if;
    new.reviewed_by := uid;
    new.reviewed_at := now();
  end if;
  return new;
end $$;
drop trigger if exists arthenis_proposal_guard on public.proposals;
create trigger arthenis_proposal_guard before update on public.proposals for each row execute function public.arthenis_proposal_guard();

-- ----------------------------------------------------- invitations
create table if not exists public.world_invitations (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds(id) on delete cascade,
  email text not null check (position('@' in email) > 1),
  role text not null check (role in ('admin','guardian','contributor','reader')),
  status text not null default 'pending' check (status in ('pending','accepted','revoked')),
  invited_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);
create unique index if not exists world_invitations_pending_idx on public.world_invitations(world_id, lower(email)) where status = 'pending';

-- Accepting creates the membership; only the invited address may accept.
create or replace function public.arthenis_accept_invitation(p_invitation uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare inv public.world_invitations; uid uuid := (select auth.uid()); mail text := lower(coalesce((select auth.jwt())->>'email', ''));
begin
  select * into inv from public.world_invitations where id = p_invitation for update;
  if inv.id is null or inv.status <> 'pending' then raise exception 'invitation_unavailable'; end if;
  if uid is null or lower(inv.email) <> mail then raise exception 'invitation_not_for_you'; end if;
  insert into public.world_members(world_id, user_id, role, invited_by) values (inv.world_id, uid, inv.role, inv.invited_by)
  on conflict (world_id, user_id) do update set role = excluded.role where public.world_members.role <> 'creator';
  update public.world_invitations set status = 'accepted', accepted_at = now() where id = inv.id;
  return inv.world_id;
end $$;

-- ------------------------------------------- activity, notifications
create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text not null default '',
  target_id uuid,
  summary text not null default '' check (char_length(summary) <= 1000),
  created_at timestamptz not null default now()
);
create index if not exists activity_world_idx on public.activity_log(world_id, created_at desc);
drop trigger if exists activity_append_only on public.activity_log;
create trigger activity_append_only before update or delete on public.activity_log for each row execute function public.arthenis_append_only();

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  world_id uuid references public.worlds(id) on delete cascade,
  title text not null,
  body text not null default '',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);

create or replace function public.arthenis_notify_proposal() returns trigger
language plpgsql security definer set search_path = '' as $$
declare wname text;
begin
  select name into wname from public.worlds where id = new.world_id;
  if tg_op = 'INSERT' then
    insert into public.notifications(user_id, world_id, title, body)
    select m.user_id, new.world_id, 'Nouvelle proposition', 'Une proposition attend votre validation dans ' || wname || '.'
    from public.world_members m where m.world_id = new.world_id and public.arthenis_role_rank(m.role) >= 3 and m.user_id <> new.author_id;
  elsif new.status <> old.status and new.status in ('approved','rejected') then
    insert into public.notifications(user_id, world_id, title, body)
    values (new.author_id, new.world_id, case when new.status = 'approved' then 'Proposition acceptée' else 'Proposition refusée' end,
      coalesce(nullif(new.review_note, ''), wname));
  end if;
  return new;
end $$;
drop trigger if exists arthenis_notify_proposal on public.proposals;
create trigger arthenis_notify_proposal after insert or update on public.proposals for each row execute function public.arthenis_notify_proposal();

create or replace function public.arthenis_notify_invitation() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications(user_id, world_id, title, body)
  select u.id, new.world_id, 'Invitation', 'Vous êtes invité(e) à rejoindre « ' || (select name from public.worlds where id = new.world_id) || ' ».'
  from auth.users u where lower(u.email) = lower(new.email);
  return new;
end $$;
drop trigger if exists arthenis_notify_invitation on public.world_invitations;
create trigger arthenis_notify_invitation after insert on public.world_invitations for each row execute function public.arthenis_notify_invitation();

-- ------------------------------------------------ assets & AI usage
create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds(id) on delete cascade,
  entity_id uuid references public.entities(id) on delete set null,
  storage_path text,
  url text,
  prompt text not null default '',
  model text not null default '',
  cost_cents integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists assets_world_idx on public.assets(world_id, created_at desc);

create table if not exists public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  world_id uuid references public.worlds(id) on delete set null,
  operation text not null check (operation in ('text','image')),
  units integer not null default 1,
  cost_cents integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_user_day_idx on public.ai_usage(user_id, created_at desc);
drop trigger if exists ai_usage_append_only on public.ai_usage;
create trigger ai_usage_append_only before update or delete on public.ai_usage for each row execute function public.arthenis_append_only();

-- ================================================================ RPCs
-- All SECURITY INVOKER: they run under the caller's RLS, in one transaction.

-- Create or update an entity with an explicit change type and optimistic lock.
create or replace function public.arthenis_save_entity(p_world uuid, p_entity jsonb, p_change_type text default 'update', p_reason text default '', p_expected_version integer default null)
returns public.entities language plpgsql set search_path = '' as $$
declare row_out public.entities; eid uuid := coalesce((p_entity->>'id')::uuid, gen_random_uuid()); cur public.entities;
begin
  if p_change_type not in ('create','update','correction','retcon','status') then raise exception 'invalid_change_type'; end if;
  perform set_config('arthenis.change_type', p_change_type, true);
  perform set_config('arthenis.change_reason', left(coalesce(p_reason, ''), 1000), true);
  select * into cur from public.entities where id = eid and world_id = p_world for update;
  if cur.id is null then
    insert into public.entities(id, world_id, kind, name, summary, parent_id, x, y, status, importance, data, image_url, born_tick, ended_tick, created_by)
    values (eid, p_world, p_entity->>'kind', p_entity->>'name', coalesce(p_entity->>'summary', ''), (p_entity->>'parentId')::uuid,
      (p_entity->>'x')::double precision, (p_entity->>'y')::double precision, coalesce(p_entity->>'status', 'active'),
      coalesce((p_entity->>'importance')::smallint, 3), coalesce(p_entity->'data', '{}'::jsonb), p_entity->>'imageUrl',
      (p_entity->>'bornTick')::bigint, (p_entity->>'endedTick')::bigint, (select auth.uid()))
    returning * into row_out;
  else
    if p_expected_version is not null and cur.version <> p_expected_version then raise exception 'version_conflict'; end if;
    update public.entities set
      kind = coalesce(p_entity->>'kind', kind), name = coalesce(p_entity->>'name', name), summary = coalesce(p_entity->>'summary', summary),
      parent_id = case when p_entity ? 'parentId' then (p_entity->>'parentId')::uuid else parent_id end,
      x = case when p_entity ? 'x' then (p_entity->>'x')::double precision else x end,
      y = case when p_entity ? 'y' then (p_entity->>'y')::double precision else y end,
      status = coalesce(p_entity->>'status', status), importance = coalesce((p_entity->>'importance')::smallint, importance),
      data = coalesce(p_entity->'data', data), image_url = case when p_entity ? 'imageUrl' then p_entity->>'imageUrl' else image_url end,
      born_tick = case when p_entity ? 'bornTick' then (p_entity->>'bornTick')::bigint else born_tick end,
      ended_tick = case when p_entity ? 'endedTick' then (p_entity->>'endedTick')::bigint else ended_tick end,
      tensions = case when p_change_type in ('correction','retcon') then '{}' else tensions end
    where id = eid returning * into row_out;
    if row_out.id is null then raise exception 'forbidden'; end if;
  end if;
  return row_out;
end $$;

-- Apply a previewed simulation atomically. Refused if the world moved on.
create or replace function public.arthenis_apply_simulation(p_world uuid, p_sim jsonb) returns bigint
language plpgsql set search_path = '' as $$
declare w public.worlds; ch jsonb; ne jsonb; nr jsonb; er jsonb; ev jsonb; sim_id uuid := (p_sim->>'id')::uuid;
begin
  if public.world_role_rank(p_world) < 4 then raise exception 'forbidden_time_advance'; end if;
  select * into w from public.worlds where id = p_world for update;
  if w.tick <> (p_sim->>'fromTick')::bigint then raise exception 'stale_simulation'; end if;
  perform set_config('arthenis.change_type', 'simulation', true);
  perform set_config('arthenis.change_reason', 'Simulation ' || (p_sim->>'fromTick') || ' → ' || (p_sim->>'toTick'), true);

  insert into public.simulations(id, world_id, from_tick, to_tick, seed, stats, created_by)
  values (sim_id, p_world, (p_sim->>'fromTick')::bigint, (p_sim->>'toTick')::bigint, (p_sim->>'seed')::bigint, coalesce(p_sim->'stats', '{}'::jsonb), (select auth.uid()));

  for ne in select * from jsonb_array_elements(coalesce(p_sim->'newEntities', '[]'::jsonb)) loop
    insert into public.entities(id, world_id, kind, name, summary, parent_id, x, y, status, importance, data, born_tick, created_by)
    values ((ne->>'id')::uuid, p_world, ne->>'kind', ne->>'name', coalesce(ne->>'summary', ''), (ne->>'parentId')::uuid,
      (ne->>'x')::double precision, (ne->>'y')::double precision, 'active', coalesce((ne->>'importance')::smallint, 2),
      coalesce(ne->'data', '{}'::jsonb), (ne->>'bornTick')::bigint, (select auth.uid()));
  end loop;

  for ch in select * from jsonb_array_elements(coalesce(p_sim->'changes', '[]'::jsonb)) loop
    update public.entities set
      data = coalesce(ch->'after'->'data', data), status = coalesce(ch->'after'->>'status', status),
      kind = coalesce(ch->'after'->>'kind', kind),
      ended_tick = case when ch->'after' ? 'endedTick' then (ch->'after'->>'endedTick')::bigint else ended_tick end,
      born_tick = case when ch->'after' ? 'bornTick' then (ch->'after'->>'bornTick')::bigint else born_tick end
    where id = (ch->>'id')::uuid and world_id = p_world;
  end loop;

  for nr in select * from jsonb_array_elements(coalesce(p_sim->'newRelations', '[]'::jsonb)) loop
    insert into public.entity_relations(id, world_id, source_id, target_id, type, data, since_tick, until_tick, created_by)
    values ((nr->>'id')::uuid, p_world, (nr->>'sourceId')::uuid, (nr->>'targetId')::uuid, nr->>'type', coalesce(nr->'data', '{}'::jsonb),
      (nr->>'sinceTick')::bigint, (nr->>'untilTick')::bigint, (select auth.uid()));
  end loop;

  for er in select * from jsonb_array_elements(coalesce(p_sim->'endedRelations', '[]'::jsonb)) loop
    update public.entity_relations set until_tick = (er->>'untilTick')::bigint where id = (er->>'id')::uuid and world_id = p_world and until_tick is null;
  end loop;

  for ev in select * from jsonb_array_elements(coalesce(p_sim->'events', '[]'::jsonb)) loop
    insert into public.world_events(world_id, tick, title, description, kind, entity_ids, consequences, source, simulation_id, created_by)
    values (p_world, (ev->>'tick')::bigint, left(ev->>'title', 240), coalesce(ev->>'description', ''), ev->>'kind',
      coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(ev->'entityIds') x), '{}'),
      coalesce(ev->'consequences', '[]'::jsonb), 'simulation', sim_id, (select auth.uid()));
  end loop;

  update public.worlds set tick = (p_sim->>'toTick')::bigint where id = p_world;
  insert into public.activity_log(world_id, actor_id, action, target_type, target_id, summary)
  values (p_world, (select auth.uid()), 'simulate', 'world', p_world, 'Le temps avance de ' || ((p_sim->>'toTick')::bigint - w.tick) || ' jour(s).');
  return (p_sim->>'toTick')::bigint;
end $$;

-- Constitutional amendment: creator only, recorded with its impact, entities flagged not deleted.
create or replace function public.arthenis_amend_constitution(p_world uuid, p_constitution jsonb, p_reason text, p_impact jsonb default '{}'::jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare w public.worlds; item jsonb;
begin
  if public.world_role_rank(p_world) < 5 then raise exception 'creator_only'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'reason_required'; end if;
  select * into w from public.worlds where id = p_world for update;
  perform set_config('arthenis.amendment', 'on', true);
  update public.worlds set constitution = p_constitution, constitution_version = w.constitution_version + 1 where id = p_world;
  insert into public.revisions(world_id, target_type, target_id, version, change_type, before, after, reason, author_id)
  values (p_world, 'constitution', p_world, w.constitution_version + 1, 'law_change', w.constitution, p_constitution, p_reason, (select auth.uid()));
  insert into public.world_events(world_id, tick, title, description, kind, consequences, source, created_by)
  values (p_world, w.tick, 'Amendement de la constitution', p_reason, 'law_change', coalesce(p_impact->'changes', '[]'::jsonb), 'creator', (select auth.uid()));
  perform set_config('arthenis.change_type', 'law_change', true);
  perform set_config('arthenis.change_reason', p_reason, true);
  for item in select * from jsonb_array_elements(coalesce(p_impact->'newlyConflicting', '[]'::jsonb)) loop
    update public.entities set tensions = array(select distinct unnest(tensions || array['constitution:v' || (w.constitution_version + 1)]))
    where id = (item->>'entityId')::uuid and world_id = p_world;
  end loop;
  for item in select * from jsonb_array_elements(coalesce(p_impact->'resolved', '[]'::jsonb)) loop
    update public.entities set tensions = '{}' where id = (item->>'entityId')::uuid and world_id = p_world and tensions <> '{}';
  end loop;
  insert into public.activity_log(world_id, actor_id, action, target_type, target_id, summary)
  values (p_world, (select auth.uid()), 'amend_laws', 'constitution', p_world, left(p_reason, 1000));
  return w.constitution_version + 1;
end $$;

-- Correct an established event: the original stays, marked non-canon, linked to its correction.
create or replace function public.arthenis_correct_event(p_event uuid, p_title text, p_description text, p_reason text, p_kind text default 'correction')
returns uuid language plpgsql security definer set search_path = '' as $$
declare old_ev public.world_events; new_id uuid;
begin
  select * into old_ev from public.world_events where id = p_event for update;
  if old_ev.id is null then raise exception 'event_not_found'; end if;
  if public.world_role_rank(old_ev.world_id) < 4 then raise exception 'forbidden'; end if;
  if p_kind not in ('correction','retcon') then raise exception 'invalid_kind'; end if;
  if not old_ev.canon then raise exception 'already_superseded'; end if;
  insert into public.world_events(world_id, tick, title, description, kind, entity_ids, consequences, source, created_by)
  values (old_ev.world_id, old_ev.tick, p_title, p_description, p_kind, old_ev.entity_ids,
    jsonb_build_array('Remplace : ' || old_ev.title, 'Motif : ' || p_reason), 'creator', (select auth.uid()))
  returning id into new_id;
  update public.world_events set canon = false, superseded_by = new_id where id = p_event;
  insert into public.revisions(world_id, target_type, target_id, version, change_type, before, after, reason, author_id)
  values (old_ev.world_id, 'event', p_event, 2, p_kind, to_jsonb(old_ev), (select to_jsonb(e) from public.world_events e where e.id = new_id), p_reason, (select auth.uid()));
  return new_id;
end $$;

-- Review a proposal and, if approved, write it into the canon in the same transaction.
create or replace function public.arthenis_review_proposal(p_proposal uuid, p_approve boolean, p_note text default '', p_entity jsonb default null)
returns uuid language plpgsql set search_path = '' as $$
declare pr public.proposals; saved public.entities;
begin
  select * into pr from public.proposals where id = p_proposal for update;
  if pr.id is null then raise exception 'proposal_not_found'; end if;
  update public.proposals set status = case when p_approve then 'approved' else 'rejected' end, review_note = left(coalesce(p_note, ''), 1000) where id = p_proposal;
  if p_approve and pr.action in ('create', 'update') then
    saved := public.arthenis_save_entity(pr.world_id, coalesce(p_entity, pr.payload->'entity'), case when pr.action = 'create' then 'create' else 'update' end,
      'Proposition acceptée : ' || coalesce(nullif(p_note, ''), pr.id::text));
    insert into public.activity_log(world_id, actor_id, action, target_type, target_id, summary)
    values (pr.world_id, (select auth.uid()), 'approve_proposal', 'entity', saved.id, 'Proposition acceptée : ' || saved.name);
    return saved.id;
  end if;
  return null;
end $$;

-- ============================================================ RLS
alter table public.profiles enable row level security;
alter table public.worlds enable row level security;
alter table public.world_members enable row level security;
alter table public.entities enable row level security;
alter table public.entity_relations enable row level security;
alter table public.simulations enable row level security;
alter table public.world_events enable row level security;
alter table public.revisions enable row level security;
alter table public.proposals enable row level security;
alter table public.world_invitations enable row level security;
alter table public.activity_log enable row level security;
alter table public.notifications enable row level security;
alter table public.assets enable row level security;
alter table public.ai_usage enable row level security;

-- Permissive policies are OR-ed: drop every beta policy on the tables we own now.
do $$
declare p record;
begin
  for p in select policyname, tablename from pg_policies where schemaname = 'public' and tablename in
    ('profiles','worlds','world_members','entities','entity_relations','simulations','world_events','revisions','proposals','world_invitations','activity_log','notifications','assets','ai_usage')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

create policy profiles_read on public.profiles for select to authenticated using (true);
create policy profiles_own on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy profiles_insert_own on public.profiles for insert to authenticated with check (id = (select auth.uid()));

create policy worlds_read on public.worlds for select to anon, authenticated using (
  owner_id = (select auth.uid()) or public.world_role_rank(id) >= 1 or (visibility = 'public' and archived_at is null));
create policy worlds_insert on public.worlds for insert to authenticated with check (owner_id = (select auth.uid()));
create policy worlds_update on public.worlds for update to authenticated using (public.world_role_rank(id) >= 4) with check (public.world_role_rank(id) >= 4);

create policy members_read on public.world_members for select to authenticated using (public.world_role_rank(world_id) >= 1 or user_id = (select auth.uid()));
create policy members_insert on public.world_members for insert to authenticated with check (
  public.world_role_rank(world_id) >= 4 and public.world_role_rank(world_id) > public.arthenis_role_rank(role));
create policy members_update on public.world_members for update to authenticated
  using (public.world_role_rank(world_id) >= 4 and public.world_role_rank(world_id) > public.arthenis_role_rank(role))
  with check (public.world_role_rank(world_id) > public.arthenis_role_rank(role));
create policy members_delete on public.world_members for delete to authenticated using (
  role <> 'creator' and (user_id = (select auth.uid()) or (public.world_role_rank(world_id) >= 4 and public.world_role_rank(world_id) > public.arthenis_role_rank(role))));

create policy entities_read on public.entities for select to anon, authenticated using (public.can_read_world(world_id));
create policy entities_insert on public.entities for insert to authenticated with check (public.can_write_world(world_id) and created_by = (select auth.uid()));
create policy entities_update on public.entities for update to authenticated using (public.can_write_world(world_id)) with check (public.can_write_world(world_id));

create policy relations_read on public.entity_relations for select to anon, authenticated using (public.can_read_world(world_id));
create policy relations_insert on public.entity_relations for insert to authenticated with check (public.can_write_world(world_id));
create policy relations_update on public.entity_relations for update to authenticated using (public.can_write_world(world_id)) with check (public.can_write_world(world_id));

create policy simulations_read on public.simulations for select to anon, authenticated using (public.can_read_world(world_id));
create policy simulations_insert on public.simulations for insert to authenticated with check (public.world_role_rank(world_id) >= 4);

create policy events_read on public.world_events for select to anon, authenticated using (public.can_read_world(world_id));
create policy events_insert on public.world_events for insert to authenticated with check (
  public.can_write_world(world_id) and (source <> 'simulation' or public.world_role_rank(world_id) >= 4));
create policy events_update on public.world_events for update to authenticated using (public.world_role_rank(world_id) >= 4) with check (public.world_role_rank(world_id) >= 4);

create policy revisions_read on public.revisions for select to anon, authenticated using (public.can_read_world(world_id));

create policy proposals_read on public.proposals for select to authenticated using (author_id = (select auth.uid()) or public.world_role_rank(world_id) >= 3);
create policy proposals_insert on public.proposals for insert to authenticated with check (
  author_id = (select auth.uid()) and status = 'pending' and public.world_role_rank(world_id) >= 2
  and coalesce((select w.constitution->'contribution'->>'mode' from public.worlds w where w.id = world_id), 'proposals') <> 'closed');
create policy proposals_update on public.proposals for update to authenticated using (author_id = (select auth.uid()) or public.world_role_rank(world_id) >= 3);

create policy invitations_read on public.world_invitations for select to authenticated using (
  public.world_role_rank(world_id) >= 4 or lower(email) = lower(coalesce((select auth.jwt())->>'email', '')));
create policy invitations_insert on public.world_invitations for insert to authenticated with check (
  invited_by = (select auth.uid()) and public.world_role_rank(world_id) >= 4 and public.world_role_rank(world_id) > public.arthenis_role_rank(role));
create policy invitations_update on public.world_invitations for update to authenticated using (public.world_role_rank(world_id) >= 4) with check (status in ('pending','revoked'));

create policy activity_read on public.activity_log for select to authenticated using (public.world_role_rank(world_id) >= 1);
create policy activity_insert on public.activity_log for insert to authenticated with check (actor_id = (select auth.uid()) and public.world_role_rank(world_id) >= 1);

create policy notifications_own on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_mark on public.notifications for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy assets_read on public.assets for select to anon, authenticated using (public.can_read_world(world_id));
create policy assets_insert on public.assets for insert to authenticated with check (public.world_role_rank(world_id) >= 2 and created_by = (select auth.uid()));

create policy ai_usage_own on public.ai_usage for select to authenticated using (user_id = (select auth.uid()));
create policy ai_usage_insert on public.ai_usage for insert to authenticated with check (user_id = (select auth.uid()));

-- Defence in depth: the canon has no DELETE at all for API roles.
revoke delete on public.entities, public.entity_relations, public.world_events, public.revisions, public.simulations,
  public.proposals, public.activity_log, public.ai_usage, public.assets from anon, authenticated;
revoke insert, update on public.revisions from anon, authenticated;
revoke truncate on all tables in schema public from anon, authenticated;
revoke delete on public.worlds from anon, authenticated;

-- Helper functions are for policies, not public RPC.
revoke execute on function public.world_role_rank(uuid), public.can_read_world(uuid), public.can_write_world(uuid) from public, anon;
grant execute on function public.world_role_rank(uuid), public.can_read_world(uuid), public.can_write_world(uuid), public.arthenis_role_rank(text) to authenticated, anon;
revoke execute on function public.handle_new_user(), public.arthenis_world_created(), public.arthenis_entity_after(),
  public.arthenis_notify_proposal(), public.arthenis_notify_invitation(), public.arthenis_world_guard(), public.arthenis_proposal_guard() from public, anon, authenticated;
grant execute on function public.arthenis_save_entity(uuid, jsonb, text, text, integer), public.arthenis_apply_simulation(uuid, jsonb),
  public.arthenis_amend_constitution(uuid, jsonb, text, jsonb), public.arthenis_correct_event(uuid, text, text, text, text),
  public.arthenis_accept_invitation(uuid), public.arthenis_review_proposal(uuid, boolean, text, jsonb) to authenticated;
revoke execute on function public.arthenis_save_entity(uuid, jsonb, text, text, integer), public.arthenis_apply_simulation(uuid, jsonb),
  public.arthenis_amend_constitution(uuid, jsonb, text, jsonb), public.arthenis_correct_event(uuid, text, text, text, text),
  public.arthenis_accept_invitation(uuid), public.arthenis_review_proposal(uuid, boolean, text, jsonb) from public, anon;

-- ------------------------------------------------------ realtime
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['worlds','entities','entity_relations','world_events','proposals','world_members','notifications'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

-- ------------------------------------------------------- storage
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') and exists (select 1 from pg_tables where schemaname='storage' and tablename='buckets') then
    insert into storage.buckets(id, name, public) values ('arthenis-assets', 'arthenis-assets', false) on conflict (id) do nothing;
    execute 'drop policy if exists arthenis_assets_read on storage.objects';
    execute 'drop policy if exists arthenis_assets_write on storage.objects';
    execute $p$create policy arthenis_assets_read on storage.objects for select to authenticated, anon using (
      bucket_id = 'arthenis-assets' and public.can_read_world(nullif(split_part(name, '/', 1), '')::uuid))$p$;
    execute $p$create policy arthenis_assets_write on storage.objects for insert to authenticated with check (
      bucket_id = 'arthenis-assets' and public.world_role_rank(nullif(split_part(name, '/', 1), '')::uuid) >= 2)$p$;
  end if;
end $$;
