-- ═══════════════════════════════════════════════════════════════════
-- SHOPTV — Row Level Security & Storage
-- Principe : lecture publique du catalogue, écriture réservée aux admins ;
-- chaque utilisateur ne lit/modifie que ses propres données.
-- ═══════════════════════════════════════════════════════════════════

alter table public.profiles          enable row level security;
alter table public.categories        enable row level security;
alter table public.brands            enable row level security;
alter table public.products          enable row level security;
alter table public.product_media     enable row level security;
alter table public.drops             enable row level security;
alter table public.drop_products     enable row level security;
alter table public.drop_follows      enable row level security;
alter table public.favorites         enable row level security;
alter table public.likes             enable row level security;
alter table public.comments          enable row level security;
alter table public.reviews           enable row level security;
alter table public.cart_items        enable row level security;
alter table public.orders            enable row level security;
alter table public.order_items       enable row level security;
alter table public.notifications     enable row level security;
alter table public.user_preferences  enable row level security;
alter table public.user_events       enable row level security;

-- ───────────── Profils
create policy "profiles: lecture de son profil ou admin" on public.profiles
  for select to authenticated using (id = (select auth.uid()) or public.is_admin());
create policy "profiles: mise à jour de son profil" on public.profiles
  for update to authenticated using (id = (select auth.uid()) or public.is_admin())
  with check (id = (select auth.uid()) or public.is_admin());

-- ───────────── Catalogue : lecture publique, écriture admin
create policy "categories: lecture publique" on public.categories for select using (true);
create policy "categories: écriture admin" on public.categories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "brands: lecture publique" on public.brands for select using (true);
create policy "brands: écriture admin" on public.brands for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "products: lecture des produits actifs" on public.products
  for select using (is_active or public.is_admin());
create policy "products: écriture admin" on public.products for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "product_media: lecture publique" on public.product_media for select using (true);
create policy "product_media: écriture admin" on public.product_media for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "drops: lecture publique" on public.drops for select using (true);
create policy "drops: écriture admin" on public.drops for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "drop_products: lecture publique" on public.drop_products for select using (true);
create policy "drop_products: écriture admin" on public.drop_products for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ───────────── Données personnelles
create policy "drop_follows: les siens" on public.drop_follows for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "favorites: les siens" on public.favorites for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "likes: les siens" on public.likes for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "cart_items: les siens" on public.cart_items for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "user_preferences: les siennes" on public.user_preferences for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "user_events: lecture des siens" on public.user_events for select to authenticated
  using (user_id = (select auth.uid()));
create policy "user_events: insertion des siens" on public.user_events for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "notifications: lecture des siennes" on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy "notifications: marquer comme lues" on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "notifications: suppression des siennes" on public.notifications for delete to authenticated
  using (user_id = (select auth.uid()));
create policy "notifications: envoi admin" on public.notifications for insert to authenticated
  with check (public.is_admin());

-- ───────────── Commentaires & avis : lecture publique, écriture par l'auteur
create policy "comments: lecture publique" on public.comments for select using (true);
create policy "comments: publier en son nom" on public.comments for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "comments: supprimer les siens ou admin" on public.comments for delete to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

create policy "reviews: lecture publique" on public.reviews for select using (true);
create policy "reviews: publier en son nom" on public.reviews for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "reviews: modifier les siens" on public.reviews for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "reviews: supprimer les siens ou admin" on public.reviews for delete to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

-- ───────────── Commandes : création via place_order() uniquement
create policy "orders: lecture des siennes ou admin" on public.orders for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());
create policy "orders: mise à jour admin" on public.orders for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "order_items: lecture via commande" on public.order_items for select to authenticated
  using (exists (
    select 1 from public.orders o
     where o.id = order_id and (o.user_id = (select auth.uid()) or public.is_admin())
  ));

-- ───────────── Droits d'exécution des fonctions
revoke execute on function public.place_order(jsonb, text) from public, anon;
grant execute on function public.place_order(jsonb, text) to authenticated;
revoke execute on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;
revoke execute on function public.notify_drop_events() from public, anon, authenticated;
grant execute on function public.increment_share(uuid) to anon, authenticated;
grant execute on function public.for_you_products(int, int) to anon, authenticated;

-- ═══════════════════════════ Storage ═══════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('product-images', 'product-images', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('product-videos', 'product-videos', true, 104857600, array['video/mp4', 'video/quicktime', 'video/webm']),
  ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "storage: lecture publique des médias" on storage.objects for select
  using (bucket_id in ('product-images', 'product-videos', 'avatars'));

create policy "storage: médias produits gérés par les admins" on storage.objects for all to authenticated
  using (bucket_id in ('product-images', 'product-videos') and public.is_admin())
  with check (bucket_id in ('product-images', 'product-videos') and public.is_admin());

-- Avatars : chaque utilisateur écrit uniquement dans « avatars/<son uid>/… »
create policy "storage: avatar personnel (insert)" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "storage: avatar personnel (update)" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "storage: avatar personnel (delete)" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
