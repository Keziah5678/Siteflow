-- =============================================================================
-- ChantierAlerte — schéma
-- Le navigateur n'accède JAMAIS directement aux tables : RLS activée sans
-- politique pour anon/authenticated. Les pages publiques passent par des
-- fonctions SECURITY DEFINER qui exigent le jeton secret de l'abonné.
-- Le robot et les fonctions Edge utilisent la clé service_role (serveur).
-- =============================================================================

create extension if not exists citext with schema extensions;

create type public.sub_status as enum ('pending', 'trial', 'active', 'expired', 'unsubscribed');

create table public.subscribers (
  id uuid primary key default gen_random_uuid(),
  email extensions.citext not null unique check (length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  trades text[] not null check (cardinality(trades) between 1 and 15),
  departments text[] not null check (cardinality(departments) between 1 and 101),
  status public.sub_status not null default 'pending',
  -- Jeton secret : liens « préférences » et « désinscription » (jamais devinable).
  token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  trial_ends_at timestamptz,
  trial_reminder_sent_at timestamptz,
  trial_ended_notice_sent_at timestamptz,
  confirmation_sent_at timestamptz,
  paid_at timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  last_email_at timestamptz,
  unsubscribed_at timestamptz
);
create index subscribers_status_idx on public.subscribers (status);

-- Avis BOAMP conservés (déduplication + pages SEO).
create table public.notices (
  idweb text primary key,
  objet text not null,
  acheteur text,
  departments text[] not null default '{}',
  ville text,
  cpv text[] not null default '{}',
  descripteurs text[] not null default '{}',
  description text,
  summary text not null,
  date_parution date not null,
  date_limite timestamptz,
  montant numeric,
  url text not null,
  type_marche text[] not null default '{}',
  trades text[] not null default '{}',     -- métiers détectés à l'ingestion
  fetched_at timestamptz not null default now()
);
create index notices_parution_idx on public.notices (date_parution desc);
create index notices_trades_idx on public.notices using gin (trades);
create index notices_depts_idx on public.notices using gin (departments);

-- Un avis n'est jamais envoyé deux fois au même abonné.
create table public.sent_notices (
  subscriber_id uuid not null references public.subscribers (id) on delete cascade,
  idweb text not null references public.notices (idweb) on delete cascade,
  sent_at timestamptz not null default now(),
  primary key (subscriber_id, idweb)
);

-- Journal d'exécution du robot.
create table public.runs (
  id bigint generated always as identity primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running',
  stats jsonb not null default '{}',
  error text
);

-- Emails stockés au lieu d'être envoyés (MAIL_MODE=outbox, tests locaux).
create table public.outbox (
  id bigint generated always as identity primary key,
  to_email text not null,
  subject text not null,
  html text not null,
  created_at timestamptz not null default now()
);

create table public.rate_limit_hits (
  key text not null,
  hit_at timestamptz not null default now()
);
create index rate_limit_hits_idx on public.rate_limit_hits (key, hit_at desc);

-- Adresses autorisées à voir le tableau de bord (connexion par lien email).
create table public.admin_emails (
  email extensions.citext primary key
);

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Fonctions publiques (anon) — toutes exigent le jeton de l'abonné
-- ---------------------------------------------------------------------------
create or replace function public.valid_prefs(p_trades text[], p_departments text[]) returns boolean
language sql immutable as $$
  select cardinality(p_trades) between 1 and 15
     and cardinality(p_departments) between 1 and 101
     and not exists (select 1 from unnest(p_trades) t where t !~ '^[a-z][a-z-]{1,30}$')
     and not exists (select 1 from unnest(p_departments) d where d !~ '^(0[1-9]|[1-8][0-9]|9[0-5]|2A|2B|97[1-6])$')
$$;

create or replace function public.get_preferences(p_token uuid)
returns table (id uuid, email text, trades text[], departments text[], status public.sub_status, trial_ends_at timestamptz)
language sql stable security definer set search_path = public as $$
  -- L'email est partiellement masqué : le jeton seul ne doit pas révéler l'adresse complète.
  select s.id, regexp_replace(s.email::text, '^(.).*(@.*)$', '\1•••\2'), s.trades, s.departments, s.status, s.trial_ends_at
  from public.subscribers s where s.token = p_token
$$;

create or replace function public.update_preferences(p_token uuid, p_trades text[], p_departments text[])
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not public.valid_prefs(p_trades, p_departments) then
    raise exception 'CA_INVALID_PREFS' using errcode = '22023';
  end if;
  update public.subscribers set trades = p_trades, departments = p_departments where token = p_token;
  return found;
end $$;

-- Double opt-in : l'essai de 14 jours démarre à la confirmation.
create or replace function public.confirm_subscription(p_token uuid)
returns public.sub_status
language plpgsql security definer set search_path = public as $$
declare s public.sub_status;
begin
  update public.subscribers
    set status = 'trial', confirmed_at = now(), trial_ends_at = now() + interval '14 days'
    where token = p_token and status = 'pending'
    returning status into s;
  if s is null then
    select status into s from public.subscribers where token = p_token;
  end if;
  return s; -- null si jeton inconnu
end $$;

create or replace function public.unsubscribe(p_token uuid)
returns boolean
language sql security definer set search_path = public as $$
  update public.subscribers set status = 'unsubscribed', unsubscribed_at = now()
  where token = p_token and status <> 'unsubscribed'
  returning true
$$;

-- Se réabonner : retrouve le bon statut (payant, essai en cours ou essai terminé).
create or replace function public.resubscribe(p_token uuid)
returns public.sub_status
language plpgsql security definer set search_path = public as $$
declare s public.sub_status;
begin
  update public.subscribers set
    status = case
      when stripe_subscription_id is not null and paid_at is not null then 'active'::public.sub_status
      when confirmed_at is null then 'pending'::public.sub_status
      when trial_ends_at > now() then 'trial'::public.sub_status
      else 'expired'::public.sub_status end,
    unsubscribed_at = null
  where token = p_token and status = 'unsubscribed'
  returning status into s;
  return s;
end $$;

-- RGPD : suppression définitive des données de l'abonné.
create or replace function public.delete_my_data(p_token uuid)
returns boolean
language sql security definer set search_path = public as $$
  delete from public.subscribers where token = p_token returning true
$$;

-- Tableau de bord : réservé aux emails de admin_emails, connectés via Supabase Auth.
create or replace function public.admin_stats()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from public.admin_emails where email = (auth.jwt() ->> 'email')) then
    raise exception 'CA_FORBIDDEN' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'total', (select count(*) from subscribers where status <> 'unsubscribed'),
    'pending', (select count(*) from subscribers where status = 'pending'),
    'trial', (select count(*) from subscribers where status = 'trial'),
    'active', (select count(*) from subscribers where status = 'active'),
    'expired', (select count(*) from subscribers where status = 'expired'),
    'unsubscribed', (select count(*) from subscribers where status = 'unsubscribed'),
    'mrr_eur', (select count(*) * 12 from subscribers where status = 'active'),
    'new_7d', (select count(*) from subscribers where created_at > now() - interval '7 days'),
    'notices_7d', (select count(*) from notices where date_parution > current_date - 7),
    'emails_7d', (select count(distinct (subscriber_id, sent_at::date)) from sent_notices where sent_at > now() - interval '7 days'),
    'last_runs', (select coalesce(jsonb_agg(r order by r.id desc), '[]') from (select id, started_at, finished_at, status, stats, error from runs order by id desc limit 7) r),
    'top_trades', (select coalesce(jsonb_object_agg(t, n), '{}') from (select t, count(*) n from subscribers, unnest(trades) t where status in ('trial','active') group by t order by n desc limit 10) x)
  );
end $$;

-- Limiteur générique (utilisé par la fonction Edge d'inscription, service role).
create or replace function public.check_rate_limit(p_key text, p_max int, p_window_seconds int) returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from public.rate_limit_hits where hit_at < now() - interval '1 day';
  select count(*) into n from public.rate_limit_hits where key = p_key and hit_at > now() - make_interval(secs => p_window_seconds);
  if n >= p_max then return false; end if;
  insert into public.rate_limit_hits (key) values (p_key);
  return true;
end $$;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.get_preferences(uuid), public.update_preferences(uuid, text[], text[]),
  public.confirm_subscription(uuid), public.unsubscribe(uuid), public.resubscribe(uuid),
  public.delete_my_data(uuid), public.valid_prefs(text[], text[]) to anon, authenticated;
grant execute on function public.admin_stats() to authenticated;
grant execute on all functions in schema public to service_role;
