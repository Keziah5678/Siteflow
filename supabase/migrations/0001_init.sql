-- ============================================================================
-- SEEDFLOW — Initial schema
-- Multi-tenant model: auth.users -> workspaces -> projects -> business_profile
-- / website (pages -> sections) / design_system / leads / conversations /
-- seo_audits / site_versions / automations / settings.
--
-- Every table is protected by Row Level Security. Access is scoped to the
-- authenticated user's workspace membership. Public/anonymous read access is
-- granted ONLY to published website content (pages, sections, design system)
-- so that generated sites can be served to visitors; everything else
-- (business profile, leads, conversations, audits...) stays private to the
-- workspace's members. Public form submissions and the AI orchestrator go
-- through server routes using the service role key, which enforce their own
-- authorization checks instead of relying on anonymous RLS policies.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- workspaces
-- ----------------------------------------------------------------------------
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  owner_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

-- Helper: is the current user a member of the given workspace?
-- security definer so it can read workspace_members without RLS recursion.
create or replace function public.is_workspace_member(target_workspace_id uuid)
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
  );
$$;

create or replace function public.workspace_id_for_project(target_project_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select workspace_id from public.projects where id = target_project_id;
$$;

-- ----------------------------------------------------------------------------
-- projects
-- ----------------------------------------------------------------------------
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  slug text not null,
  status text not null default 'draft' check (status in ('draft', 'generating', 'active', 'archived')),
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, slug)
);

-- ----------------------------------------------------------------------------
-- business_profiles
-- ----------------------------------------------------------------------------
create table if not exists public.business_profiles (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects (id) on delete cascade,
  company text not null default '',
  industry text not null default '',
  activity text,
  location text,
  services jsonb not null default '[]'::jsonb,
  target_audience text,
  goals jsonb not null default '[]'::jsonb,
  positioning text,
  tone text,
  visual_style text,
  price_tier text check (price_tier in ('economique', 'milieu-de-gamme', 'premium', 'luxe')),
  contact jsonb not null default '{}'::jsonb,
  social_links jsonb not null default '{}'::jsonb,
  brand_colors jsonb not null default '[]'::jsonb,
  has_logo boolean not null default false,
  logo_url text,
  photos jsonb not null default '[]'::jsonb,
  raw_answers jsonb not null default '{}'::jsonb,
  completeness int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- design_systems
-- ----------------------------------------------------------------------------
create table if not exists public.design_systems (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects (id) on delete cascade,
  colors jsonb not null default '{}'::jsonb,
  typography jsonb not null default '{}'::jsonb,
  spacing_scale text not null default 'regular' check (spacing_scale in ('tight', 'regular', 'airy')),
  radii text not null default 'soft' check (radii in ('sharp', 'soft', 'round')),
  shadows text not null default 'subtle' check (shadows in ('none', 'subtle', 'elevated')),
  button_style text not null default 'solid' check (button_style in ('solid', 'outline', 'soft', 'minimal')),
  animation_intensity text not null default 'balanced' check (animation_intensity in ('minimal', 'subtle', 'balanced', 'dynamic', 'immersive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- websites / pages / sections
-- ----------------------------------------------------------------------------
create table if not exists public.websites (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects (id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'published')),
  domain text,
  global_seo jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pages (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites (id) on delete cascade,
  slug text not null,
  title text not null,
  is_home boolean not null default false,
  nav_order int not null default 0,
  status text not null default 'draft' check (status in ('draft', 'published')),
  seo jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (website_id, slug)
);

create table if not exists public.sections (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages (id) on delete cascade,
  type text not null,
  position int not null default 0,
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_versions (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites (id) on delete cascade,
  label text not null default 'Version',
  snapshot jsonb not null,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- forms / leads
-- ----------------------------------------------------------------------------
create table if not exists public.forms (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  type text not null check (type in ('devis', 'rendez-vous', 'contact', 'intervention', 'information')),
  fields jsonb not null default '[]'::jsonb,
  target_section_id uuid references public.sections (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  form_id uuid references public.forms (id) on delete set null,
  name text,
  email text,
  phone text,
  company text,
  message text,
  source text not null default 'site',
  status text not null default 'nouveau' check (status in ('nouveau', 'contacte', 'qualifie', 'rendez-vous', 'proposition', 'gagne', 'perdu')),
  form_data jsonb not null default '{}'::jsonb,
  notes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- conversations / messages (AI modification + assistant history)
-- ----------------------------------------------------------------------------
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  type text not null check (type in ('modification', 'assistant')),
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  structured_payload jsonb,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- seo_audits / automations / settings
-- ----------------------------------------------------------------------------
create table if not exists public.seo_audits (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  scores jsonb not null default '{}'::jsonb,
  issues jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.automations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  trigger text not null,
  action text not null,
  enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces (id) on delete cascade,
  billing jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- indexes
-- ----------------------------------------------------------------------------
create index if not exists idx_projects_workspace on public.projects (workspace_id);
create index if not exists idx_pages_website on public.pages (website_id);
create index if not exists idx_sections_page on public.sections (page_id);
create index if not exists idx_leads_project on public.leads (project_id, status);
create index if not exists idx_messages_conversation on public.messages (conversation_id, created_at);
create index if not exists idx_site_versions_website on public.site_versions (website_id, created_at desc);
create index if not exists idx_conversations_project on public.conversations (project_id);
create index if not exists idx_forms_project on public.forms (project_id);
create index if not exists idx_automations_project on public.automations (project_id);
create index if not exists idx_seo_audits_project on public.seo_audits (project_id, created_at desc);

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.projects enable row level security;
alter table public.business_profiles enable row level security;
alter table public.design_systems enable row level security;
alter table public.websites enable row level security;
alter table public.pages enable row level security;
alter table public.sections enable row level security;
alter table public.site_versions enable row level security;
alter table public.forms enable row level security;
alter table public.leads enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.seo_audits enable row level security;
alter table public.automations enable row level security;
alter table public.settings enable row level security;

-- workspaces --------------------------------------------------------------
create policy "members can view their workspace"
  on public.workspaces for select
  using (public.is_workspace_member(id));

create policy "authenticated users can create a workspace"
  on public.workspaces for insert
  with check (owner_id = auth.uid());

create policy "owners/admins can update workspace"
  on public.workspaces for update
  using (
    exists (
      select 1 from public.workspace_members
      where workspace_id = id and user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

create policy "owners can delete workspace"
  on public.workspaces for delete
  using (owner_id = auth.uid());

-- workspace_members ---------------------------------------------------------
create policy "members can view workspace membership"
  on public.workspace_members for select
  using (public.is_workspace_member(workspace_id));

create policy "owners/admins can manage membership"
  on public.workspace_members for all
  using (
    exists (
      select 1 from public.workspace_members m
      where m.workspace_id = workspace_members.workspace_id
        and m.user_id = auth.uid() and m.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.workspace_members m
      where m.workspace_id = workspace_members.workspace_id
        and m.user_id = auth.uid() and m.role in ('owner', 'admin')
    )
  );

-- Allow a user to insert themselves as the first (owner) member when
-- creating a workspace they just created.
create policy "self can join as first member"
  on public.workspace_members for insert
  with check (user_id = auth.uid());

-- projects --------------------------------------------------------------
create policy "members can view workspace projects"
  on public.projects for select
  using (public.is_workspace_member(workspace_id));

create policy "members can create projects"
  on public.projects for insert
  with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());

create policy "members can update projects"
  on public.projects for update
  using (public.is_workspace_member(workspace_id));

create policy "members can delete projects"
  on public.projects for delete
  using (public.is_workspace_member(workspace_id));

-- generic helper macro pattern applied to every project-scoped table below:
-- members of the owning workspace (via projects.workspace_id) get full access.

-- business_profiles --------------------------------------------------------
create policy "members manage business profiles"
  on public.business_profiles for all
  using (public.is_workspace_member(public.workspace_id_for_project(project_id)))
  with check (public.is_workspace_member(public.workspace_id_for_project(project_id)));

-- design_systems --------------------------------------------------------
create policy "members manage design systems"
  on public.design_systems for all
  using (public.is_workspace_member(public.workspace_id_for_project(project_id)))
  with check (public.is_workspace_member(public.workspace_id_for_project(project_id)));

create policy "public can read design system of published website"
  on public.design_systems for select
  using (
    exists (
      select 1 from public.websites w
      where w.project_id = design_systems.project_id and w.status = 'published'
    )
  );

-- websites --------------------------------------------------------
create policy "members manage websites"
  on public.websites for all
  using (public.is_workspace_member(public.workspace_id_for_project(project_id)))
  with check (public.is_workspace_member(public.workspace_id_for_project(project_id)));

create policy "public can read published websites"
  on public.websites for select
  using (status = 'published');

-- pages --------------------------------------------------------
create policy "members manage pages"
  on public.pages for all
  using (
    public.is_workspace_member(
      public.workspace_id_for_project((select project_id from public.websites where id = website_id))
    )
  )
  with check (
    public.is_workspace_member(
      public.workspace_id_for_project((select project_id from public.websites where id = website_id))
    )
  );

create policy "public can read published pages"
  on public.pages for select
  using (
    status = 'published'
    and exists (select 1 from public.websites w where w.id = website_id and w.status = 'published')
  );

-- sections --------------------------------------------------------
create policy "members manage sections"
  on public.sections for all
  using (
    public.is_workspace_member(
      public.workspace_id_for_project(
        (select p.project_id from public.pages pg join public.websites p on p.id = pg.website_id where pg.id = page_id)
      )
    )
  )
  with check (
    public.is_workspace_member(
      public.workspace_id_for_project(
        (select p.project_id from public.pages pg join public.websites p on p.id = pg.website_id where pg.id = page_id)
      )
    )
  );

create policy "public can read sections of published pages"
  on public.sections for select
  using (
    exists (
      select 1 from public.pages pg
      join public.websites w on w.id = pg.website_id
      where pg.id = page_id and pg.status = 'published' and w.status = 'published'
    )
  );

-- site_versions --------------------------------------------------------
create policy "members manage site versions"
  on public.site_versions for all
  using (
    public.is_workspace_member(
      public.workspace_id_for_project((select project_id from public.websites where id = website_id))
    )
  )
  with check (
    public.is_workspace_member(
      public.workspace_id_for_project((select project_id from public.websites where id = website_id))
    )
  );

-- forms --------------------------------------------------------
create policy "members manage forms"
  on public.forms for all
  using (public.is_workspace_member(public.workspace_id_for_project(project_id)))
  with check (public.is_workspace_member(public.workspace_id_for_project(project_id)));

create policy "public can read forms of published websites"
  on public.forms for select
  using (
    exists (
      select 1 from public.websites w where w.project_id = forms.project_id and w.status = 'published'
    )
  );

-- leads --------------------------------------------------------
-- Intentionally no anonymous insert policy: public form submissions go
-- through a server route using the service role key, which validates the
-- form/project relationship before inserting. This prevents an anonymous
-- visitor from writing leads into an arbitrary project directly via RLS.
create policy "members manage leads"
  on public.leads for all
  using (public.is_workspace_member(public.workspace_id_for_project(project_id)))
  with check (public.is_workspace_member(public.workspace_id_for_project(project_id)));

-- conversations / messages --------------------------------------------------------
create policy "members manage conversations"
  on public.conversations for all
  using (public.is_workspace_member(public.workspace_id_for_project(project_id)))
  with check (public.is_workspace_member(public.workspace_id_for_project(project_id)));

create policy "members manage messages"
  on public.messages for all
  using (
    public.is_workspace_member(
      public.workspace_id_for_project(
        (select project_id from public.conversations where id = conversation_id)
      )
    )
  )
  with check (
    public.is_workspace_member(
      public.workspace_id_for_project(
        (select project_id from public.conversations where id = conversation_id)
      )
    )
  );

-- seo_audits --------------------------------------------------------
create policy "members manage seo audits"
  on public.seo_audits for all
  using (public.is_workspace_member(public.workspace_id_for_project(project_id)))
  with check (public.is_workspace_member(public.workspace_id_for_project(project_id)));

-- automations --------------------------------------------------------
create policy "members manage automations"
  on public.automations for all
  using (public.is_workspace_member(public.workspace_id_for_project(project_id)))
  with check (public.is_workspace_member(public.workspace_id_for_project(project_id)));

-- settings --------------------------------------------------------
create policy "members manage workspace settings"
  on public.settings for all
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- ============================================================================
-- updated_at triggers
-- ============================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'projects', 'business_profiles', 'design_systems', 'websites',
    'pages', 'sections', 'leads', 'settings'
  ]
  loop
    execute format(
      'drop trigger if exists set_updated_at on public.%I; create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at();',
      t, t
    );
  end loop;
end $$;
