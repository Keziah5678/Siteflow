-- =============================================================================
-- VENTURE — core schema
-- ENVIE → PUBLICATION → COMMUNAUTÉ → RESSOURCES → ORGANISATION → RÉALISATION
--
-- Security model (see SECURITY.md):
--   * Every table has RLS enabled. The browser only ever holds the anon key.
--   * Users may only UPDATE whitelisted columns of their own rows (column
--     grants), so plan / platform_role / counters cannot be self-assigned.
--   * Cross-table invariants (membership, counters, notifications, progress)
--     are maintained by SECURITY DEFINER triggers, never by the client.
-- =============================================================================

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.project_category as enum ('business', 'event', 'people', 'creation', 'opportunity');
create type public.project_status as enum ('idea', 'recruiting', 'preparing', 'in_progress', 'completed', 'cancelled');
create type public.event_stage as enum ('proposed', 'preparing', 'confirmed', 'cancelled');
create type public.engagement_kind as enum ('interested', 'participating');
create type public.application_status as enum ('pending', 'accepted', 'rejected', 'withdrawn');
create type public.member_role as enum ('owner', 'admin', 'member');
create type public.task_status as enum ('todo', 'doing', 'done');
create type public.account_type as enum ('personal', 'business');
create type public.platform_role as enum ('user', 'moderator', 'admin', 'superadmin');
create type public.plan_tier as enum ('free', 'plus', 'business');
create type public.availability as enum ('unavailable', 'few_hours', 'part_time', 'full_time');
create type public.experience_level as enum ('beginner', 'intermediate', 'experienced', 'expert');
create type public.profile_visibility as enum ('public', 'members');
create type public.moderation_state as enum ('visible', 'hidden');
create type public.conversation_kind as enum ('direct', 'group', 'project');
create type public.contact_status as enum ('pending', 'accepted', 'declined');
create type public.report_target as enum ('project', 'comment', 'message', 'profile', 'opportunity');
create type public.report_status as enum ('open', 'reviewing', 'resolved', 'dismissed');
create type public.opportunity_kind as enum ('mission', 'collaboration', 'call', 'partnership', 'service');
create type public.proposal_status as enum ('pending', 'accepted', 'declined');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Normalises a free-text list (skills, interests): trims, lowercases for
-- comparison happens in matching; here we only dedupe and drop empties and
-- cap length so a client cannot store megabytes in an array.
create or replace function public.clean_tags(tags text[], max_items int default 20) returns text[]
language sql immutable as $$
  select coalesce(array_agg(t order by ord), '{}')
  from (
    select t, ord from (
      select distinct on (lower(btrim(x))) btrim(x) as t, ord
      from unnest(coalesce(tags, '{}')) with ordinality as u(x, ord)
      where btrim(x) <> '' and length(btrim(x)) <= 40
      order by lower(btrim(x)), ord
    ) d
    order by ord
    limit max_items
  ) s
$$;

-- ---------------------------------------------------------------------------
-- Profiles (public part) + private part
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text not null check (length(display_name) between 1 and 60),
  avatar_url text check (avatar_url is null or length(avatar_url) <= 500),
  bio text not null default '' check (length(bio) <= 600),
  skills text[] not null default '{}',
  interests text[] not null default '{}',
  ambitions text[] not null default '{}',
  city text check (city is null or length(city) <= 80),
  portfolio_url text check (portfolio_url is null or portfolio_url ~ '^https?://' and length(portfolio_url) <= 300),
  availability public.availability not null default 'few_hours',
  experience public.experience_level not null default 'intermediate',
  account_type public.account_type not null default 'personal',
  company_name text check (company_name is null or length(company_name) <= 80),
  company_website text check (company_website is null or company_website ~ '^https?://' and length(company_website) <= 300),
  -- Privacy controls
  visibility public.profile_visibility not null default 'public',
  is_discoverable boolean not null default true,       -- appears in matching / people search
  show_joined_projects boolean not null default true,
  -- Platform-controlled (no client UPDATE grant)
  platform_role public.platform_role not null default 'user',
  plan public.plan_tier not null default 'free',
  is_verified_organizer boolean not null default false,
  is_suspended boolean not null default false,
  onboarded boolean not null default false,
  completed_projects_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_skills_idx on public.profiles using gin (skills);
create index profiles_interests_idx on public.profiles using gin (interests);
create index profiles_username_trgm on public.profiles using gin (username extensions.gin_trgm_ops);
create index profiles_display_trgm on public.profiles using gin (display_name extensions.gin_trgm_ops);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Never exposed to other users: birthdate, precise-ish coordinates, billing ids.
create table public.profile_private (
  id uuid primary key references public.profiles (id) on delete cascade,
  birthdate date not null,
  lat double precision check (lat is null or lat between -90 and 90),
  lng double precision check (lng is null or lng between -180 and 180),
  stripe_customer_id text unique,
  email_notifications boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace function public.clean_profile_tags() returns trigger
language plpgsql as $$
begin
  new.skills := public.clean_tags(new.skills, 25);
  new.interests := public.clean_tags(new.interests, 25);
  new.ambitions := public.clean_tags(new.ambitions, 10);
  return new;
end $$;
create trigger profiles_clean_tags before insert or update on public.profiles
  for each row execute function public.clean_profile_tags();

-- Coordinates are rounded to 2 decimals (~1 km): "localisation approximative".
create or replace function public.round_private_coords() returns trigger
language plpgsql as $$
begin
  if new.lat is not null then new.lat := round(new.lat::numeric, 2)::double precision; end if;
  if new.lng is not null then new.lng := round(new.lng::numeric, 2)::double precision; end if;
  return new;
end $$;
create trigger profile_private_round before insert or update on public.profile_private
  for each row execute function public.round_private_coords();

-- Role helpers (SECURITY DEFINER so they can be used inside policies without
-- recursive RLS evaluation).
create or replace function public.has_platform_role(min_role public.platform_role) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and not is_suspended
      and platform_role >= min_role
  )
$$;

create or replace function public.is_active_user() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and not is_suspended)
$$;

-- Signup: create profile rows from auth metadata. Rejects minors at the DB
-- level, so the age gate cannot be bypassed by calling the Auth API directly.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  bdate date;
  base_username text;
  final_username text;
  n int := 0;
begin
  begin
    bdate := (meta ->> 'birthdate')::date;
  exception when others then
    bdate := null;
  end;
  if bdate is null then
    raise exception 'VENTURE_BIRTHDATE_REQUIRED' using errcode = 'P0001';
  end if;
  if bdate > (current_date - interval '18 years') then
    raise exception 'VENTURE_MINIMUM_AGE' using errcode = 'P0001';
  end if;

  base_username := lower(regexp_replace(coalesce(nullif(meta ->> 'username', ''), split_part(new.email, '@', 1)), '[^a-zA-Z0-9_]', '', 'g'));
  if length(base_username) < 3 then base_username := base_username || 'venture'; end if;
  base_username := left(base_username, 20);
  final_username := base_username;
  while exists (select 1 from public.profiles where username = final_username) loop
    n := n + 1;
    final_username := left(base_username, 20) || n::text;
  end loop;

  insert into public.profiles (id, username, display_name)
  values (new.id, final_username, left(coalesce(nullif(btrim(meta ->> 'display_name'), ''), final_username), 60));
  insert into public.profile_private (id, birthdate) values (new.id, bdate);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Blocks (needed early: used by many policies)
-- ---------------------------------------------------------------------------
create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create or replace function public.is_blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  )
$$;

-- ---------------------------------------------------------------------------
-- Projects
-- ---------------------------------------------------------------------------
create or replace function public.tags_to_text(tags text[]) returns text
language sql immutable parallel safe as $$ select array_to_string(tags, ' ') $$;

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (length(btrim(title)) between 4 and 120),
  description text not null check (length(btrim(description)) between 10 and 5000),
  category public.project_category not null,
  status public.project_status not null default 'recruiting',
  goal text check (goal is null or length(goal) <= 200),             -- objectif recherché
  interest_goal int check (interest_goal is null or interest_goal between 1 and 10000000),
  skills_needed text[] not null default '{}',
  resources_needed text[] not null default '{}',
  budget_estimate_cents bigint check (budget_estimate_cents is null or budget_estimate_cents between 0 and 100000000000),
  cover_url text check (cover_url is null or length(cover_url) <= 500),
  city text check (city is null or length(city) <= 80),
  lat double precision check (lat is null or lat between -90 and 90),
  lng double precision check (lng is null or lng between -180 and 180),
  is_remote boolean not null default false,
  -- Demo content is always labelled in the UI ("Donnée de démonstration").
  is_demo boolean not null default false,
  -- Sponsored content is always labelled ("Sponsorisé").
  sponsor_id uuid references public.profiles (id) on delete set null,
  moderation public.moderation_state not null default 'visible',
  -- Counters: maintained by triggers only (no client UPDATE grant).
  interest_count int not null default 0,
  participant_count int not null default 0,
  member_count int not null default 1,
  milestones_total int not null default 0,
  milestones_done int not null default 0,
  search tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', public.tags_to_text(skills_needed)), 'B') ||
    setweight(to_tsvector('simple', coalesce(city, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'C')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_search_idx on public.projects using gin (search);
create index projects_title_trgm on public.projects using gin (title extensions.gin_trgm_ops);
create index projects_category_idx on public.projects (category, created_at desc);
create index projects_owner_idx on public.projects (owner_id);
create index projects_skills_idx on public.projects using gin (skills_needed);
create trigger projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

create or replace function public.clean_project_fields() returns trigger
language plpgsql as $$
begin
  new.title := btrim(new.title);
  new.skills_needed := public.clean_tags(new.skills_needed, 15);
  new.resources_needed := public.clean_tags(new.resources_needed, 15);
  if new.lat is not null then new.lat := round(new.lat::numeric, 2)::double precision; end if;
  if new.lng is not null then new.lng := round(new.lng::numeric, 2)::double precision; end if;
  return new;
end $$;
create trigger projects_clean before insert or update on public.projects
  for each row execute function public.clean_project_fields();

-- Members
create table public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.member_role not null default 'member',
  responsibility text check (responsibility is null or length(responsibility) <= 120),
  joined_at timestamptz not null default now(),
  primary key (project_id, user_id)
);
create index project_members_user_idx on public.project_members (user_id);

create or replace function public.is_project_member(p uuid, u uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.project_members where project_id = p and user_id = u)
$$;

create or replace function public.project_role(p uuid, u uuid default auth.uid()) returns public.member_role
language sql stable security definer set search_path = public as $$
  select role from public.project_members where project_id = p and user_id = u
$$;

create or replace function public.is_project_manager(p uuid, u uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.project_members where project_id = p and user_id = u and role in ('owner', 'admin'))
$$;

create or replace function public.can_view_project(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.projects pr
    where pr.id = p
      and (pr.moderation = 'visible' or pr.owner_id = auth.uid() or public.has_platform_role('moderator'))
  )
$$;

-- Event-specific details ("événements à la demande")
create table public.event_details (
  project_id uuid primary key references public.projects (id) on delete cascade,
  stage public.event_stage not null default 'proposed',
  venue_idea text check (venue_idea is null or length(venue_idea) <= 200),
  capacity int check (capacity is null or capacity between 1 and 1000000),
  price_min_cents int check (price_min_cents is null or price_min_cents between 0 and 10000000),
  price_max_cents int check (price_max_cents is null or price_max_cents between 0 and 10000000),
  date_options date[] not null default '{}',
  confirmed_date date,
  updated_at timestamptz not null default now(),
  check (price_min_cents is null or price_max_cents is null or price_min_cents <= price_max_cents)
);
create trigger event_details_updated_at before update on public.event_details
  for each row execute function public.set_updated_at();

create table public.organizer_proposals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  organizer_id uuid not null references public.profiles (id) on delete cascade,
  message text not null check (length(btrim(message)) between 10 and 2000),
  proposed_date date,
  proposed_venue text check (proposed_venue is null or length(proposed_venue) <= 200),
  proposed_price_cents int check (proposed_price_cents is null or proposed_price_cents between 0 and 10000000),
  status public.proposal_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique (project_id, organizer_id)
);

-- Engagements: "Je suis intéressé" / "Je participe". Not a purchase or booking.
create table public.project_engagements (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind public.engagement_kind not null,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id, kind)
);
create index project_engagements_user_idx on public.project_engagements (user_id);

-- Applications: "Je peux aider" → candidature
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  applicant_id uuid not null references public.profiles (id) on delete cascade,
  skill text check (skill is null or length(skill) <= 60),
  message text not null check (length(btrim(message)) between 10 and 1500),
  status public.application_status not null default 'pending',
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index applications_one_open on public.applications (project_id, applicant_id)
  where status = 'pending';
create index applications_project_idx on public.applications (project_id, status);

-- Milestones (étapes) — progress derives from them
create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null check (length(btrim(title)) between 2 and 160),
  description text check (description is null or length(description) <= 1000),
  position int not null default 0,
  due_date date,
  done boolean not null default false,
  done_at timestamptz,
  done_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index milestones_project_idx on public.milestones (project_id, position);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  milestone_id uuid references public.milestones (id) on delete set null,
  title text not null check (length(btrim(title)) between 2 and 200),
  description text check (description is null or length(description) <= 2000),
  status public.task_status not null default 'todo',
  assignee_id uuid references public.profiles (id) on delete set null,
  due_date date,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_project_idx on public.tasks (project_id, status);
create trigger tasks_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();

create table public.project_updates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (length(btrim(body)) between 2 and 3000),
  created_at timestamptz not null default now()
);
create index project_updates_project_idx on public.project_updates (project_id, created_at desc);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (length(btrim(body)) between 1 and 2000),
  moderation public.moderation_state not null default 'visible',
  created_at timestamptz not null default now()
);
create index comments_project_idx on public.comments (project_id, created_at);

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null check (length(btrim(title)) between 2 and 160),
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text check (location is null or length(location) <= 200),
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);
create index calendar_events_project_idx on public.calendar_events (project_id, starts_at);

create table public.project_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null check (length(name) between 1 and 200),
  storage_path text not null unique,
  size_bytes bigint not null check (size_bytes between 0 and 26214400),
  mime_type text,
  uploaded_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Messaging
-- ---------------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind public.conversation_kind not null,
  project_id uuid unique references public.projects (id) on delete cascade,
  title text check (title is null or length(title) <= 80),
  -- For direct conversations: sorted pair, guarantees one thread per pair.
  direct_key text unique,
  created_by uuid references public.profiles (id) on delete set null,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check ((kind = 'project') = (project_id is not null)),
  check ((kind = 'direct') = (direct_key is not null))
);

create table public.conversation_participants (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index conversation_participants_user_idx on public.conversation_participants (user_id);

create or replace function public.is_conversation_participant(c uuid, u uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.conversation_participants where conversation_id = c and user_id = u)
$$;

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null default '' check (length(body) <= 4000),
  attachment_path text,
  attachment_name text check (attachment_name is null or length(attachment_name) <= 200),
  created_at timestamptz not null default now(),
  check (length(btrim(body)) > 0 or attachment_path is not null)
);
create index messages_conversation_idx on public.messages (conversation_id, created_at desc);

create table public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references public.profiles (id) on delete cascade,
  to_id uuid not null references public.profiles (id) on delete cascade,
  message text check (message is null or length(message) <= 500),
  status public.contact_status not null default 'pending',
  conversation_id uuid references public.conversations (id) on delete set null,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (from_id <> to_id)
);
create unique index contact_requests_one_pending on public.contact_requests (from_id, to_id) where status = 'pending';

-- ---------------------------------------------------------------------------
-- Notifications, reports, endorsements, opportunities
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  actor_id uuid references public.profiles (id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type public.report_target not null,
  target_id uuid not null,
  reason text not null check (reason in ('spam', 'harassment', 'inappropriate', 'scam', 'impersonation', 'other')),
  details text check (details is null or length(details) <= 1000),
  status public.report_status not null default 'open',
  resolution_note text check (resolution_note is null or length(resolution_note) <= 1000),
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index reports_status_idx on public.reports (status, created_at desc);
create unique index reports_one_open_per_target on public.reports (reporter_id, target_type, target_id) where status in ('open', 'reviewing');

-- "Recommandations reçues": only between people who actually worked together.
create table public.endorsements (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  body text not null check (length(btrim(body)) between 10 and 800),
  created_at timestamptz not null default now(),
  unique (author_id, recipient_id, project_id),
  check (author_id <> recipient_id)
);

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.profiles (id) on delete cascade,
  kind public.opportunity_kind not null,
  title text not null check (length(btrim(title)) between 4 and 140),
  description text not null check (length(btrim(description)) between 20 and 4000),
  skills text[] not null default '{}',
  city text check (city is null or length(city) <= 80),
  is_remote boolean not null default false,
  compensation text check (compensation is null or length(compensation) <= 120),
  related_project_id uuid references public.projects (id) on delete set null,
  is_sponsored boolean not null default false,
  is_open boolean not null default true,
  moderation public.moderation_state not null default 'visible',
  created_at timestamptz not null default now()
);
create index opportunities_open_idx on public.opportunities (is_open, created_at desc);

create table public.opportunity_responses (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  message text not null check (length(btrim(message)) between 10 and 1500),
  created_at timestamptz not null default now(),
  unique (opportunity_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Monetisation & AI cost control
-- ---------------------------------------------------------------------------
create table public.plan_settings (
  plan public.plan_tier primary key,
  label text not null,
  price_cents int not null check (price_cents >= 0),
  currency text not null default 'eur',
  ai_monthly_credits int not null check (ai_monthly_credits >= 0),
  features text[] not null default '{}',
  updated_at timestamptz not null default now()
);

insert into public.plan_settings (plan, label, price_cents, ai_monthly_credits, features) values
  ('free', 'VENTURE Free', 0, 20, array['Profil et projets illimités', 'Participation et messagerie', 'Recherche', 'Accès limité à VENTURE AI']),
  ('plus', 'VENTURE Plus', 999, 300, array['Davantage de crédits IA', 'Outils avancés de gestion', 'Matching avancé', 'Statistiques personnelles']),
  ('business', 'VENTURE Business', 4999, 1000, array['Tableau de bord professionnel', 'Recherche de talents', 'Publication d''opportunités', 'Statistiques agrégées']);

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);
insert into public.app_settings (key, value) values
  ('ticketing_commission_pct', '5'),
  ('services_commission_pct', '8'),
  ('regulated_funding_enabled', 'false'),
  ('show_demo_content', 'true'),
  ('ai_cost_per_credit_cents', '1');

create table public.subscriptions (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  plan public.plan_tier not null,
  status text not null,
  stripe_subscription_id text unique,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

-- Idempotency for webhooks: one row per Stripe event id.
create table public.stripe_events (
  id text primary key,
  type text not null,
  processed_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  stripe_session_id text unique,
  amount_cents int not null,
  currency text not null,
  kind text not null,
  status text not null,
  created_at timestamptz not null default now()
);

create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  feature text not null,
  credits int not null default 1 check (credits > 0),
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  provider text,
  model text,
  created_at timestamptz not null default now()
);
create index ai_usage_user_month_idx on public.ai_usage (user_id, created_at desc);

create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  details jsonb,
  created_at timestamptz not null default now()
);

-- Generic server-side rate limiting (used by API routes, e.g. signup by IP).
create table public.rate_limit_hits (
  key text not null,
  hit_at timestamptz not null default now()
);
create index rate_limit_hits_idx on public.rate_limit_hits (key, hit_at desc);
