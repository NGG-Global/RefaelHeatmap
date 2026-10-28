-- Live Heatmap module.
-- Tables live in schema `heatmap` (not exposed). The browser reaches them only
-- through the `public.heatmap_*` functions at the end of this file.

create schema if not exists heatmap;
revoke all on schema heatmap from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table heatmap.event_state (
  event_id     uuid primary key references platform.events (id) on delete cascade,
  voting_open  boolean not null default true,
  revealed     boolean not null default false,
  show_mean    boolean not null default false
);

create table heatmap.votes (
  event_id    uuid not null references platform.events (id) on delete cascade,
  device_id   uuid not null,
  x           smallint not null check (x between 1 and 10),
  y           smallint not null check (y between 1 and 10),
  updated_at  timestamptz not null default now(),
  primary key (event_id, device_id)
);

alter table heatmap.event_state enable row level security;
alter table heatmap.votes enable row level security;

revoke all on all tables in schema heatmap from public, anon, authenticated;
alter default privileges in schema heatmap revoke all on tables from public, anon, authenticated;
alter default privileges in schema heatmap revoke execute on functions from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: payload-free "changed" signal on the public channel
-- heatmap:<event_id>. Clients refetch through heatmap_display(), which decides
-- what is visible, so the public channel never carries vote data.
-- ---------------------------------------------------------------------------

create or replace function heatmap.broadcast_changed(p_event_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  -- realtime.send() traps its own errors and raises a warning, so a Realtime
  -- problem never blocks a vote.
  perform realtime.send('{}'::jsonb, 'changed', 'heatmap:' || p_event_id::text, false);
end;
$$;

-- Statement-level on votes: one signal per statement per event (a reset that
-- deletes sixty rows sends one signal, not sixty).
create or replace function heatmap.tg_votes_new_rows()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in select distinct event_id from new_rows loop
    perform heatmap.broadcast_changed(r.event_id);
  end loop;
  return null;
end;
$$;

create or replace function heatmap.tg_votes_old_rows()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in select distinct event_id from old_rows loop
    perform heatmap.broadcast_changed(r.event_id);
  end loop;
  return null;
end;
$$;

create trigger votes_after_insert
  after insert on heatmap.votes
  referencing new table as new_rows
  for each statement execute function heatmap.tg_votes_new_rows();

create trigger votes_after_update
  after update on heatmap.votes
  referencing new table as new_rows
  for each statement execute function heatmap.tg_votes_new_rows();

create trigger votes_after_delete
  after delete on heatmap.votes
  referencing old table as old_rows
  for each statement execute function heatmap.tg_votes_old_rows();

create or replace function heatmap.tg_event_state_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform heatmap.broadcast_changed(old.event_id);
  else
    perform heatmap.broadcast_changed(new.event_id);
  end if;
  return null;
end;
$$;

create trigger event_state_after_change
  after insert or update or delete on heatmap.event_state
  for each row execute function heatmap.tg_event_state_changed();

-- ---------------------------------------------------------------------------
-- Participant functions (anon)
-- ---------------------------------------------------------------------------

-- Event id, name and voting state for a short code. No vote data.
create or replace function public.heatmap_event_public(p_short_code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select jsonb_build_object(
              'status', 'ok',
              'event_id', e.id,
              'name', e.name,
              'voting_open', s.voting_open)
       from platform.events e
       join heatmap.event_state s on s.event_id = e.id
      where e.module = 'heatmap'
        and e.short_code = upper(btrim(p_short_code))),
    jsonb_build_object('status', 'not_found'));
$$;

-- Upserts the device's vote. Returns status ok | closed | not_found | invalid.
-- `for share` on the state row serialises against a concurrent "close voting",
-- so no vote can land after the close commits.
create or replace function public.heatmap_cast_vote(
  p_short_code text,
  p_device_id uuid,
  p_x int,
  p_y int)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_open boolean;
begin
  if p_device_id is null
     or p_x is null or p_y is null
     or p_x not between 1 and 10
     or p_y not between 1 and 10 then
    return jsonb_build_object('status', 'invalid');
  end if;

  select e.id, s.voting_open
    into v_event_id, v_open
    from platform.events e
    join heatmap.event_state s on s.event_id = e.id
   where e.module = 'heatmap'
     and e.short_code = upper(btrim(p_short_code))
     for share of s;

  if v_event_id is null then
    return jsonb_build_object('status', 'not_found');
  end if;
  if not v_open then
    return jsonb_build_object('status', 'closed');
  end if;

  insert into heatmap.votes (event_id, device_id, x, y)
  values (v_event_id, p_device_id, p_x, p_y)
  on conflict (event_id, device_id) do update
    set x = excluded.x, y = excluded.y, updated_at = now();

  return jsonb_build_object('status', 'ok');
end;
$$;

-- ---------------------------------------------------------------------------
-- Display function (anon)
-- ---------------------------------------------------------------------------

-- Always the voter count. Cell counts and the mean only when revealed = true;
-- the reveal is decided here, never in the browser.
create or replace function public.heatmap_display(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_event platform.events%rowtype;
  v_state heatmap.event_state%rowtype;
  v_voters int;
  v_cells jsonb;
  v_mean jsonb;
begin
  select * into v_event
    from platform.events
   where id = p_event_id and module = 'heatmap';
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  select * into v_state from heatmap.event_state where event_id = p_event_id;
  select count(*)::int into v_voters from heatmap.votes where event_id = p_event_id;

  if v_state.revealed then
    select coalesce(jsonb_agg(jsonb_build_array(c.x, c.y, c.n) order by c.x, c.y), '[]'::jsonb)
      into v_cells
      from (select x, y, count(*)::int as n
              from heatmap.votes
             where event_id = p_event_id
             group by x, y) c;

    if v_voters > 0 then
      select jsonb_build_object('x', round(avg(x), 2), 'y', round(avg(y), 2))
        into v_mean
        from heatmap.votes
       where event_id = p_event_id;
    end if;
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'event_id', v_event.id,
    'name', v_event.name,
    'short_code', v_event.short_code,
    'voting_open', v_state.voting_open,
    'revealed', v_state.revealed,
    'show_mean', v_state.show_mean,
    'voters', v_voters,
    'cells', v_cells,
    'mean', v_mean);
end;
$$;

-- ---------------------------------------------------------------------------
-- Host functions (anon, PIN checked on every call)
-- A bad PIN returns {"status": "unauthorized" | "locked" | "not_configured"}
-- instead of raising, so the failed-attempt counter is committed.
-- ---------------------------------------------------------------------------

create or replace function public.heatmap_host_create_event(p_pin text, p_name text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_auth text;
  v_name text := btrim(coalesce(p_name, ''));
  v_id uuid;
  v_code text;
begin
  v_auth := platform.verify_host_pin(p_pin);
  if v_auth <> 'ok' then
    return jsonb_build_object('status', v_auth);
  end if;
  if char_length(v_name) not between 1 and 120 then
    return jsonb_build_object('status', 'invalid');
  end if;

  for attempt in 1 .. 20 loop
    v_code := platform.new_short_code(case when attempt <= 10 then 5 else 6 end);
    begin
      insert into platform.events (module, name, short_code)
      values ('heatmap', v_name, v_code)
      returning id into v_id;
      exit;
    exception when unique_violation then
      v_id := null;
    end;
  end loop;

  if v_id is null then
    return jsonb_build_object('status', 'error');
  end if;

  insert into heatmap.event_state (event_id) values (v_id);
  return jsonb_build_object('status', 'ok', 'id', v_id, 'short_code', v_code);
end;
$$;

create or replace function public.heatmap_host_list_events(p_pin text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_auth text;
  v_events jsonb;
begin
  v_auth := platform.verify_host_pin(p_pin);
  if v_auth <> 'ok' then
    return jsonb_build_object('status', v_auth);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', e.id,
           'name', e.name,
           'short_code', e.short_code,
           'created_at', e.created_at,
           'voting_open', s.voting_open,
           'revealed', s.revealed,
           'show_mean', s.show_mean,
           'voters', (select count(*)::int from heatmap.votes v where v.event_id = e.id))
           order by e.created_at desc), '[]'::jsonb)
    into v_events
    from platform.events e
    join heatmap.event_state s on s.event_id = e.id
   where e.module = 'heatmap';

  return jsonb_build_object('status', 'ok', 'events', v_events);
end;
$$;

-- Null arguments leave that flag unchanged.
create or replace function public.heatmap_host_set_state(
  p_pin text,
  p_event_id uuid,
  p_voting_open boolean default null,
  p_revealed boolean default null,
  p_show_mean boolean default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_auth text;
  v_state heatmap.event_state%rowtype;
begin
  v_auth := platform.verify_host_pin(p_pin);
  if v_auth <> 'ok' then
    return jsonb_build_object('status', v_auth);
  end if;

  update heatmap.event_state
     set voting_open = coalesce(p_voting_open, voting_open),
         revealed    = coalesce(p_revealed, revealed),
         show_mean   = coalesce(p_show_mean, show_mean)
   where event_id = p_event_id
  returning * into v_state;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'voting_open', v_state.voting_open,
    'revealed', v_state.revealed,
    'show_mean', v_state.show_mean);
end;
$$;

-- Deletes the event's votes, hides results and reopens voting.
create or replace function public.heatmap_host_reset_event(p_pin text, p_event_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_auth text;
begin
  v_auth := platform.verify_host_pin(p_pin);
  if v_auth <> 'ok' then
    return jsonb_build_object('status', v_auth);
  end if;

  -- Lock the state row first so no vote can slip in between the delete and
  -- the state change.
  perform 1 from heatmap.event_state where event_id = p_event_id for update;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  delete from heatmap.votes where event_id = p_event_id;
  update heatmap.event_state
     set revealed = false, voting_open = true
   where event_id = p_event_id;

  return jsonb_build_object('status', 'ok');
end;
$$;

-- Rows of event_id, x, y, updated_at. Never device_id.
create or replace function public.heatmap_host_export(p_pin text, p_event_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_auth text;
  v_rows jsonb;
begin
  v_auth := platform.verify_host_pin(p_pin);
  if v_auth <> 'ok' then
    return jsonb_build_object('status', v_auth);
  end if;

  if not exists (select 1 from platform.events where id = p_event_id and module = 'heatmap') then
    return jsonb_build_object('status', 'not_found');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'event_id', v.event_id,
           'x', v.x,
           'y', v.y,
           'updated_at', v.updated_at)
           order by v.updated_at, v.x, v.y), '[]'::jsonb)
    into v_rows
    from heatmap.votes v
   where v.event_id = p_event_id;

  return jsonb_build_object('status', 'ok', 'rows', v_rows);
end;
$$;

-- Deletes the event; its state and votes cascade.
create or replace function public.heatmap_host_delete_event(p_pin text, p_event_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_auth text;
begin
  v_auth := platform.verify_host_pin(p_pin);
  if v_auth <> 'ok' then
    return jsonb_build_object('status', v_auth);
  end if;

  delete from platform.events where id = p_event_id and module = 'heatmap';
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  return jsonb_build_object('status', 'ok');
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants: execute for anon on the browser-facing functions only.
-- ---------------------------------------------------------------------------

revoke all on all functions in schema heatmap from public, anon, authenticated;

revoke all on function public.heatmap_event_public(text) from public, anon, authenticated;
revoke all on function public.heatmap_cast_vote(text, uuid, int, int) from public, anon, authenticated;
revoke all on function public.heatmap_display(uuid) from public, anon, authenticated;
revoke all on function public.heatmap_host_create_event(text, text) from public, anon, authenticated;
revoke all on function public.heatmap_host_list_events(text) from public, anon, authenticated;
revoke all on function public.heatmap_host_set_state(text, uuid, boolean, boolean, boolean) from public, anon, authenticated;
revoke all on function public.heatmap_host_reset_event(text, uuid) from public, anon, authenticated;
revoke all on function public.heatmap_host_export(text, uuid) from public, anon, authenticated;
revoke all on function public.heatmap_host_delete_event(text, uuid) from public, anon, authenticated;

grant execute on function public.heatmap_event_public(text) to anon;
grant execute on function public.heatmap_cast_vote(text, uuid, int, int) to anon;
grant execute on function public.heatmap_display(uuid) to anon;
grant execute on function public.heatmap_host_create_event(text, text) to anon;
grant execute on function public.heatmap_host_list_events(text) to anon;
grant execute on function public.heatmap_host_set_state(text, uuid, boolean, boolean, boolean) to anon;
grant execute on function public.heatmap_host_reset_event(text, uuid) to anon;
grant execute on function public.heatmap_host_export(text, uuid) to anon;
grant execute on function public.heatmap_host_delete_event(text, uuid) to anon;
