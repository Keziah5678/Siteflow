-- Public, globally-unique slug used to serve a published site at /s/<slug>.
-- Distinct from projects.slug (unique only within a workspace) since public
-- URLs must be unique across the whole platform.
alter table public.websites add column if not exists public_slug text unique;

create index if not exists idx_websites_public_slug on public.websites (public_slug);

-- The public site needs to render the business's own contact details,
-- company name and social links (exactly what a visitor is meant to see on
-- the site) — so extend read access the same way design_systems already
-- allows it: only when the project's website is published.
create policy "public can read business profile of published website"
  on public.business_profiles for select
  using (
    exists (
      select 1 from public.websites w
      where w.project_id = business_profiles.project_id and w.status = 'published'
    )
  );
