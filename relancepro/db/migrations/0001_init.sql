-- =====================================================================
-- RelancePro — schéma initial.
--
-- Toutes les tables vivent dans le schéma `rp`, sans aucun droit pour les
-- rôles `anon` / `authenticated` de Supabase : elles ne sont donc pas
-- exposées par l'API REST automatique. L'application se connecte avec le
-- rôle propriétaire et, pour toute opération faite au nom d'un utilisateur,
-- passe en `SET LOCAL ROLE rp_app` avec `app.user_id` positionné : la RLS
-- ci-dessous cloisonne alors chaque entreprise.
-- =====================================================================

create extension if not exists pgcrypto;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'rp_app') then
    create role rp_app nologin;
  end if;
end $$;
grant rp_app to current_user;

create schema if not exists rp;
revoke all on schema rp from public;
grant usage on schema rp to rp_app;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then execute 'revoke all on schema rp from anon'; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then execute 'revoke all on schema rp from authenticated'; end if;
end $$;

-- ------------------------------------------------------------- identity
create or replace function rp.uid() returns uuid language sql stable as $$
  select nullif(current_setting('app.user_id', true), '')::uuid
$$;

create table rp.users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  password_hash text not null,
  name text not null default '' check (char_length(name) <= 120),
  email_verified_at timestamptz,
  is_platform_admin boolean not null default false,
  created_at timestamptz not null default now(),
  last_login_at timestamptz,
  check (email = lower(email) and position('@' in email) > 1)
);
create unique index users_email_idx on rp.users(email);

create table rp.sessions (
  id text primary key,                 -- sha256 du jeton ; le jeton n'est jamais stocké
  user_id uuid not null references rp.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  ip text,
  user_agent text
);
create index sessions_user_idx on rp.sessions(user_id);

create table rp.email_tokens (
  id text primary key,                 -- sha256 du jeton
  user_id uuid not null references rp.users(id) on delete cascade,
  purpose text not null check (purpose in ('verify', 'reset')),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

-- -------------------------------------------------------- organizations
create table rp.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  sector text not null default 'autre',
  siret text check (siret is null or siret ~ '^[0-9]{14}$'),
  timezone text not null default 'Europe/Paris',
  trial_ends_at timestamptz not null default now() + interval '7 days',
  automation_paused boolean not null default false,
  settings jsonb not null default '{}'::jsonb,
  inbound_token text not null unique default encode(gen_random_bytes(18), 'hex'),
  referral_code text not null unique default upper(encode(gen_random_bytes(4), 'hex')),
  referred_by uuid references rp.organizations(id) on delete set null,
  created_at timestamptz not null default now()
);

create table rp.memberships (
  org_id uuid not null references rp.organizations(id) on delete cascade,
  user_id uuid not null references rp.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index memberships_user_idx on rp.memberships(user_id);

create table rp.invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references rp.organizations(id) on delete cascade,
  email text not null check (email = lower(email)),
  role text not null check (role in ('admin', 'member')),
  token_hash text not null unique,
  invited_by uuid references rp.users(id) on delete set null,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

-- SECURITY DEFINER helpers: used by policies, they read memberships without recursing into its own RLS.
create or replace function rp.is_member(p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from rp.memberships m where m.org_id = p_org and m.user_id = rp.uid())
$$;
create or replace function rp.role_rank(p_org uuid) returns int
language sql stable security definer set search_path = '' as $$
  select coalesce(max(case m.role when 'owner' then 3 when 'admin' then 2 when 'member' then 1 end), 0)
  from rp.memberships m where m.org_id = p_org and m.user_id = rp.uid()
$$;
create or replace function rp.shares_org(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from rp.memberships a join rp.memberships b on a.org_id = b.org_id where a.user_id = rp.uid() and b.user_id = p_user)
$$;

-- ------------------------------------------------------------ prospects
create table rp.prospects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references rp.organizations(id) on delete cascade,
  first_name text not null default '' check (char_length(first_name) <= 100),
  last_name text not null default '' check (char_length(last_name) <= 100),
  company text not null default '' check (char_length(company) <= 160),
  email text check (email is null or (email = lower(email) and position('@' in email) > 1)),
  phone text check (phone is null or char_length(phone) <= 40),
  source text not null default 'manual' check (source in ('manual', 'csv', 'form', 'email', 'api')),
  status text not null default 'new' check (status in ('new', 'to_contact', 'waiting', 'to_follow_up', 'meeting', 'won', 'lost', 'opposed')),
  need text not null default '' check (char_length(need) <= 4000),
  estimated_value_cents bigint check (estimated_value_cents is null or estimated_value_cents >= 0),
  won_value_cents bigint check (won_value_cents is null or won_value_cents >= 0),
  lawful_basis text check (lawful_basis in ('consent', 'legitimate_interest', 'pre_contract', 'contract')),
  basis_note text not null default '' check (char_length(basis_note) <= 500),
  owner_user_id uuid references rp.users(id) on delete set null,
  first_inbound_at timestamptz,
  last_inbound_at timestamptz,
  last_outbound_at timestamptz,
  next_action_at timestamptz,
  ai_summary text not null default '',
  ai_intent text,
  ai_urgency boolean not null default false,
  ai_score smallint check (ai_score between 0 and 100),
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index prospects_org_status_idx on rp.prospects(org_id, status);
create unique index prospects_org_email_idx on rp.prospects(org_id, email) where email is not null;

create table rp.quotes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references rp.organizations(id) on delete cascade,
  prospect_id uuid not null references rp.prospects(id) on delete cascade,
  reference text not null default '' check (char_length(reference) <= 80),
  amount_cents bigint check (amount_cents is null or amount_cents >= 0),
  status text not null default 'sent' check (status in ('draft', 'sent', 'accepted', 'refused', 'expired')),
  sent_at timestamptz,
  valid_until date,
  created_at timestamptz not null default now()
);
create index quotes_prospect_idx on rp.quotes(prospect_id);

create table rp.interactions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references rp.organizations(id) on delete cascade,
  prospect_id uuid not null references rp.prospects(id) on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound', 'internal')),
  channel text not null check (channel in ('email', 'phone', 'form', 'meeting', 'note', 'system')),
  subject text not null default '' check (char_length(subject) <= 300),
  body text not null default '' check (char_length(body) <= 20000),
  ai_intent text,
  occurred_at timestamptz not null default now(),
  created_by uuid references rp.users(id) on delete set null
);
create index interactions_prospect_idx on rp.interactions(prospect_id, occurred_at desc);

-- Legal bases are historised: never updated, never deleted by tenants.
create table rp.consents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references rp.organizations(id) on delete cascade,
  prospect_id uuid references rp.prospects(id) on delete set null,
  basis text not null check (basis in ('consent', 'legitimate_interest', 'pre_contract', 'contract', 'withdrawn')),
  source text not null default '' check (char_length(source) <= 200),
  evidence text not null default '' check (char_length(evidence) <= 1000),
  recorded_by uuid references rp.users(id) on delete set null,
  recorded_at timestamptz not null default now()
);

-- Oppositions survive the prospect's erasure: keyed by a hash of the address.
create table rp.suppressions (
  org_id uuid not null references rp.organizations(id) on delete cascade,
  email_hash text not null,
  reason text not null check (reason in ('unsubscribe', 'opposition', 'refusal', 'bounce', 'manual')),
  created_at timestamptz not null default now(),
  primary key (org_id, email_hash)
);

-- --------------------------------------------------------- automation
create table rp.sequences (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references rp.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  mode text not null default 'assisted' check (mode in ('assisted', 'automatic')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table rp.sequence_steps (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references rp.organizations(id) on delete cascade,
  sequence_id uuid not null references rp.sequences(id) on delete cascade,
  position smallint not null check (position between 1 and 20),
  delay_days smallint not null check (delay_days between 0 and 365),
  action text not null check (action in ('alert', 'email', 'close')),
  subject text not null default '' check (char_length(subject) <= 200),
  body text not null default '' check (char_length(body) <= 6000),
  use_ai boolean not null default true,
  unique (sequence_id, position)
);

create table rp.enrollments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references rp.organizations(id) on delete cascade,
  prospect_id uuid not null references rp.prospects(id) on delete cascade,
  sequence_id uuid not null references rp.sequences(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'completed', 'stopped')),
  current_position smallint not null default 0,
  next_run_at timestamptz,
  started_at timestamptz not null default now(),
  stopped_reason text
);
create unique index enrollments_one_active_idx on rp.enrollments(prospect_id) where status = 'active';
create index enrollments_due_idx on rp.enrollments(next_run_at) where status = 'active';

create table rp.messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references rp.organizations(id) on delete cascade,
  prospect_id uuid not null references rp.prospects(id) on delete cascade,
  enrollment_id uuid references rp.enrollments(id) on delete set null,
  step_position smallint,
  subject text not null check (char_length(subject) <= 200),
  body text not null check (char_length(body) <= 8000),
  status text not null default 'draft' check (status in ('draft', 'needs_review', 'approved', 'sending', 'sent', 'failed', 'cancelled', 'blocked')),
  review_reasons text[] not null default '{}',
  ai_generated boolean not null default false,
  prompt_version text,
  approved_by uuid references rp.users(id) on delete set null,
  approved_at timestamptz,
  sent_at timestamptz,
  provider_message_id text,
  error text,
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);
create index messages_org_status_idx on rp.messages(org_id, status);

create table rp.mailboxes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null unique references rp.organizations(id) on delete cascade,
  provider text not null check (provider in ('smtp', 'gmail', 'outlook')),
  from_name text not null default '',
  from_email text not null check (from_email = lower(from_email)),
  smtp_host text,
  smtp_port int check (smtp_port is null or smtp_port between 1 and 65535),
  smtp_secure boolean not null default true,
  smtp_user text,
  secret_enc text,                      -- mot de passe SMTP ou jeton OAuth, chiffré AES-256-GCM
  status text not null default 'disconnected' check (status in ('connected', 'error', 'disconnected')),
  last_error text,
  last_tested_at timestamptz,
  daily_limit int not null default 80 check (daily_limit between 1 and 2000),
  created_at timestamptz not null default now()
);

-- Generic job queue: SKIP LOCKED workers, unique idempotency keys, retries with backoff.
create table rp.jobs (
  id bigint generated always as identity primary key,
  org_id uuid references rp.organizations(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  run_at timestamptz not null default now(),
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'dead')),
  attempts int not null default 0,
  max_attempts int not null default 5,
  locked_at timestamptz,
  last_error text,
  idempotency_key text unique,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index jobs_due_idx on rp.jobs(run_at) where status = 'queued';

-- -------------------------------------------------------- integrations
create table rp.webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references rp.organizations(id) on delete cascade,
  url text not null check (url ~ '^https://'),
  secret_enc text not null,
  events text[] not null default '{prospect.created,prospect.updated,message.sent,reply.received}',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table rp.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references rp.organizations(id) on delete cascade,
  endpoint_id uuid not null references rp.webhook_endpoints(id) on delete cascade,
  event text not null,
  status text not null default 'pending' check (status in ('pending', 'delivered', 'failed')),
  response_code int,
  attempts int not null default 0,
  created_at timestamptz not null default now()
);

-- -------------------------------------------------------------- billing
create table rp.subscriptions (
  org_id uuid primary key references rp.organizations(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  plan text check (plan in ('starter', 'pro', 'business')),
  status text not null default 'none',
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  monthly_amount_cents int not null default 0,
  updated_at timestamptz not null default now()
);

create table rp.stripe_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text
);

create table rp.ai_usage (
  id bigint generated always as identity primary key,
  org_id uuid not null references rp.organizations(id) on delete cascade,
  operation text not null,
  provider text not null,
  model text not null default '',
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  cost_micros bigint not null default 0,
  created_at timestamptz not null default now()
);
create index ai_usage_org_month_idx on rp.ai_usage(org_id, created_at);

-- ------------------------------------------------------- observability
create table rp.audit_log (
  id bigint generated always as identity primary key,
  org_id uuid references rp.organizations(id) on delete cascade,
  user_id uuid references rp.users(id) on delete set null,
  action text not null,
  target_type text not null default '',
  target_id text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_org_idx on rp.audit_log(org_id, created_at desc);

create table rp.error_log (
  id bigint generated always as identity primary key,
  org_id uuid references rp.organizations(id) on delete set null,
  source text not null,
  message text not null,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table rp.outbox_emails (               -- e-mails transactionnels de la plateforme
  id bigint generated always as identity primary key,
  to_email text not null,
  subject text not null,
  text_body text not null,
  html_body text not null,
  kind text not null,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'logged')),
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create table rp.contact_requests (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('contact', 'demo', 'support')),
  name text not null check (char_length(name) between 1 and 120),
  email text not null,
  company text not null default '',
  message text not null check (char_length(message) between 1 and 5000),
  org_id uuid references rp.organizations(id) on delete set null,
  created_at timestamptz not null default now(),
  handled_at timestamptz
);

create table rp.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_org uuid not null references rp.organizations(id) on delete cascade,
  referred_org uuid not null unique references rp.organizations(id) on delete cascade,
  status text not null default 'signed_up' check (status in ('signed_up', 'converted', 'rewarded')),
  created_at timestamptz not null default now()
);

create table rp.analytics_events (              -- mesure d'audience interne, sans donnée personnelle
  id bigint generated always as identity primary key,
  name text not null,
  path text not null default '',
  ref text,
  created_at timestamptz not null default now()
);

-- ================================================================ RLS
do $$
declare t text;
begin
  foreach t in array array['organizations','memberships','invitations','prospects','quotes','interactions','consents','suppressions',
    'sequences','sequence_steps','enrollments','messages','mailboxes','webhook_endpoints','webhook_deliveries','subscriptions','ai_usage','audit_log','users','referrals']
  loop
    execute format('alter table rp.%I enable row level security', t);
  end loop;
end $$;

-- Plain tenant tables: members read and write their own organization's rows only.
do $$
declare t text;
begin
  foreach t in array array['prospects','quotes','interactions','sequences','sequence_steps','enrollments','messages']
  loop
    execute format('create policy tenant_rw on rp.%I for all to rp_app using (rp.is_member(org_id)) with check (rp.is_member(org_id))', t);
    execute format('grant select, insert, update, delete on rp.%I to rp_app', t);
  end loop;
end $$;

-- Append-only for tenants.
create policy tenant_read on rp.consents for select to rp_app using (rp.is_member(org_id));
create policy tenant_add on rp.consents for insert to rp_app with check (rp.is_member(org_id) and recorded_by = rp.uid());
grant select, insert on rp.consents to rp_app;

create policy tenant_read on rp.suppressions for select to rp_app using (rp.is_member(org_id));
create policy tenant_add on rp.suppressions for insert to rp_app with check (rp.is_member(org_id));
grant select, insert on rp.suppressions to rp_app;

create policy tenant_read on rp.audit_log for select to rp_app using (rp.role_rank(org_id) >= 2);
create policy tenant_add on rp.audit_log for insert to rp_app with check (rp.is_member(org_id) and user_id = rp.uid());
grant select, insert on rp.audit_log to rp_app;

create policy tenant_read on rp.ai_usage for select to rp_app using (rp.is_member(org_id));
grant select on rp.ai_usage to rp_app;

create policy tenant_read on rp.webhook_deliveries for select to rp_app using (rp.is_member(org_id));
grant select on rp.webhook_deliveries to rp_app;

create policy tenant_read on rp.referrals for select to rp_app using (rp.is_member(referrer_org));
grant select on rp.referrals to rp_app;

-- Organizations: members read, admins update. Creation is done by the system at signup.
create policy org_read on rp.organizations for select to rp_app using (rp.is_member(id));
create policy org_update on rp.organizations for update to rp_app using (rp.role_rank(id) >= 2) with check (rp.role_rank(id) >= 2);
grant select, update (name, sector, siret, timezone, automation_paused, settings) on rp.organizations to rp_app;

create policy members_read on rp.memberships for select to rp_app using (rp.is_member(org_id));
create policy members_admin on rp.memberships for update to rp_app using (rp.role_rank(org_id) >= 2 and role <> 'owner') with check (rp.role_rank(org_id) >= 2 and role <> 'owner');
create policy members_remove on rp.memberships for delete to rp_app using (role <> 'owner' and (user_id = rp.uid() or rp.role_rank(org_id) >= 2));
grant select, update (role), delete on rp.memberships to rp_app;

create policy invitations_admin on rp.invitations for all to rp_app using (rp.role_rank(org_id) >= 2) with check (rp.role_rank(org_id) >= 2);
grant select, insert, update, delete on rp.invitations to rp_app;

-- Users: yourself and your teammates, name/e-mail only.
create policy users_read on rp.users for select to rp_app using (id = rp.uid() or rp.shares_org(id));
create policy users_self on rp.users for update to rp_app using (id = rp.uid()) with check (id = rp.uid());
grant select (id, email, name, email_verified_at, created_at) on rp.users to rp_app;
grant update (name) on rp.users to rp_app;

-- Secrets are never readable by the tenant role: column-level grants leave them out.
create policy mailbox_read on rp.mailboxes for select to rp_app using (rp.is_member(org_id));
create policy mailbox_write on rp.mailboxes for all to rp_app using (rp.role_rank(org_id) >= 2) with check (rp.role_rank(org_id) >= 2);
grant select (id, org_id, provider, from_name, from_email, smtp_host, smtp_port, smtp_secure, smtp_user, status, last_error, last_tested_at, daily_limit, created_at) on rp.mailboxes to rp_app;
grant delete on rp.mailboxes to rp_app;

create policy webhook_read on rp.webhook_endpoints for select to rp_app using (rp.is_member(org_id));
create policy webhook_write on rp.webhook_endpoints for all to rp_app using (rp.role_rank(org_id) >= 2) with check (rp.role_rank(org_id) >= 2);
grant select (id, org_id, url, events, active, created_at) on rp.webhook_endpoints to rp_app;
grant update (active, events), delete on rp.webhook_endpoints to rp_app;

create policy subscription_read on rp.subscriptions for select to rp_app using (rp.is_member(org_id));
grant select on rp.subscriptions to rp_app;

grant execute on function rp.uid(), rp.is_member(uuid), rp.role_rank(uuid), rp.shares_org(uuid) to rp_app;

-- History cannot be rewritten, even by the owner role (except cascades on account deletion).
-- Tenants have no DELETE grant on these tables; deletions only happen through account/org erasure.
create or replace function rp.append_only() returns trigger language plpgsql as $$
begin
  -- Erasing a prospect (RGPD) detaches its consent history instead of deleting the proof.
  if tg_table_name = 'consents' and new.prospect_id is null and old.prospect_id is not null
     and new.basis = old.basis and new.evidence = old.evidence and new.recorded_at = old.recorded_at then
    return new;
  end if;
  raise exception 'append_only: % cannot be modified', tg_table_name;
end $$;
create trigger consents_append_only before update on rp.consents for each row execute function rp.append_only();
create trigger audit_append_only before update on rp.audit_log for each row execute function rp.append_only();

create or replace function rp.touch() returns trigger language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
create trigger prospects_touch before update on rp.prospects for each row execute function rp.touch();
create trigger sequences_touch before update on rp.sequences for each row execute function rp.touch();
