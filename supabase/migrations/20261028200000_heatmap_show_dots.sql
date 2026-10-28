-- Brief V5: the host can show or hide the respondent dots on the heatmap.
-- Adds event_state.show_dots (default: shown) and carries it through
-- heatmap_display, heatmap_host_list_events and heatmap_host_set_state.

alter table heatmap.event_state
  add column if not exists show_dots boolean not null default true;

-- ---------------------------------------------------------------------------
-- Display: unchanged rules (cells and mean only when revealed), plus show_dots.
-- ---------------------------------------------------------------------------

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
    'show_dots', v_state.show_dots,
    'voters', v_voters,
    'cells', v_cells,
    'mean', v_mean);
end;
$$;

-- ---------------------------------------------------------------------------
-- Host list: plus show_dots.
-- ---------------------------------------------------------------------------

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
           'show_dots', s.show_dots,
           'voters', (select count(*)::int from heatmap.votes v where v.event_id = e.id))
           order by e.created_at desc), '[]'::jsonb)
    into v_events
    from platform.events e
    join heatmap.event_state s on s.event_id = e.id
   where e.module = 'heatmap';

  return jsonb_build_object('status', 'ok', 'events', v_events);
end;
$$;

-- ---------------------------------------------------------------------------
-- Host set_state: new optional p_show_dots. The signature changes, so the old
-- function is dropped first (create or replace would add an overload).
-- Callers that omit p_show_dots behave exactly as before.
-- ---------------------------------------------------------------------------

drop function if exists public.heatmap_host_set_state(text, uuid, boolean, boolean, boolean);

create function public.heatmap_host_set_state(
  p_pin text,
  p_event_id uuid,
  p_voting_open boolean default null,
  p_revealed boolean default null,
  p_show_mean boolean default null,
  p_show_dots boolean default null)
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
         show_mean   = coalesce(p_show_mean, show_mean),
         show_dots   = coalesce(p_show_dots, show_dots)
   where event_id = p_event_id
  returning * into v_state;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'voting_open', v_state.voting_open,
    'revealed', v_state.revealed,
    'show_mean', v_state.show_mean,
    'show_dots', v_state.show_dots);
end;
$$;

revoke all on function public.heatmap_host_set_state(text, uuid, boolean, boolean, boolean, boolean) from public, anon, authenticated;
grant execute on function public.heatmap_host_set_state(text, uuid, boolean, boolean, boolean, boolean) to anon;

-- create or replace keeps existing grants on display and list_events; restate them anyway.
revoke all on function public.heatmap_display(uuid) from public, anon, authenticated;
grant execute on function public.heatmap_display(uuid) to anon;
revoke all on function public.heatmap_host_list_events(text) from public, anon, authenticated;
grant execute on function public.heatmap_host_list_events(text) to anon;
