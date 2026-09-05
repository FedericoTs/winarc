-- Daily ticks and the Sunday ledger, in the database.
--
-- Money and the board depend on these, so they live next to the data and run
-- from pg_cron with no HTTP hop, no shared secret and no cold start. The
-- TypeScript domain package mirrors the same rules for the app's previews,
-- and the database tests assert the two agree on the same fixtures.

-- ---------------------------------------------------------------------------
-- calendar helpers, mirroring packages/domain/src/season.ts
-- ---------------------------------------------------------------------------
create or replace function public.day_of_season(p_date date, p_season public.seasons)
returns int
language sql
immutable
as $$
  select (p_date - p_season.starts_on) + 1;
$$;

-- Weeks end on Sundays. Week 1 runs from the start to the first Sunday inclusive.
create or replace function public.week_of_season(p_date date, p_season public.seasons)
returns int
language sql
immutable
as $$
  select case
    when p_date < p_season.starts_on then 0
    when (p_date - p_season.starts_on) <= ((7 - extract(dow from p_season.starts_on)::int) % 7) then 1
    else 2 + ((p_date - p_season.starts_on) - 1 - ((7 - extract(dow from p_season.starts_on)::int) % 7)) / 7
  end;
$$;

create or replace function public.season_on(p_date date)
returns public.seasons
language sql
stable
as $$
  select s from public.seasons s
  where p_date between s.starts_on - 30 and s.finale_on
  order by s.starts_on desc
  limit 1;
$$;

create or replace function public.local_date_for(p_profile uuid)
returns date
language sql
stable
as $$
  select (now() at time zone coalesce((select tz from public.profiles where id = p_profile), 'UTC'))::date;
$$;

-- ---------------------------------------------------------------------------
-- squad RPCs: the lock date is judged on the member's local date
-- ---------------------------------------------------------------------------
create or replace function public.join_squad(p_code text)
returns public.squads
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.squads;
  members int;
  locks date;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into s from public.squads where code = upper(p_code) and dissolved_at is null;
  if s.id is null then raise exception 'no squad with that code'; end if;
  select locks_on into locks from public.seasons where id = s.season_id;
  if public.local_date_for(auth.uid()) >= locks then raise exception 'squads are locked'; end if;
  select count(*) into members from public.squad_members where squad_id = s.id and left_at is null;
  if members >= s.size then raise exception 'squad is full'; end if;
  if exists (
    select 1 from public.squad_members where profile_id = auth.uid() and season_id = s.season_id and left_at is null
  ) then
    raise exception 'already in a squad this season';
  end if;
  insert into public.squad_members (squad_id, profile_id, season_id, role)
  values (s.id, auth.uid(), s.season_id, 'member');
  return s;
end;
$$;

-- ---------------------------------------------------------------------------
-- the daily tick: close yesterday's open marks, open today's due marks
-- ---------------------------------------------------------------------------
create or replace function public.tick_member(p_profile uuid, p_today date)
returns table (opened int, closed int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_season public.seasons;
  v_opened int := 0;
  v_closed int := 0;
begin
  update public.day_marks
     set mark = 'X', closed_at = now()
   where profile_id = p_profile and local_date < p_today and mark = 'P';
  get diagnostics v_closed = row_count;

  v_season := public.season_on(p_today);
  if v_season.id is not null
     and p_today between v_season.starts_on and v_season.starts_on + v_season.arc_days - 1 then
    insert into public.day_marks (contract_line_id, profile_id, squad_id, local_date, day, week, mark)
    select l.id, c.profile_id, c.squad_id, p_today,
           public.day_of_season(p_today, v_season), public.week_of_season(p_today, v_season), 'P'
      from public.contract_lines l
      join public.contracts c on c.id = l.contract_id
      join public.squad_members m on m.squad_id = c.squad_id and m.profile_id = c.profile_id and m.left_at is null
      join public.squads s on s.id = c.squad_id and s.dissolved_at is null
     where c.profile_id = p_profile
       and c.season_id = v_season.id
       and c.signed_at is not null
       and l.staked
       and extract(dow from p_today)::int = any (l.days)
    on conflict (contract_line_id, local_date) do nothing;
    get diagnostics v_opened = row_count;
  end if;

  return query select v_opened, v_closed;
end;
$$;

-- Runs hourly. Members whose local clock just passed midnight get their tick.
create or replace function public.tick_all()
returns table (profiles int, opened int, closed int)
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  t record;
  n int := 0;
  o int := 0;
  c int := 0;
begin
  for r in select id, tz from public.profiles loop
    if extract(hour from now() at time zone r.tz)::int = 0 then
      select * into t from public.tick_member(r.id, (now() at time zone r.tz)::date);
      n := n + 1; o := o + t.opened; c := c + t.closed;
    end if;
  end loop;
  return query select n, o, c;
end;
$$;

-- Called by the app right after a contract is signed, so Today is never empty.
create or replace function public.open_today()
returns table (opened int, closed int)
language sql
security definer
set search_path = public
as $$
  select * from public.tick_member(auth.uid(), public.local_date_for(auth.uid()));
$$;

-- ---------------------------------------------------------------------------
-- the Sunday ledger: misses become pot entries, never a charge
-- ---------------------------------------------------------------------------
create or replace function public.settle_squad_week(p_squad uuid, p_week int, p_today date)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stake int;
  v_round uuid;
  v_hits int;
  v_misses int;
  v_mvp uuid;
begin
  if exists (select 1 from public.rounds where squad_id = p_squad and week = p_week) then
    return null;
  end if;
  select stake_cents into v_stake from public.squads where id = p_squad;

  -- Sundays and the finale close at settlement, when the ledger runs.
  update public.day_marks
     set mark = 'X', closed_at = now()
   where squad_id = p_squad and local_date = p_today and mark = 'P';

  select count(*) filter (where mark in ('V', 'B')), count(*) filter (where mark = 'X')
    into v_hits, v_misses
    from public.day_marks
   where squad_id = p_squad and week = p_week;

  select m.profile_id into v_mvp
    from (
      select profile_id,
             count(*) filter (where mark in ('V', 'B')) as hits,
             count(*) filter (where mark = 'X') as misses
        from public.day_marks
       where squad_id = p_squad and week = p_week
       group by profile_id
    ) m
    join public.squad_members sm on sm.squad_id = p_squad and sm.profile_id = m.profile_id
   where m.misses = 0 and m.hits > 0
   order by m.hits desc, sm.joined_at asc
   limit 1;

  insert into public.rounds (squad_id, week, pot_added_cents, hit_rate, mvp_profile_id)
  values (
    p_squad, p_week, v_misses * v_stake,
    case when v_hits + v_misses = 0 then 1 else round(v_hits::numeric / (v_hits + v_misses), 4) end,
    v_mvp
  )
  returning id into v_round;

  insert into public.ledger_entries (squad_id, round_id, profile_id, amount_cents, reason, local_date, contract_line_id)
  select squad_id, v_round, profile_id, v_stake, 'miss', local_date, contract_line_id
    from public.day_marks
   where squad_id = p_squad and week = p_week and mark = 'X';

  return v_round;
end;
$$;

-- Runs hourly. Squads whose founder's local time is Sunday 21:xx, or the finale day at 21:xx, settle.
create or replace function public.settle_due()
returns table (settled int)
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_today date;
  v_season public.seasons;
  n int := 0;
begin
  for r in
    select s.id, s.season_id, p.tz
      from public.squads s
      join public.profiles p on p.id = s.founder_id
     where s.dissolved_at is null
  loop
    if extract(hour from now() at time zone r.tz)::int <> 21 then continue; end if;
    v_today := (now() at time zone r.tz)::date;
    select * into v_season from public.seasons where id = r.season_id;
    if v_today < v_season.starts_on or v_today > v_season.finale_on then continue; end if;
    if extract(dow from v_today)::int <> 0 and v_today <> v_season.finale_on then continue; end if;
    if public.settle_squad_week(r.id, public.week_of_season(v_today, v_season), v_today) is not null then
      n := n + 1;
    end if;
  end loop;
  return query select n;
end;
$$;

-- ---------------------------------------------------------------------------
-- cron: enable pg_cron in the Supabase dashboard first. Guarded so the same
-- migration runs on plain Postgres in tests.
-- ---------------------------------------------------------------------------
do $do$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    execute 'create extension if not exists pg_cron';
    perform cron.unschedule(jobname) from cron.job where jobname in ('winarc-tick', 'winarc-settle');
    perform cron.schedule('winarc-tick', '5 * * * *', 'select public.tick_all()');
    perform cron.schedule('winarc-settle', '10 * * * *', 'select public.settle_due()');
  end if;
end
$do$;

-- Members call open_today; the ticks and settlement run only from cron.
revoke all on function public.tick_member(uuid, date) from public, anon, authenticated;
revoke all on function public.tick_all() from public, anon, authenticated;
revoke all on function public.settle_squad_week(uuid, int, date) from public, anon, authenticated;
revoke all on function public.settle_due() from public, anon, authenticated;
grant execute on function public.open_today() to authenticated;
