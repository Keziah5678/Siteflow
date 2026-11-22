-- =====================================================================
-- ARTHENIS — import of the beta data model into v2. Idempotent.
--
-- Beta tables are read through to_jsonb(row), so a column missing in one
-- deployment does not break the import. Nothing is dropped: the beta tables
-- stay in place, read-only for the v2 application.
-- =====================================================================
do $$
declare
  w record;
  rules jsonb;
begin
  -- Worlds: derive a constitution from the beta flags when none exists yet.
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='worlds' and column_name='magic_enabled') then
    for w in select id, to_jsonb(x) j from public.worlds x where constitution = '{}'::jsonb loop
      rules := '[]'::jsonb;
      if exists (select 1 from pg_tables where schemaname='public' and tablename='world_rules') then
        select coalesce(jsonb_agg(jsonb_build_object('id', coalesce(r.j->>'id', md5(r.j->>'title')), 'title', r.j->>'title', 'description', coalesce(r.j->>'description',''), 'forbiddenTerms', '[]'::jsonb)), '[]'::jsonb)
        into rules
        from (select to_jsonb(wr) j from public.world_rules wr where wr.world_id = w.id) r
        where coalesce(r.j->>'category','') not in ('world','fiction','creatures','magic');
      end if;
      update public.worlds set
        constitution = jsonb_build_object(
          'worldType', case when coalesce((w.j->>'fiction_enabled')::boolean, true) then 'invente' else 'realiste' end,
          'era', 'médiéval',
          'magic', jsonb_build_object('allowed', coalesce((w.j->>'magic_enabled')::boolean, false), 'system', '', 'cost', ''),
          'creatures', jsonb_build_object('fictional', coalesce((w.j->>'fictional_creatures_enabled')::boolean, false), 'deities', false, 'intelligentSpecies', coalesce((w.j->>'fiction_enabled')::boolean, false)),
          'geography', coalesce(w.j->>'theme', ''),
          'fundamentalRules', rules,
          'importedFrom', 'beta'),
        tick = greatest(0, coalesce((w.j->'world_memory'->>'day')::bigint, 1) - 1),
        visibility = case when coalesce((w.j->>'is_public')::boolean, false) then 'public' else 'private' end
      where id = w.id;
    end loop;
  end if;

  if exists (select 1 from pg_tables where schemaname='public' and tablename='regions') then
    insert into public.entities(id, world_id, kind, name, summary, x, y, data, image_url, created_by, created_at)
    select (j->>'id')::uuid, (j->>'world_id')::uuid, 'region', left(coalesce(nullif(j->>'name',''),'Région'),160), left(coalesce(j->>'description',''),4000),
      least(100, greatest(0, (j->>'x')::double precision)), least(100, greatest(0, (j->>'y')::double precision)),
      jsonb_strip_nulls(jsonb_build_object('biome', j->'biome', 'climate', j->'climate', 'resources', j->'resources', 'legacy', 'regions')),
      j->>'image_url', (select owner_id from public.worlds where id = (j->>'world_id')::uuid), coalesce((j->>'created_at')::timestamptz, now())
    from (select to_jsonb(r) j from public.regions r) s
    where exists (select 1 from public.worlds where id = (j->>'world_id')::uuid)
    on conflict (id) do nothing;
  end if;

  if exists (select 1 from pg_tables where schemaname='public' and tablename='civilizations') then
    insert into public.entities(id, world_id, kind, name, summary, parent_id, x, y, data, image_url, created_by, created_at)
    select (j->>'id')::uuid, (j->>'world_id')::uuid, case when j->>'culture' = 'Village' then 'village' else 'civilization' end,
      left(coalesce(nullif(j->>'name',''),'Civilisation'),160), left(coalesce(j->>'description',''),4000),
      (select e.id from public.entities e where e.id = (j->>'region_id')::uuid),
      least(100, greatest(0, (j->>'x')::double precision)), least(100, greatest(0, (j->>'y')::double precision)),
      jsonb_strip_nulls(jsonb_build_object('culture', j->'culture', 'techLevel', j->'technology_level', 'legacy', 'civilizations')),
      j->>'image_url', (select owner_id from public.worlds where id = (j->>'world_id')::uuid), coalesce((j->>'created_at')::timestamptz, now())
    from (select to_jsonb(r) j from public.civilizations r) s
    where exists (select 1 from public.worlds where id = (j->>'world_id')::uuid)
    on conflict (id) do nothing;
  end if;

  if exists (select 1 from pg_tables where schemaname='public' and tablename='characters') then
    insert into public.entities(id, world_id, kind, name, summary, data, image_url, created_by, created_at)
    select (j->>'id')::uuid, (j->>'world_id')::uuid, 'character', left(coalesce(nullif(j->>'name',''),'Personnage'),160),
      left(coalesce(j->>'biography', j->>'description', ''),4000), jsonb_build_object('legacy', 'characters'),
      j->>'image_url', (select owner_id from public.worlds where id = (j->>'world_id')::uuid), coalesce((j->>'created_at')::timestamptz, now())
    from (select to_jsonb(r) j from public.characters r) s
    where exists (select 1 from public.worlds where id = (j->>'world_id')::uuid)
    on conflict (id) do nothing;
  end if;

  if exists (select 1 from pg_tables where schemaname='public' and tablename='creatures') then
    insert into public.entities(id, world_id, kind, name, summary, data, image_url, created_by, created_at)
    select (j->>'id')::uuid, (j->>'world_id')::uuid,
      case when coalesce((select (w2.constitution->'creatures'->>'fictional')::boolean from public.worlds w2 where w2.id = (j->>'world_id')::uuid), true) then 'creature' else 'animal' end,
      left(coalesce(nullif(j->>'name',''),'Créature'),160), left(coalesce(j->>'description',''),4000), jsonb_build_object('legacy', 'creatures'),
      j->>'image_url', (select owner_id from public.worlds where id = (j->>'world_id')::uuid), coalesce((j->>'created_at')::timestamptz, now())
    from (select to_jsonb(r) j from public.creatures r) s
    where exists (select 1 from public.worlds where id = (j->>'world_id')::uuid)
    on conflict (id) do nothing;
  end if;

  if exists (select 1 from pg_tables where schemaname='public' and tablename='timeline_events') then
    insert into public.world_events(id, world_id, tick, title, description, kind, consequences, source, created_at)
    select (j->>'id')::uuid, (j->>'world_id')::uuid, greatest(0, coalesce((j->>'world_day')::bigint, 1) - 1),
      left(coalesce(nullif(j->>'title',''),'Événement'),240), coalesce(j->>'description',''), 'narrative',
      case when jsonb_typeof(j->'consequences') = 'array' then j->'consequences' else '[]'::jsonb end, 'system',
      coalesce((j->>'created_at')::timestamptz, now())
    from (select to_jsonb(r) j from public.timeline_events r) s
    where exists (select 1 from public.worlds where id = (j->>'world_id')::uuid)
    on conflict (id) do nothing;
  end if;
end $$;
