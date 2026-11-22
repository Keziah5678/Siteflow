\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned
create schema if not exists t;
grant usage on schema t to anon, authenticated;
create or replace function t.fails(q text) returns boolean language plpgsql as $$
begin execute q; return false; exception when others then return true; end $$;
create or replace function t.ok(cond boolean, label text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'FAIL: %', label; end if; raise notice 'ok - %', label; end $$;
grant execute on all functions in schema t to anon, authenticated;

create or replace function t.as_user(uid text, email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid, false);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'email', email)::text, false);
end $$;
grant execute on function t.as_user(text, text) to anon, authenticated;

\set W '''b0000000-0000-4000-8000-000000000001'''
\set CREATOR '''a0000000-0000-4000-8000-000000000001'''

-- ---------------------------------------------------------------- import
select t.ok((select count(*) from public.entities where world_id = :W) = 4, 'beta rows imported into entities');
select t.ok((select kind from public.entities where name = 'Loup blanc') = 'animal', 'beta creature becomes animal when fictional creatures are off');
select t.ok((select parent_id from public.entities where name = 'Clans du Givre') = 'c0000000-0000-4000-8000-000000000001', 'civilization keeps its region');
select t.ok((select tick from public.worlds where id = :W) = 11, 'beta day becomes tick');
select t.ok((select constitution->'magic'->>'allowed' from public.worlds where id = :W) = 'false', 'constitution derived from beta flags');
select t.ok((select jsonb_array_length(constitution->'fundamentalRules') from public.worlds where id = :W) = 1, 'custom beta rule imported');
select t.ok((select role from public.world_members where user_id = 'a0000000-0000-4000-8000-000000000004') = 'reader', 'beta viewer → reader');
select t.ok((select role from public.world_members where user_id = 'a0000000-0000-4000-8000-000000000006') = 'guardian', 'beta creator-role → guardian');
select t.ok((select role from public.world_members where user_id = :CREATOR) = 'creator', 'owner has creator membership');
select t.ok((select count(*) from public.world_events where world_id = :W) = 1, 'beta timeline imported');
select t.ok((select count(*) from pg_policies where tablename = 'worlds' and policyname = 'legacy_too_open') = 0, 'beta permissive policy removed');
select t.ok((select count(*) from public.revisions where world_id = :W and change_type = 'create') = 4, 'imports leave create revisions');

-- --------------------------------------------------------------- stranger
select t.as_user('a0000000-0000-4000-8000-000000000005', 'stranger@test.dev');
set role authenticated;
select t.ok((select count(*) from public.worlds where id = :W) = 0, 'stranger cannot see a private world');
select t.ok((select count(*) from public.entities where world_id = :W) = 0, 'stranger cannot read its entities');
select t.ok(t.fails($$insert into public.entities(world_id, kind, name, created_by) values ('b0000000-0000-4000-8000-000000000001','city','Intrus','a0000000-0000-4000-8000-000000000005')$$), 'stranger cannot write');
select t.ok(t.fails($$insert into public.world_members(world_id, user_id, role) values ('b0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000005','admin')$$), 'stranger cannot self-invite');
-- stranger creates own world
insert into public.worlds(id, owner_id, name) values ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000005', 'Mon monde');
select t.ok((select role from public.world_members where world_id = 'b0000000-0000-4000-8000-000000000002') = 'creator', 'new world gets a creator membership');
select t.ok(t.fails($$insert into public.worlds(owner_id, name) values ('a0000000-0000-4000-8000-000000000001', 'Usurpation')$$), 'cannot create a world for someone else');
reset role;

-- ------------------------------------------------------------- reader
select t.as_user('a0000000-0000-4000-8000-000000000004', 'reader@test.dev');
set role authenticated;
select t.ok((select count(*) from public.entities where world_id = :W) = 4, 'reader reads the canon');
select t.ok(t.fails($$insert into public.proposals(world_id, author_id, action, payload) values ('b0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000004','create','{}')$$), 'reader cannot propose');
select t.ok(t.fails($$update public.entities set name = 'Hacked' where world_id = 'b0000000-0000-4000-8000-000000000001'$$) or (select count(*) from public.entities where name = 'Hacked') = 0, 'reader cannot edit');
reset role;

-- -------------------------------------------------------- contributor
select t.as_user('a0000000-0000-4000-8000-000000000003', 'contrib@test.dev');
set role authenticated;
select t.ok(t.fails($$select public.arthenis_save_entity('b0000000-0000-4000-8000-000000000001', '{"kind":"city","name":"Direct"}')$$), 'contributor cannot write directly in a proposals world');
insert into public.proposals(id, world_id, author_id, action, payload) values ('d0000000-0000-4000-8000-000000000001', :W, 'a0000000-0000-4000-8000-000000000003', 'create', '{"entity":{"kind":"village","name":"Brumeval","summary":"Village de bûcherons"}}');
select t.ok(t.fails($$update public.proposals set status = 'approved' where id = 'd0000000-0000-4000-8000-000000000001'$$), 'contributor cannot approve own proposal');
select t.ok(t.fails($$delete from public.world_events$$), 'no one deletes history (contributor)');
reset role;
select t.ok((select count(*) from public.notifications where title = 'Nouvelle proposition') = 3, 'reviewers (creator, admin, guardian) notified');

-- ----------------------------------------------------------- guardian
select t.as_user('a0000000-0000-4000-8000-000000000006', 'guardian@test.dev');
set role authenticated;
select t.ok(public.arthenis_review_proposal('d0000000-0000-4000-8000-000000000001', true, 'Cohérent') is not null, 'guardian approves → entity written');
select t.ok((select count(*) from public.entities where name = 'Brumeval') = 1, 'approved proposal is canon');
select t.ok(t.fails($$select public.arthenis_apply_simulation('b0000000-0000-4000-8000-000000000001', '{"id":"e0000000-0000-4000-8000-000000000001","fromTick":11,"toTick":12,"seed":1}')$$), 'guardian cannot advance time');
select t.ok(t.fails($$update public.worlds set tick = 50 where id = 'b0000000-0000-4000-8000-000000000001'$$) or (select tick from public.worlds where id = 'b0000000-0000-4000-8000-000000000001') = 11, 'guardian cannot set tick directly');
reset role;
select t.ok((select count(*) from public.notifications where user_id = 'a0000000-0000-4000-8000-000000000003' and title = 'Proposition acceptée') = 1, 'author notified of approval');

-- -------------------------------------------------------------- admin
select t.as_user('a0000000-0000-4000-8000-000000000002', 'admin@test.dev');
set role authenticated;
select t.ok(t.fails($$select public.arthenis_amend_constitution('b0000000-0000-4000-8000-000000000001', '{"magic":{"allowed":true}}', 'test')$$), 'admin cannot amend laws');
select t.ok(t.fails($$update public.worlds set constitution = '{}' where id = 'b0000000-0000-4000-8000-000000000001'$$), 'constitution cannot be changed by a plain update');
select t.ok(t.fails($$insert into public.world_members(world_id, user_id, role) values ('b0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000005','admin')$$), 'admin cannot create another admin');
insert into public.world_invitations(world_id, email, role, invited_by) values (:W, 'stranger@test.dev', 'contributor', 'a0000000-0000-4000-8000-000000000002');
select t.ok(public.arthenis_apply_simulation(:W, jsonb_build_object(
  'id','e0000000-0000-4000-8000-000000000002','fromTick',11,'toTick',371,'seed',42,
  'events', jsonb_build_array(jsonb_build_object('tick',200,'title','Grand hiver','description','Froid','kind','catastrophe','entityIds', jsonb_build_array('c0000000-0000-4000-8000-000000000001'))),
  'changes', jsonb_build_array(jsonb_build_object('id','c0000000-0000-4000-8000-000000000001','after', jsonb_build_object('data', jsonb_build_object('population', 10)))),
  'newEntities', jsonb_build_array(jsonb_build_object('id','f0000000-0000-4000-8000-000000000001','kind','npc','name','Bribrei','bornTick',300,'data','{}'::jsonb)),
  'newRelations', '[]'::jsonb, 'endedRelations', '[]'::jsonb)) = 371, 'admin applies a simulation atomically');
select t.ok((select tick from public.worlds where id = :W) = 371, 'tick advanced');
select t.ok((select change_type from public.revisions where target_id = 'c0000000-0000-4000-8000-000000000001' order by version desc limit 1) = 'simulation', 'simulation leaves simulation revisions');
select t.ok(t.fails($$select public.arthenis_apply_simulation('b0000000-0000-4000-8000-000000000001', '{"id":"e0000000-0000-4000-8000-000000000003","fromTick":11,"toTick":20,"seed":1}')$$), 'stale preview refused');
select t.ok((select count(*) from public.simulations) = 1, 'stale preview left nothing behind');
select t.ok(t.fails($$update public.world_events set title = 'Réécrit' where title = 'Grand hiver'$$), 'events are immutable');
select t.ok(t.fails($$delete from public.revisions$$), 'revisions cannot be deleted');
select t.ok(public.arthenis_correct_event((select id from public.world_events where title = 'Grand hiver'), 'Hiver rigoureux', 'Froid, sans catastrophe', 'Exagération corrigée') is not null, 'admin can correct an event');
select t.ok((select canon from public.world_events where title = 'Grand hiver') = false, 'original kept, marked non-canon');
reset role;

-- ------------------------------------------------- invitation accepted
select t.as_user('a0000000-0000-4000-8000-000000000004', 'reader@test.dev');
set role authenticated;
select t.ok(t.fails($$select public.arthenis_accept_invitation((select id from public.world_invitations limit 1))$$), 'invitation cannot be accepted by someone else');
reset role;
select t.as_user('a0000000-0000-4000-8000-000000000005', 'stranger@test.dev');
set role authenticated;
select t.ok(public.arthenis_accept_invitation((select id from public.world_invitations where email = 'stranger@test.dev')) = :W, 'invitee accepts');
select t.ok((select count(*) from public.entities where world_id = :W) >= 5, 'new member now reads the world');
reset role;

-- ------------------------------------------------------------ creator
select t.as_user('a0000000-0000-4000-8000-000000000001', 'creator@test.dev');
set role authenticated;
select t.ok(public.arthenis_amend_constitution(:W, (select constitution || '{"magic":{"allowed":true,"system":"Runes","cost":"Sang"}}' from public.worlds where id = :W), 'La magie s''éveille',
  jsonb_build_object('changes', jsonb_build_array('Magie : autorisée'), 'newlyConflicting', jsonb_build_array(jsonb_build_object('entityId','c0000000-0000-4000-8000-000000000001')))) = 2, 'creator amends the constitution');
select t.ok((select constitution->'magic'->>'allowed' from public.worlds where id = :W) = 'true', 'new law in force');
select t.ok((select count(*) from public.revisions where target_type = 'constitution') = 1, 'amendment recorded with before/after');
select t.ok((select tensions from public.entities where id = 'c0000000-0000-4000-8000-000000000001') = array['constitution:v2'], 'impacted entity flagged, not deleted');
select t.ok(t.fails($$update public.worlds set tick = 1 where id = 'b0000000-0000-4000-8000-000000000001'$$), 'time cannot go backwards');
select t.ok(t.fails($$delete from public.entities$$), 'creator cannot hard-delete canon');
select t.ok((select version from public.arthenis_save_entity(:W, '{"id":"c0000000-0000-4000-8000-000000000001","summary":"Pics gelés et ruines"}', 'correction', 'faute de frappe', 3)) = 4, 'correction with optimistic version');
select t.ok(t.fails($$select public.arthenis_save_entity('b0000000-0000-4000-8000-000000000001', '{"id":"c0000000-0000-4000-8000-000000000001","summary":"x"}', 'update', '', 1)$$), 'stale version refused');
select t.ok(t.fails($$select public.arthenis_save_entity('b0000000-0000-4000-8000-000000000001', '{"kind":"city","name":"Lointaine","parentId":"c0000000-0000-4000-8000-000000000099"}')$$), 'parent must exist in the same world');
update public.worlds set visibility = 'public' where id = :W;
reset role;

-- --------------------------------------------------------------- anon
select set_config('request.jwt.claim.sub', '', false);
set role anon;
select t.ok((select count(*) from public.worlds where id = :W) = 1, 'public world readable anonymously');
select t.ok((select count(*) from public.world_members) = 0, 'anon sees no membership');
select t.ok((select count(*) from public.proposals) = 0, 'anon sees no proposals');
select t.ok(t.fails($$insert into public.worlds(owner_id, name) values ('a0000000-0000-4000-8000-000000000001','x')$$), 'anon cannot create');
reset role;
\echo ALL RLS TESTS PASSED
