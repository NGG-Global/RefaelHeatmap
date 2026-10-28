-- SQL-level tests for the Live Heatmap rules (acceptance 3–6) plus the
-- supporting guarantees: access control, upsert, input checks, broadcast
-- payload, export columns, retention.
--
-- Runs inside one transaction and rolls back: safe against any database.
-- Run: npm run db:test  (or: npx supabase test db)

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(66);

-- Test PIN (rolled back at the end, the real PIN is untouched).
do $$ begin
  perform platform.set_host_pin_hash(extensions.crypt('test-pin-123', extensions.gen_salt('bf', 4)));
end $$;

-- ===========================================================================
-- Setup as the browser role
-- ===========================================================================
set local role anon;

do $$ begin
  perform set_config('t.a', public.heatmap_host_create_event('test-pin-123', 'Test A')::text, true);
  perform set_config('t.b', public.heatmap_host_create_event('test-pin-123', 'Test B')::text, true);
end $$;

select is(current_setting('t.a')::jsonb ->> 'status', 'ok', 'host can create an event with the PIN');
select matches(current_setting('t.a')::jsonb ->> 'short_code', '^[A-HJ-NP-Z2-9]{5,6}$',
  'short code uses the unambiguous alphabet');

select is(
  public.heatmap_event_public(lower(current_setting('t.a')::jsonb ->> 'short_code')) ->> 'event_id',
  current_setting('t.a')::jsonb ->> 'id',
  'event lookup by short code is case-insensitive');
select is(public.heatmap_event_public('ZZZZZ') ->> 'status', 'not_found', 'unknown short code is not found');
select ok(not (public.heatmap_event_public(current_setting('t.a')::jsonb ->> 'short_code') ? 'cells'),
  'event_public carries no vote data');

-- Three devices vote on A; device 1 changes its vote.
select is(public.heatmap_cast_vote(current_setting('t.a')::jsonb ->> 'short_code',
  '00000000-0000-4000-8000-000000000001', 3, 7) ->> 'status', 'ok', 'vote accepted');
select is(public.heatmap_cast_vote(current_setting('t.a')::jsonb ->> 'short_code',
  '00000000-0000-4000-8000-000000000001', 4, 8) ->> 'status', 'ok', 'changed vote accepted');
select is(public.heatmap_cast_vote(current_setting('t.a')::jsonb ->> 'short_code',
  '00000000-0000-4000-8000-000000000002', 4, 8) ->> 'status', 'ok', 'second device vote accepted');
select is(public.heatmap_cast_vote(current_setting('t.a')::jsonb ->> 'short_code',
  '00000000-0000-4000-8000-000000000003', 9, 2) ->> 'status', 'ok', 'third device vote accepted');

-- Input checks.
select is(public.heatmap_cast_vote(current_setting('t.a')::jsonb ->> 'short_code',
  '00000000-0000-4000-8000-000000000004', 0, 5) ->> 'status', 'invalid', 'x = 0 rejected');
select is(public.heatmap_cast_vote(current_setting('t.a')::jsonb ->> 'short_code',
  '00000000-0000-4000-8000-000000000004', 5, 11) ->> 'status', 'invalid', 'y = 11 rejected');
select is(public.heatmap_cast_vote(current_setting('t.a')::jsonb ->> 'short_code',
  null, 5, 5) ->> 'status', 'invalid', 'missing device id rejected');
select is(public.heatmap_cast_vote('ZZZZZ',
  '00000000-0000-4000-8000-000000000004', 5, 5) ->> 'status', 'not_found', 'vote on unknown code is not found');

reset role;

select is((select count(*)::int from heatmap.votes where event_id = (current_setting('t.a')::jsonb ->> 'id')::uuid),
  3, 'a changed vote replaces the old one (one row per device)');
select is((select x::int * 100 + y from heatmap.votes
            where event_id = (current_setting('t.a')::jsonb ->> 'id')::uuid
              and device_id = '00000000-0000-4000-8000-000000000001'),
  408, 'the stored vote is the latest one');

-- Broadcast: a public "changed" signal on heatmap:<event_id>, without vote data.
select ok(exists (
  select 1 from realtime.messages
   where topic = 'heatmap:' || (current_setting('t.a')::jsonb ->> 'id')
     and event = 'changed'
     and private = false),
  'vote triggers a public broadcast on heatmap:<event_id>');
select ok(not exists (
  select 1 from realtime.messages
   where topic = 'heatmap:' || (current_setting('t.a')::jsonb ->> 'id')
     and (payload ? 'x' or payload ? 'y' or payload ? 'device_id' or payload ? 'cells')),
  'broadcast payload carries no vote data');

-- ===========================================================================
-- Rule 3: results are not visible before reveal, also by direct RPC call
-- ===========================================================================
set local role anon;

select is(public.heatmap_display((current_setting('t.a')::jsonb ->> 'id')::uuid) ->> 'voters', '3',
  'display always returns the voter count');
select is(public.heatmap_display((current_setting('t.a')::jsonb ->> 'id')::uuid) -> 'cells', 'null'::jsonb,
  'rule 3: no cell counts before reveal');
select is(public.heatmap_display((current_setting('t.a')::jsonb ->> 'id')::uuid) -> 'mean', 'null'::jsonb,
  'rule 3: no mean before reveal');

select is(public.heatmap_host_set_state('test-pin-123', (current_setting('t.a')::jsonb ->> 'id')::uuid,
  p_revealed => true) ->> 'revealed', 'true', 'host reveals');
select is(public.heatmap_display((current_setting('t.a')::jsonb ->> 'id')::uuid) -> 'cells',
  '[[4, 8, 2], [9, 2, 1]]'::jsonb, 'after reveal: exact cell counts');
select is(public.heatmap_display((current_setting('t.a')::jsonb ->> 'id')::uuid) -> 'mean',
  '{"x": 5.67, "y": 6.00}'::jsonb, 'after reveal: mean (continuous, two decimals)');

select is(public.heatmap_host_set_state('test-pin-123', (current_setting('t.a')::jsonb ->> 'id')::uuid,
  p_revealed => false) ->> 'revealed', 'false', 'host hides again');
select is(public.heatmap_display((current_setting('t.a')::jsonb ->> 'id')::uuid) -> 'cells', 'null'::jsonb,
  'rule 3: hidden again after hide');

-- ===========================================================================
-- Rule 4: after close, voting is impossible (also by direct RPC call)
-- ===========================================================================
select is(public.heatmap_host_set_state('test-pin-123', (current_setting('t.a')::jsonb ->> 'id')::uuid,
  p_voting_open => false) ->> 'voting_open', 'false', 'host closes voting');
select is(public.heatmap_event_public(current_setting('t.a')::jsonb ->> 'short_code') ->> 'voting_open', 'false',
  'participants see voting closed');
select is(public.heatmap_cast_vote(current_setting('t.a')::jsonb ->> 'short_code',
  '00000000-0000-4000-8000-000000000005', 5, 5) ->> 'status', 'closed', 'rule 4: new vote refused after close');
select is(public.heatmap_cast_vote(current_setting('t.a')::jsonb ->> 'short_code',
  '00000000-0000-4000-8000-000000000001', 1, 1) ->> 'status', 'closed', 'rule 4: vote change refused after close');

reset role;
select is((select count(*)::int from heatmap.votes where event_id = (current_setting('t.a')::jsonb ->> 'id')::uuid),
  3, 'rule 4: no row added after close');
select is((select x::int * 100 + y from heatmap.votes
            where event_id = (current_setting('t.a')::jsonb ->> 'id')::uuid
              and device_id = '00000000-0000-4000-8000-000000000001'),
  408, 'rule 4: no row changed after close');

-- ===========================================================================
-- Rule 6: without the PIN, every host function fails (and changes nothing)
-- ===========================================================================
set local role anon;

select is(public.heatmap_host_create_event('wrong-pin', 'X') ->> 'status', 'unauthorized', 'rule 6: create_event');
select is(public.heatmap_host_list_events('wrong-pin') ->> 'status', 'unauthorized', 'rule 6: list_events');
select is(public.heatmap_host_set_state('wrong-pin', (current_setting('t.a')::jsonb ->> 'id')::uuid,
  p_voting_open => true) ->> 'status', 'unauthorized', 'rule 6: set_state');
select is(public.heatmap_host_reset_event(null, (current_setting('t.a')::jsonb ->> 'id')::uuid) ->> 'status',
  'unauthorized', 'rule 6: reset_event (null PIN)');

reset role;
update platform.host_credentials set failed_attempts = 0, locked_until = null;  -- stay under the lockout
set local role anon;

select is(public.heatmap_host_export('', (current_setting('t.a')::jsonb ->> 'id')::uuid) ->> 'status',
  'unauthorized', 'rule 6: export (empty PIN)');
select is(public.heatmap_host_delete_event('wrong-pin', (current_setting('t.a')::jsonb ->> 'id')::uuid) ->> 'status',
  'unauthorized', 'rule 6: delete_event');
select ok(not (public.heatmap_host_export('wrong-pin', (current_setting('t.a')::jsonb ->> 'id')::uuid) ? 'rows'),
  'rule 6: a failed export returns no rows');

reset role;
select is((select count(*)::int from platform.events where module = 'heatmap' and name in ('Test A', 'Test B', 'X')),
  2, 'rule 6: failed create/delete changed no events');
select is((select voting_open from heatmap.event_state where event_id = (current_setting('t.a')::jsonb ->> 'id')::uuid),
  false, 'rule 6: failed set_state changed nothing');
select is((select count(*)::int from heatmap.votes where event_id = (current_setting('t.a')::jsonb ->> 'id')::uuid),
  3, 'rule 6: failed reset deleted nothing');

-- Lockout after five consecutive failures, even for the right PIN.
update platform.host_credentials set failed_attempts = 0, locked_until = null;
set local role anon;
select is((select count(*)::int
             from (select public.heatmap_host_list_events('wrong-pin') as r from generate_series(1, 5)) s
            where r ->> 'status' = 'unauthorized'), 5, 'wrong PINs are refused');
select is(public.heatmap_host_list_events('test-pin-123') ->> 'status', 'locked',
  'five wrong PINs lock the host functions, even for the right PIN');
reset role;
update platform.host_credentials set locked_until = now() - interval '1 second';
set local role anon;
select is(public.heatmap_host_list_events('test-pin-123') ->> 'status', 'ok', 'the lock expires');
reset role;
select is((select failed_attempts from platform.host_credentials), 0, 'a correct PIN resets the counter');

-- The browser roles reach nothing but the public functions.
set local role anon;
select throws_ok('select count(*) from heatmap.votes', '42501', null, 'anon cannot read heatmap.votes');
select throws_ok('select count(*) from heatmap.event_state', '42501', null, 'anon cannot read heatmap.event_state');
select throws_ok('select count(*) from platform.events', '42501', null, 'anon cannot read platform.events');
select throws_ok('select count(*) from platform.host_credentials', '42501', null, 'anon cannot read host credentials');
select throws_ok($$select platform.set_host_pin_hash('x')$$, '42501', null, 'anon cannot set the PIN');
select throws_ok($$select platform.verify_host_pin('x')$$, '42501', null, 'anon cannot call internal helpers');
reset role;
set local role authenticated;
select throws_ok($$select public.heatmap_host_list_events('test-pin-123')$$, '42501', null,
  'execute is granted to anon only');
reset role;

-- ===========================================================================
-- Rule 5: a new event and a reset leave no data from the previous event
-- ===========================================================================
set local role anon;

select is(public.heatmap_host_set_state('test-pin-123', (current_setting('t.b')::jsonb ->> 'id')::uuid,
  p_revealed => true) ->> 'status', 'ok', 'reveal event B');
select is(public.heatmap_display((current_setting('t.b')::jsonb ->> 'id')::uuid) -> 'cells', '[]'::jsonb,
  'rule 5: a new event starts empty');
select is(public.heatmap_display((current_setting('t.b')::jsonb ->> 'id')::uuid) ->> 'voters', '0',
  'rule 5: a new event has no voters');

select is(public.heatmap_host_export('test-pin-123', (current_setting('t.a')::jsonb ->> 'id')::uuid)
  -> 'rows' -> 0 ?& array['event_id', 'x', 'y', 'updated_at'], true, 'export rows carry event_id, x, y, updated_at');
select ok(not (public.heatmap_host_export('test-pin-123', (current_setting('t.a')::jsonb ->> 'id')::uuid)
  -> 'rows' -> 0 ? 'device_id'), 'export never carries device_id');

select is(public.heatmap_host_reset_event('test-pin-123', (current_setting('t.a')::jsonb ->> 'id')::uuid) ->> 'status',
  'ok', 'host resets event A');
select is(public.heatmap_display((current_setting('t.a')::jsonb ->> 'id')::uuid) ->> 'voters', '0',
  'rule 5: reset removes every vote');
select is(public.heatmap_display((current_setting('t.a')::jsonb ->> 'id')::uuid) ->> 'revealed', 'false',
  'rule 5: reset hides results');
select is(public.heatmap_display((current_setting('t.a')::jsonb ->> 'id')::uuid) ->> 'voting_open', 'true',
  'rule 5: reset reopens voting');

select is(public.heatmap_host_delete_event('test-pin-123', (current_setting('t.a')::jsonb ->> 'id')::uuid) ->> 'status',
  'ok', 'host deletes event A');
select is(public.heatmap_display((current_setting('t.a')::jsonb ->> 'id')::uuid) ->> 'status', 'not_found',
  'a deleted event is gone');

reset role;

-- ===========================================================================
-- Retention
-- ===========================================================================
insert into platform.events (module, name, short_code, created_at)
values ('heatmap', 'Old', 'ZYXWV', now() - interval '31 days');
insert into heatmap.event_state (event_id)
select id from platform.events where short_code = 'ZYXWV';
select ok(heatmap.purge_expired_events() >= 1, 'retention deletes events older than 30 days');
select is((select count(*)::int from platform.events where name = 'Test B'), 1, 'retention keeps recent events');
select is((select count(*)::int from cron.job where jobname = 'heatmap-retention' and schedule = '17 3 * * *'), 1,
  'daily retention job is scheduled');

select * from finish();
rollback;
