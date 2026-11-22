-- A reconstruction of the beta schema (columns as used by the beta code), with data.
create table public.profiles (id uuid primary key references auth.users(id) on delete cascade, display_name text);
create table public.worlds (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id), name text not null,
  description text, theme text not null, magic_enabled boolean not null default false, fiction_enabled boolean not null default true,
  fictional_creatures_enabled boolean not null default false, visual_bible jsonb, world_memory jsonb, is_public boolean default false,
  like_count integer default 0, created_at timestamptz default now(), updated_at timestamptz default now());
create table public.world_members (id uuid primary key default gen_random_uuid(), world_id uuid references public.worlds(id) on delete cascade,
  user_id uuid references auth.users(id), role text check (role in ('owner','admin','creator','contributor','viewer')), permissions jsonb default '{}');
create table public.world_rules (id uuid primary key default gen_random_uuid(), world_id uuid references public.worlds(id) on delete cascade, category text, title text, description text, importance int, immutable boolean);
create table public.regions (id uuid primary key default gen_random_uuid(), world_id uuid references public.worlds(id) on delete cascade, name text, description text, x numeric, y numeric, image_url text, biome text, facts jsonb, created_at timestamptz default now());
create table public.civilizations (id uuid primary key default gen_random_uuid(), world_id uuid references public.worlds(id) on delete cascade, name text, description text, culture text, technology_level int, region_id uuid, image_url text, facts jsonb);
create table public.characters (id uuid primary key default gen_random_uuid(), world_id uuid references public.worlds(id) on delete cascade, name text, biography text, image_url text, facts jsonb);
create table public.creatures (id uuid primary key default gen_random_uuid(), world_id uuid references public.worlds(id) on delete cascade, name text, description text, image_url text, facts jsonb);
create table public.timeline_events (id uuid primary key default gen_random_uuid(), world_id uuid references public.worlds(id) on delete cascade, title text, description text, world_day int, consequences jsonb);
alter table public.worlds enable row level security;
create policy legacy_too_open on public.worlds for select using (true);

insert into auth.users(id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'creator@test.dev'),
  ('a0000000-0000-4000-8000-000000000002', 'admin@test.dev'),
  ('a0000000-0000-4000-8000-000000000003', 'contrib@test.dev'),
  ('a0000000-0000-4000-8000-000000000004', 'reader@test.dev'),
  ('a0000000-0000-4000-8000-000000000005', 'stranger@test.dev'),
  ('a0000000-0000-4000-8000-000000000006', 'guardian@test.dev');
insert into public.worlds(id, owner_id, name, description, theme, magic_enabled, world_memory) values
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Aerion', 'Royaume de glace', 'médiéval glacé', false, '{"day": 12}');
insert into public.world_members(world_id, user_id, role) values
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'admin'),
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003', 'contributor'),
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000004', 'viewer'),
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000006', 'creator');
insert into public.world_rules(world_id, category, title, description) values
  ('b0000000-0000-4000-8000-000000000001', 'magic', 'Magie', 'La magie est interdite.'),
  ('b0000000-0000-4000-8000-000000000001', 'custom', 'Le froid éternel', 'Il ne fait jamais chaud.');
insert into public.regions(id, world_id, name, description, x, y) values ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'Hautes-Terres', 'Pics gelés', 30, 40);
insert into public.civilizations(world_id, name, description, culture, region_id) values ('b0000000-0000-4000-8000-000000000001', 'Clans du Givre', 'Peuple nomade', 'Clan', 'c0000000-0000-4000-8000-000000000001');
insert into public.characters(world_id, name, biography) values ('b0000000-0000-4000-8000-000000000001', 'Aldric', 'Roi vieillissant');
insert into public.creatures(world_id, name, description) values ('b0000000-0000-4000-8000-000000000001', 'Loup blanc', 'Prédateur des neiges');
insert into public.timeline_events(world_id, title, description, world_day, consequences) values ('b0000000-0000-4000-8000-000000000001', 'Fondation', 'Le royaume naît', 1, '["Début"]');
