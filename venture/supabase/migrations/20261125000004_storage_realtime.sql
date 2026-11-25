-- =============================================================================
-- VENTURE — Storage buckets & Realtime
-- Paths:
--   avatars/<user_id>/<file>                public read, owner write
--   covers/<user_id>/<file>                 public read, owner write
--   project-files/<project_id>/<file>       team members only
--   message-files/<conversation_id>/<file>  conversation participants only
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', true, 2097152, array['image/png', 'image/jpeg', 'image/webp']),
  ('covers', 'covers', true, 5242880, array['image/png', 'image/jpeg', 'image/webp']),
  ('project-files', 'project-files', false, 26214400, null),
  ('message-files', 'message-files', false, 10485760, null)
on conflict (id) do nothing;

create policy "avatars public read" on storage.objects for select using (bucket_id = 'avatars');
create policy "avatars owner write" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars owner update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "covers public read" on storage.objects for select using (bucket_id = 'covers');
create policy "covers owner write" on storage.objects for insert to authenticated
  with check (bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "covers owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text);

create or replace function public.try_uuid(t text) returns uuid
language plpgsql immutable as $$
begin
  return t::uuid;
exception when others then
  return null;
end $$;

create policy "project files members read" on storage.objects for select to authenticated
  using (bucket_id = 'project-files' and public.is_project_member(public.try_uuid((storage.foldername(name))[1])));
create policy "project files members write" on storage.objects for insert to authenticated
  with check (bucket_id = 'project-files' and public.is_project_member(public.try_uuid((storage.foldername(name))[1])));
create policy "project files members delete" on storage.objects for delete to authenticated
  using (bucket_id = 'project-files' and public.is_project_member(public.try_uuid((storage.foldername(name))[1])));

create policy "message files participants read" on storage.objects for select to authenticated
  using (bucket_id = 'message-files' and public.is_conversation_participant(public.try_uuid((storage.foldername(name))[1])));
create policy "message files participants write" on storage.objects for insert to authenticated
  with check (bucket_id = 'message-files' and public.is_conversation_participant(public.try_uuid((storage.foldername(name))[1])));

-- Realtime: postgres_changes honours RLS, so only participants / recipients
-- receive events.
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.milestones;
