-- Migration: 002_login_rate_limits
-- Adds persistent login rate limiting storage for serverless deployments

create table if not exists login_rate_limits (
  key text primary key,
  attempts integer not null default 0 check (attempts >= 0),
  reset_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table login_rate_limits enable row level security;

create policy login_rate_limits_deny_all
  on login_rate_limits
  for all
  using (false)
  with check (false);

create index if not exists idx_login_rate_limits_reset_at
  on login_rate_limits (reset_at);

create or replace function increment_login_rate_limit(p_key text, p_window_ms bigint)
returns table (attempts integer, reset_at timestamptz)
language plpgsql
as $$
declare
  next_reset_at timestamptz;
  attempt_count integer := 0;
begin
  loop
    attempt_count := attempt_count + 1;

    if attempt_count > 10 then
      raise exception 'Failed to increment login rate limit due to contention.';
    end if;
    update login_rate_limits
    set attempts = attempts + 1,
        updated_at = now()
    where key = p_key
      and reset_at > now()
    returning login_rate_limits.attempts, login_rate_limits.reset_at
    into attempts, reset_at;

    if found then
      return;
    end if;

    next_reset_at := now() + (p_window_ms * interval '1 millisecond');

    update login_rate_limits
    set attempts = 1,
        reset_at = next_reset_at,
        updated_at = now()
    where key = p_key
      and reset_at <= now()
    returning login_rate_limits.attempts, login_rate_limits.reset_at
    into attempts, reset_at;

    if found then
      return;
    end if;

    insert into login_rate_limits (key, attempts, reset_at, updated_at)
    values (p_key, 1, next_reset_at, now())
    on conflict (key) do nothing
    returning login_rate_limits.attempts, login_rate_limits.reset_at
    into attempts, reset_at;

    if found then
      return;
    end if;
  end loop;
end;
$$;
