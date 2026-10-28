-- Retention: heatmap events older than 30 days are deleted daily (state and
-- votes cascade).

create extension if not exists pg_cron with schema pg_catalog;

grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

create or replace function heatmap.purge_expired_events()
returns int
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_deleted int;
begin
  delete from platform.events
   where module = 'heatmap'
     and created_at < now() - interval '30 days';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function heatmap.purge_expired_events() from public, anon, authenticated;

-- 03:17 UTC daily (05:17 / 06:17 Israel time). Same name = upsert.
select cron.schedule('heatmap-retention', '17 3 * * *', 'select heatmap.purge_expired_events()');
