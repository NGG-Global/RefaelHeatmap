-- NGG Platform — shared schema.
-- Not exposed through the Data API. The browser never touches these tables;
-- module functions in `public` reach them as `security definer`.

create schema if not exists platform;
revoke all on schema platform from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table platform.events (
  id          uuid primary key default gen_random_uuid(),
  module      text not null check (module ~ '^[a-z][a-z0-9_]*$'),
  name        text not null check (char_length(name) between 1 and 120),
  -- 32-symbol alphabet: A–Z without I and O, digits 2–9 (no 0/O, 1/I/l).
  short_code  text not null unique check (short_code ~ '^[A-HJ-NP-Z2-9]{5,6}$'),
  created_at  timestamptz not null default now()
);

create index events_module_created_at_idx on platform.events (module, created_at);

-- One row only (id = 1). failed_attempts / locked_until implement the PIN
-- lockout; they hold no personal data.
create table platform.host_credentials (
  id               int primary key check (id = 1),
  pin_hash         text not null,
  failed_attempts  int not null default 0,
  locked_until     timestamptz
);

alter table platform.events enable row level security;
alter table platform.host_credentials enable row level security;

revoke all on all tables in schema platform from public, anon, authenticated;
alter default privileges in schema platform revoke all on tables from public, anon, authenticated;
alter default privileges in schema platform revoke execute on functions from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Host PIN
-- ---------------------------------------------------------------------------

-- Lockout policy: after LOCK_AFTER consecutive wrong PINs, every host call is
-- refused for LOCK_FOR, without evaluating the PIN. No pg_sleep: a sleeping
-- call would hold an API connection and could starve participant traffic.
create or replace function platform.verify_host_pin(p_pin text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c_lock_after constant int := 5;
  c_lock_for   constant interval := interval '60 seconds';
  v_cred platform.host_credentials%rowtype;
begin
  select * into v_cred from platform.host_credentials where id = 1 for update;
  if not found then
    return 'not_configured';
  end if;

  if v_cred.locked_until is not null and v_cred.locked_until > now() then
    return 'locked';
  end if;

  if p_pin is not null
     and char_length(p_pin) between 1 and 200
     and extensions.crypt(p_pin, v_cred.pin_hash) = v_cred.pin_hash then
    if v_cred.failed_attempts <> 0 or v_cred.locked_until is not null then
      update platform.host_credentials
         set failed_attempts = 0, locked_until = null
       where id = 1;
    end if;
    return 'ok';
  end if;

  if v_cred.failed_attempts + 1 >= c_lock_after then
    update platform.host_credentials
       set failed_attempts = 0, locked_until = now() + c_lock_for
     where id = 1;
  else
    update platform.host_credentials
       set failed_attempts = v_cred.failed_attempts + 1
     where id = 1;
  end if;
  return 'unauthorized';
end;
$$;

-- Stores a bcrypt hash computed on the operator's machine
-- (scripts/set-host-pin.ts), so the plain PIN never reaches the database or
-- its logs. pgcrypto's crypt() verifies the `$2a$` variant.
create or replace function platform.set_host_pin_hash(p_hash text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_hash is null or p_hash !~ '^\$2a\$(0[4-9]|[12][0-9]|3[01])\$[./A-Za-z0-9]{53}$' then
    raise exception 'expected a bcrypt hash with the $2a$ prefix';
  end if;
  insert into platform.host_credentials (id, pin_hash)
  values (1, p_hash)
  on conflict (id) do update
    set pin_hash = excluded.pin_hash, failed_attempts = 0, locked_until = null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Short codes
-- ---------------------------------------------------------------------------

create or replace function platform.new_short_code(p_length int default 5)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  c_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- 32 symbols
  v_bytes bytea := extensions.gen_random_bytes(p_length);
  v_code  text := '';
begin
  for i in 0 .. p_length - 1 loop
    -- 256 is a multiple of 32, so the modulo keeps the distribution uniform.
    v_code := v_code || substr(c_alphabet, (get_byte(v_bytes, i) % 32) + 1, 1);
  end loop;
  return v_code;
end;
$$;

revoke all on all functions in schema platform from public, anon, authenticated;
