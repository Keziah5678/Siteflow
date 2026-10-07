-- ═══════════════════════════════════════════════════════════════════
-- SHOPTV — Schéma principal
-- Tables, relations, index, triggers et fonctions métier.
-- La sécurité (RLS + storage) est dans la migration suivante.
-- ═══════════════════════════════════════════════════════════════════

create extension if not exists pg_trgm;

-- ───────────────────────── Utilitaires ─────────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ───────────────────────── Profils ─────────────────────────────────

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null default '',
  full_name   text not null default '',
  avatar_url  text,
  role        text not null default 'user' check (role in ('user', 'admin')),
  addresses   jsonb not null default '[]'::jsonb,
  push_token  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Rôle admin : fonction SECURITY DEFINER pour éviter toute récursion RLS.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  );
$$;

-- Création automatique du profil à l'inscription (email, Apple, Google…).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  insert into public.user_preferences (user_id) values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- Un utilisateur ne peut pas s'auto-promouvoir administrateur.
-- Promotion : `update public.profiles set role = 'admin' where email = '…';` dans l'éditeur SQL.
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.uid() nul = éditeur SQL / service role (contexte de confiance).
  if new.role is distinct from old.role and auth.uid() is not null and not public.is_admin() then
    raise exception 'Seul un administrateur peut modifier un rôle';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_role before update on public.profiles
  for each row execute function public.protect_profile_role();

-- ───────────────────────── Catalogue ───────────────────────────────

create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  icon        text not null default 'grid-outline',
  image_url   text,
  parent_id   uuid references public.categories (id) on delete set null,
  sort_order  int not null default 0,
  is_popular  boolean not null default false,
  created_at  timestamptz not null default now()
);
create index categories_parent_idx on public.categories (parent_id);
create index categories_sort_idx on public.categories (sort_order);

create table public.brands (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  logo_url    text,
  monogram    text not null default '',
  is_featured boolean not null default false,
  created_at  timestamptz not null default now()
);
create index brands_featured_idx on public.brands (is_featured) where is_featured;
create index brands_name_trgm_idx on public.brands using gin (name gin_trgm_ops);

create table public.products (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  slug                text not null unique,
  tagline             text not null default '',
  description         text not null default '',
  price               numeric(10, 2) not null check (price >= 0),
  compare_at_price    numeric(10, 2) check (compare_at_price is null or compare_at_price >= 0),
  discount_percentage int generated always as (
    case
      when compare_at_price is not null and compare_at_price > price and compare_at_price > 0
        then round(((compare_at_price - price) / compare_at_price) * 100)::int
      else 0
    end
  ) stored,
  brand_id            uuid references public.brands (id) on delete set null,
  category_id         uuid references public.categories (id) on delete set null,
  stock               int not null default 0 check (stock >= 0),
  rating              numeric(2, 1) not null default 0 check (rating between 0 and 5),
  review_count        int not null default 0,
  shipping_info       text not null default 'Livraison 2-4 jours',
  warranty            text not null default 'Garantie 2 ans',
  features            jsonb not null default '[]'::jsonb,
  variants            jsonb not null default '[]'::jsonb,
  cover_url           text not null default '',
  video_url           text,
  likes_count         int not null default 0,
  comments_count      int not null default 0,
  shares_count        int not null default 0,
  popularity          int not null default 0,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index products_category_idx on public.products (category_id) where is_active;
create index products_brand_idx on public.products (brand_id) where is_active;
create index products_popularity_idx on public.products (popularity desc, id) where is_active;
create index products_created_idx on public.products (created_at desc) where is_active;
create index products_price_idx on public.products (price) where is_active;
create index products_discount_idx on public.products (discount_percentage desc) where is_active;
create index products_name_trgm_idx on public.products using gin (name gin_trgm_ops);
create index products_tagline_trgm_idx on public.products using gin (tagline gin_trgm_ops);

create trigger products_updated_at before update on public.products
  for each row execute function public.set_updated_at();

create table public.product_media (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products (id) on delete cascade,
  type        text not null check (type in ('image', 'video')),
  url         text not null,          -- URL absolue ou chemin Storage « bucket/chemin »
  poster_url  text,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);
create index product_media_product_idx on public.product_media (product_id, sort_order);

-- ───────────────────────── Drops ───────────────────────────────────

create table public.drops (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  subtitle    text not null default '',
  description text not null default '',
  image_url   text not null default '',
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  is_mega     boolean not null default false,
  notified_soon_at timestamptz,
  notified_live_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint drops_dates_check check (ends_at > starts_at)
);
create index drops_starts_idx on public.drops (starts_at);
create index drops_ends_idx on public.drops (ends_at);

create trigger drops_updated_at before update on public.drops
  for each row execute function public.set_updated_at();

-- Statut calculé (change automatiquement avec le temps, jamais désynchronisé).
create or replace function public.drop_status(p_starts timestamptz, p_ends timestamptz)
returns text
language sql
stable
as $$
  select case
    when now() < p_starts then 'upcoming'
    when now() < p_ends then 'live'
    else 'ended'
  end;
$$;

create table public.drop_products (
  drop_id     uuid not null references public.drops (id) on delete cascade,
  product_id  uuid not null references public.products (id) on delete cascade,
  sort_order  int not null default 0,
  primary key (drop_id, product_id)
);
create index drop_products_product_idx on public.drop_products (product_id);

create view public.drops_with_status
with (security_invoker = true) as
  select d.*, public.drop_status(d.starts_at, d.ends_at) as status
  from public.drops d;

create table public.drop_follows (
  user_id     uuid not null references auth.users (id) on delete cascade,
  drop_id     uuid not null references public.drops (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, drop_id)
);
create index drop_follows_drop_idx on public.drop_follows (drop_id);

-- ───────────────────────── Interactions ────────────────────────────

create table public.favorites (
  user_id     uuid not null references auth.users (id) on delete cascade,
  product_id  uuid not null references public.products (id) on delete cascade,
  kind        text not null default 'product' check (kind in ('product', 'video')),
  created_at  timestamptz not null default now(),
  primary key (user_id, product_id, kind)
);
create index favorites_product_idx on public.favorites (product_id);

create table public.likes (
  user_id     uuid not null references auth.users (id) on delete cascade,
  product_id  uuid not null references public.products (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, product_id)
);
create index likes_product_idx on public.likes (product_id);

create table public.comments (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products (id) on delete cascade,
  user_id     uuid references auth.users (id) on delete set null,
  author_name text not null default '',
  body        text not null check (char_length(body) between 1 and 500),
  created_at  timestamptz not null default now()
);
create index comments_product_idx on public.comments (product_id, created_at desc);

create table public.reviews (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products (id) on delete cascade,
  user_id     uuid references auth.users (id) on delete set null,
  author_name text not null default '',
  rating      int not null check (rating between 1 and 5),
  title       text not null default '',
  body        text not null default '' check (char_length(body) <= 2000),
  created_at  timestamptz not null default now(),
  unique (product_id, user_id)
);
create index reviews_product_idx on public.reviews (product_id, created_at desc);

-- Compteurs dénormalisés (lecture instantanée dans le flux).
create or replace function public.bump_product_counter()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  delta int := case when tg_op = 'INSERT' then 1 else -1 end;
  pid uuid := coalesce(new.product_id, old.product_id);
begin
  if tg_table_name = 'likes' then
    update public.products set likes_count = greatest(0, likes_count + delta), popularity = popularity + delta where id = pid;
  elsif tg_table_name = 'comments' then
    update public.products set comments_count = greatest(0, comments_count + delta) where id = pid;
  end if;
  return null;
end;
$$;

create trigger likes_counter after insert or delete on public.likes
  for each row execute function public.bump_product_counter();
create trigger comments_counter after insert or delete on public.comments
  for each row execute function public.bump_product_counter();

create or replace function public.apply_review_to_product()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.products
     set rating = round(((rating * review_count) + new.rating) / (review_count + 1), 1),
         review_count = review_count + 1
   where id = new.product_id;
  return null;
end;
$$;

create trigger reviews_apply after insert on public.reviews
  for each row execute function public.apply_review_to_product();

-- Partages : simple incrément, appelable par tous (anonymes compris).
create or replace function public.increment_share(p_product_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.products set shares_count = shares_count + 1, popularity = popularity + 1 where id = p_product_id;
$$;

-- ───────────────────────── Panier & commandes ──────────────────────

create table public.cart_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  product_id  uuid not null references public.products (id) on delete cascade,
  variant_id  text not null default '',
  quantity    int not null default 1 check (quantity between 1 and 20),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, product_id, variant_id)
);
create index cart_items_user_idx on public.cart_items (user_id);

create trigger cart_items_updated_at before update on public.cart_items
  for each row execute function public.set_updated_at();

create sequence public.order_number_seq start 10001;

create table public.orders (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  number            text not null unique default ('STV-' || nextval('public.order_number_seq')),
  status            text not null default 'pending'
                    check (status in ('pending', 'paid', 'preparing', 'shipped', 'delivered', 'cancelled')),
  subtotal          numeric(10, 2) not null,
  shipping          numeric(10, 2) not null default 0,
  total             numeric(10, 2) not null,
  shipping_address  jsonb not null,
  payment_method    text not null default 'card',
  stripe_payment_intent_id text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index orders_user_idx on public.orders (user_id, created_at desc);
create index orders_status_idx on public.orders (status);
create index orders_created_idx on public.orders (created_at desc);

create trigger orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

create table public.order_items (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references public.orders (id) on delete cascade,
  product_id     uuid references public.products (id) on delete set null,
  product_name   text not null,
  product_image  text not null default '',
  variant_label  text,
  unit_price     numeric(10, 2) not null,
  quantity       int not null check (quantity > 0)
);
create index order_items_order_idx on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id);

-- Création de commande côté serveur : les prix viennent de la base,
-- jamais du client. Le stock est vérifié et décrémenté atomiquement.
create or replace function public.place_order(p_address jsonb, p_payment_method text default 'card')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_order uuid;
  v_subtotal numeric(10, 2);
  v_shipping numeric(10, 2);
  v_line record;
begin
  if v_user is null then
    raise exception 'Authentification requise';
  end if;

  if not exists (select 1 from public.cart_items where user_id = v_user) then
    raise exception 'Panier vide';
  end if;

  -- Verrouille les produits concernés et vérifie le stock.
  for v_line in
    select c.product_id, c.quantity, p.stock, p.name
      from public.cart_items c
      join public.products p on p.id = c.product_id
     where c.user_id = v_user
       for update of p
  loop
    if v_line.stock < v_line.quantity then
      raise exception 'Stock insuffisant pour %', v_line.name;
    end if;
  end loop;

  select coalesce(sum(p.price * c.quantity), 0)
    into v_subtotal
    from public.cart_items c
    join public.products p on p.id = c.product_id
   where c.user_id = v_user and p.is_active;

  v_shipping := case when v_subtotal >= 50 then 0 else 4.99 end;

  insert into public.orders (user_id, status, subtotal, shipping, total, shipping_address, payment_method)
  values (v_user, 'pending', v_subtotal, v_shipping, v_subtotal + v_shipping, p_address, coalesce(p_payment_method, 'card'))
  returning id into v_order;

  insert into public.order_items (order_id, product_id, product_name, product_image, variant_label, unit_price, quantity)
  select v_order,
         p.id,
         p.name,
         p.cover_url,
         nullif(c.variant_id, ''),
         p.price,
         c.quantity
    from public.cart_items c
    join public.products p on p.id = c.product_id
   where c.user_id = v_user and p.is_active;

  update public.products p
     set stock = p.stock - c.quantity,
         popularity = p.popularity + c.quantity * 5
    from public.cart_items c
   where c.user_id = v_user and c.product_id = p.id;

  insert into public.user_events (user_id, type, product_id, category_id)
  select v_user, 'purchase', p.id, p.category_id
    from public.cart_items c join public.products p on p.id = c.product_id
   where c.user_id = v_user;

  delete from public.cart_items where user_id = v_user;

  return v_order;
end;
$$;

-- ───────────────────────── Notifications ───────────────────────────

create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  type        text not null check (type in ('drop_soon', 'drop_live', 'price_drop', 'back_in_stock', 'order', 'shipping', 'promotion')),
  title       text not null,
  body        text not null default '',
  data        jsonb not null default '{}'::jsonb,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

-- ───────────────────────── Personnalisation ────────────────────────

create table public.user_preferences (
  user_id               uuid primary key references auth.users (id) on delete cascade,
  notification_settings jsonb not null default '{"drops": true, "priceDrops": true, "orders": true, "promotions": false}'::jsonb,
  favorite_category_ids uuid[] not null default '{}',
  onboarding_completed  boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create trigger user_preferences_updated_at before update on public.user_preferences
  for each row execute function public.set_updated_at();

-- Journal d'événements (vues, likes, favoris, achats, temps de visionnage)
-- exploité par le moteur de recommandation.
create table public.user_events (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  type        text not null check (type in ('view_product', 'view_category', 'like', 'favorite', 'purchase', 'watch')),
  product_id  uuid references public.products (id) on delete cascade,
  category_id uuid references public.categories (id) on delete set null,
  value       numeric,
  created_at  timestamptz not null default now()
);
create index user_events_user_idx on public.user_events (user_id, created_at desc);
create index user_events_product_idx on public.user_events (product_id);

-- Le trigger d'inscription référence user_preferences : créé après la table.
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- « Pour toi » côté serveur : affinité catégorie (pondérée par type
-- d'événement) + popularité + remise. Remplaçable par un moteur ML.
create or replace function public.for_you_products(p_limit int default 10, p_offset int default 0)
returns setof public.products
language sql
stable
security invoker
set search_path = public
as $$
  with affinity as (
    select e.category_id,
           sum(case e.type
                 when 'purchase' then 8
                 when 'favorite' then 5
                 when 'like' then 3
                 when 'watch' then least(coalesce(e.value, 0) / 10, 4)
                 when 'view_product' then 1.5
                 else 1
               end * exp(-extract(epoch from now() - e.created_at) / 1209600.0)) as score
      from public.user_events e
     where e.user_id = auth.uid() and e.category_id is not null
     group by e.category_id
  )
  select p.*
    from public.products p
    left join affinity a on a.category_id = p.category_id
   where p.is_active
   order by coalesce(a.score, 0) * 10 + p.popularity * 0.5 + p.discount_percentage * 0.3 desc, p.id
   limit greatest(1, least(p_limit, 50))
  offset greatest(0, p_offset);
$$;

-- ───────────────────────── Notifications automatiques ──────────────

-- Baisse de prix / retour en stock → utilisateurs ayant le produit en favori.
create or replace function public.notify_product_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.price < old.price then
    insert into public.notifications (user_id, type, title, body, data)
    select distinct f.user_id, 'price_drop',
           'Baisse de prix 🔥',
           new.name || ' passe à ' || replace(to_char(new.price, 'FM9999990.00'), '.', ',') || ' €',
           jsonb_build_object('productId', new.id, 'slug', new.slug)
      from public.favorites f
     where f.product_id = new.id;
  end if;

  if old.stock = 0 and new.stock > 0 then
    insert into public.notifications (user_id, type, title, body, data)
    select distinct f.user_id, 'back_in_stock',
           'De retour en stock',
           new.name || ' est à nouveau disponible.',
           jsonb_build_object('productId', new.id, 'slug', new.slug)
      from public.favorites f
     where f.product_id = new.id;
  end if;
  return new;
end;
$$;

create trigger products_notify after update of price, stock on public.products
  for each row execute function public.notify_product_changes();

-- Suivi de commande.
create or replace function public.notify_order_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text := case when new.status in ('shipped', 'delivered') then 'shipping' else 'order' end;
  v_label text := case new.status
    when 'pending' then 'Commande reçue'
    when 'paid' then 'Paiement confirmé'
    when 'preparing' then 'Commande en préparation'
    when 'shipped' then 'Commande expédiée 🚚'
    when 'delivered' then 'Commande livrée 📦'
    else 'Commande annulée'
  end;
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.notifications (user_id, type, title, body, data)
    values (new.user_id, v_type, v_label, 'Commande ' || new.number,
            jsonb_build_object('orderId', new.id));
  end if;
  return new;
end;
$$;

create trigger orders_notify after insert or update of status on public.orders
  for each row execute function public.notify_order_status();

-- Drop imminent (≤ 15 min) / Drop disponible → abonnés du Drop.
-- À planifier chaque minute avec pg_cron (voir README) :
--   select cron.schedule('shoptv-drops', '* * * * *', 'select public.notify_drop_events()');
create or replace function public.notify_drop_events()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d record;
begin
  for d in
    select * from public.drops
     where notified_soon_at is null
       and starts_at > now()
       and starts_at <= now() + interval '15 minutes'
  loop
    insert into public.notifications (user_id, type, title, body, data)
    select f.user_id, 'drop_soon', d.title || ' commence bientôt ⏰', 'Rendez-vous dans quelques minutes.',
           jsonb_build_object('dropId', d.id)
      from public.drop_follows f where f.drop_id = d.id;
    update public.drops set notified_soon_at = now() where id = d.id;
  end loop;

  for d in
    select * from public.drops
     where notified_live_at is null
       and starts_at <= now()
       and ends_at > now()
  loop
    insert into public.notifications (user_id, type, title, body, data)
    select f.user_id, 'drop_live', d.title || ' est en ligne 🔥', 'Les produits sont disponibles maintenant.',
           jsonb_build_object('dropId', d.id)
      from public.drop_follows f where f.drop_id = d.id;
    update public.drops set notified_live_at = now() where id = d.id;
  end loop;
end;
$$;

-- ───────────────────────── Administration ──────────────────────────

create or replace function public.admin_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Accès réservé aux administrateurs';
  end if;

  select jsonb_build_object(
    'revenue', coalesce((select sum(total) from public.orders where status <> 'cancelled'), 0),
    'orders', (select count(*) from public.orders),
    'users', (select count(*) from public.profiles),
    'products', (select count(*) from public.products where is_active),
    'salesByDay', coalesce((
      select jsonb_agg(jsonb_build_object('day', day, 'total', total) order by day)
        from (
          select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day, sum(total) as total
            from public.orders
           where status <> 'cancelled' and created_at > now() - interval '14 days'
           group by 1
        ) s
    ), '[]'::jsonb),
    'topProducts', coalesce((
      select jsonb_agg(t order by t.quantity desc)
        from (
          select oi.product_id as "productId", max(oi.product_name) as name,
                 sum(oi.quantity) as quantity, sum(oi.quantity * oi.unit_price) as revenue
            from public.order_items oi
            join public.orders o on o.id = oi.order_id and o.status <> 'cancelled'
           group by oi.product_id
           order by sum(oi.quantity) desc
           limit 5
        ) t
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;
