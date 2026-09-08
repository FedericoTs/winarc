-- Squad signals: the nudge learns the squad's state, the first proof of the
-- day pings the squadmates still open, and settlement reaches the phone.
--
-- The budget is the design. A member receives at most one nudge, one
-- first-proof ping and, on Sundays, one settlement per day: three, the cap
-- from the flows. Signals are rows first and pushes second, so every rule is
-- testable on plain Postgres; delivery goes through pg_net to Expo, guarded
-- like the nudge. Nothing here sends before 07:00 or after 22:59 local time.

-- ---------------------------------------------------------------------------
-- the opt-out, and the queue
-- ---------------------------------------------------------------------------
alter table public.profiles add column squad_pings boolean not null default true;

create table public.signals (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('first_proof', 'settlement')),
  squad_id uuid not null references public.squads (id) on delete cascade,
  local_date date not null,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text not null,
  route text not null default '/(tabs)/today',
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  dropped_at timestamptz,
  unique (kind, squad_id, local_date, recipient_id)
);

-- Only the definer functions below touch the queue; with no policy, members see nothing.
alter table public.signals enable row level security;
revoke all on table public.signals from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- copy, as pure functions so the tests can pin the words
-- ---------------------------------------------------------------------------
create or replace function public.money(p_cents int, p_currency text)
returns text
language sql
immutable
as $$
  select case p_currency when 'USD' then '$' else '€' end
      || case when p_cents % 100 = 0 then (p_cents / 100)::text else to_char(p_cents / 100.0, 'FM999999990.00') end;
$$;

-- The 20:00 nudge: the lines still open, then the squad's day.
create or replace function public.nudge_body(p_lines text[], p_proved int, p_due int)
returns text
language sql
immutable
as $$
  select array_to_string(p_lines, ', ') || '. ' ||
    case
      when p_due >= 2 and p_proved = p_due - 1 then p_proved || ' of ' || p_due || ' proved. You are the one missing.'
      when p_due >= 2 then p_proved || ' of ' || p_due || ' proved. The squad can see the board.'
      else 'Your squad can see the board.'
    end;
$$;

-- Sunday: the squad's week, then the member's own.
create or replace function public.settlement_body(
  p_hits int, p_misses int, p_added_cents int, p_pot_cents int, p_currency text, p_mvp text, p_my_misses int, p_stake_cents int
)
returns text
language sql
immutable
as $$
  select p_hits || ' of ' || (p_hits + p_misses) || ' proofs landed. '
      || case
           when p_misses = 0 then 'Nobody missed, the pot stays at ' || public.money(p_pot_cents, p_currency) || '.'
           else p_misses || case when p_misses = 1 then ' miss' else ' misses' end || ' fed the pot, now ' || public.money(p_pot_cents, p_currency) || '.'
         end
      || case
           when p_my_misses = 0 then ' You were clean.'
           else ' You missed ' || p_my_misses || ', ' || public.money(p_my_misses * p_stake_cents, p_currency) || '.'
         end
      || case when p_mvp is null then '' else ' ' || p_mvp || ' was MVP.' end;
$$;

-- ---------------------------------------------------------------------------
-- delivery: quiet hours, one push per token, the moment that has passed is dropped
-- ---------------------------------------------------------------------------
create or replace function public.deliver_signals(p_at timestamptz default now())
returns table (sent int, held int, dropped int)
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  t record;
  n int := 0;
  h int := 0;
  d int := 0;
  has_net boolean;
begin
  select exists (select 1 from pg_extension where extname = 'pg_net') into has_net;
  for r in
    select s.id, s.kind, s.squad_id, s.local_date, s.recipient_id, s.title, s.body, s.route, s.created_at, p.tz
      from public.signals s
      join public.profiles p on p.id = s.recipient_id
     where s.sent_at is null and s.dropped_at is null
     order by s.created_at
  loop
    -- A day-old ping is noise; a first-proof ping to someone who has since proved is wrong.
    if r.created_at < p_at - interval '24 hours'
       or (r.kind = 'first_proof' and not exists (
             select 1 from public.day_marks m
              where m.profile_id = r.recipient_id and m.local_date = r.local_date and m.mark = 'P'))
    then
      update public.signals set dropped_at = p_at where id = r.id;
      d := d + 1;
      continue;
    end if;
    if extract(hour from p_at at time zone r.tz)::int not between 7 and 22 then
      h := h + 1;
      continue;
    end if;
    if has_net then
      for t in select token from public.push_tokens where profile_id = r.recipient_id loop
        perform net.http_post(
          url := 'https://exp.host/--/api/v2/push/send',
          headers := jsonb_build_object('Content-Type', 'application/json'),
          body := jsonb_build_object(
            'to', t.token,
            'title', r.title,
            'body', r.body,
            'sound', 'default',
            'data', jsonb_build_object('route', r.route)
          )
        );
      end loop;
    end if;
    update public.signals set sent_at = p_at where id = r.id;
    n := n + 1;
  end loop;
  return query select n, h, d;
end;
$$;

-- ---------------------------------------------------------------------------
-- signal 1: the nudge carries the squad's day
-- ---------------------------------------------------------------------------
drop function public.due_for_nudge(timestamptz);
create or replace function public.due_for_nudge(p_at timestamptz default now())
returns table (profile_id uuid, token text, lines text[], proved int, due int)
language sql
stable
security definer
set search_path = public
as $$
  with open as (
    select m.profile_id, m.squad_id, m.local_date, array_agg(distinct l.name order by l.name) as lines
      from public.day_marks m
      join public.contract_lines l on l.id = m.contract_line_id
      join public.profiles p on p.id = m.profile_id
     where m.mark = 'P'
       and m.local_date = (p_at at time zone p.tz)::date
       and extract(hour from p_at at time zone p.tz)::int = 20
     group by m.profile_id, m.squad_id, m.local_date
  ),
  -- one row per squadmate with something due that day: proved when every mark is stamped or covered
  members as (
    select o.profile_id as for_profile, x.profile_id,
           bool_and(x.mark in ('V', 'B', 'S')) and bool_or(x.mark in ('V', 'B')) as proved
      from open o
      join public.day_marks x on x.squad_id = o.squad_id and x.local_date = o.local_date
      join public.squad_members sm on sm.squad_id = x.squad_id and sm.profile_id = x.profile_id and sm.left_at is null
     group by o.profile_id, x.profile_id
  )
  select o.profile_id, t.token, o.lines,
         (select count(*) filter (where m.proved) from members m where m.for_profile = o.profile_id)::int as proved,
         (select count(*) from members m where m.for_profile = o.profile_id)::int as due
    from open o
    join public.push_tokens t on t.profile_id = o.profile_id;
$$;

create or replace function public.nudge_due()
returns table (sent int)
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  n int := 0;
  has_net boolean;
begin
  select exists (select 1 from pg_extension where extname = 'pg_net') into has_net;
  for r in select * from public.due_for_nudge() loop
    if has_net then
      perform net.http_post(
        url := 'https://exp.host/--/api/v2/push/send',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := jsonb_build_object(
          'to', r.token,
          'title', 'Proof due by 23:59',
          'body', public.nudge_body(r.lines, r.proved, r.due),
          'sound', 'default',
          'data', jsonb_build_object('route', '/(tabs)/today')
        )
      );
    end if;
    n := n + 1;
  end loop;
  return query select n;
end;
$$;

-- ---------------------------------------------------------------------------
-- signal 2: the first stamped mark of the day pings the squadmates still open
-- ---------------------------------------------------------------------------
create or replace function public.on_mark_stamped()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_when text;
  v_line text;
  v_today date;
begin
  if new.mark not in ('V', 'B') or old.mark in ('V', 'B') then return new; end if;

  -- Only today counts: a late vouch on a closed day is a ledger matter, not a ping.
  select coalesce(nullif(p.display_name, ''), 'A squadmate'),
         to_char(now() at time zone p.tz, 'HH24:MI'),
         (now() at time zone p.tz)::date
    into v_name, v_when, v_today
    from public.profiles p where p.id = new.profile_id;
  if new.local_date <> v_today then return new; end if;

  if exists (
    select 1 from public.day_marks m
     where m.squad_id = new.squad_id and m.local_date = new.local_date and m.mark in ('V', 'B') and m.id <> new.id
  ) then
    return new;
  end if;

  select l.name into v_line from public.contract_lines l where l.id = new.contract_line_id;

  insert into public.signals (kind, squad_id, local_date, recipient_id, title, body, route)
  select 'first_proof', new.squad_id, new.local_date, m.profile_id,
         v_name || ' went first',
         v_line || ' at ' || v_when || '. Yours is still open.',
         '/(tabs)/today'
    from public.day_marks m
    join public.profiles p on p.id = m.profile_id
    join public.squad_members sm on sm.squad_id = m.squad_id and sm.profile_id = m.profile_id and sm.left_at is null
   where m.squad_id = new.squad_id
     and m.local_date = new.local_date
     and m.mark = 'P'
     and m.profile_id <> new.profile_id
     and p.squad_pings
   group by m.profile_id
  on conflict do nothing;

  perform public.deliver_signals();
  return new;
end;
$$;

drop trigger if exists day_marks_after_stamp on public.day_marks;
create trigger day_marks_after_stamp
after update of mark on public.day_marks
for each row execute function public.on_mark_stamped();

-- ---------------------------------------------------------------------------
-- signal 3: settlement reaches every member
-- ---------------------------------------------------------------------------
create or replace function public.settle_squad_week(p_squad uuid, p_week int, p_today date)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stake int;
  v_currency text;
  v_round uuid;
  v_hits int;
  v_misses int;
  v_mvp uuid;
  v_mvp_name text;
  v_pot int;
begin
  if exists (select 1 from public.rounds where squad_id = p_squad and week = p_week) then
    return null;
  end if;
  select stake_cents, currency into v_stake, v_currency from public.squads where id = p_squad;

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

  -- The push: the squad's week, then each member's own line of it.
  select coalesce(sum(pot_added_cents), 0) into v_pot from public.rounds where squad_id = p_squad;
  select nullif(display_name, '') into v_mvp_name from public.profiles where id = v_mvp;
  insert into public.signals (kind, squad_id, local_date, recipient_id, title, body, route)
  select 'settlement', p_squad, p_today, sm.profile_id,
         'Week ' || p_week || ' settled',
         public.settlement_body(
           v_hits, v_misses, v_misses * v_stake, v_pot, v_currency, v_mvp_name,
           (select count(*)::int from public.day_marks d where d.squad_id = p_squad and d.week = p_week and d.profile_id = sm.profile_id and d.mark = 'X'),
           v_stake
         ),
         '/(tabs)/ledger'
    from public.squad_members sm
   where sm.squad_id = p_squad and sm.left_at is null
  on conflict do nothing;
  perform public.deliver_signals();

  return v_round;
end;
$$;

-- ---------------------------------------------------------------------------
-- cron and grants
-- ---------------------------------------------------------------------------
do $do$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobname) from cron.job where jobname = 'winarc-signals';
    perform cron.schedule('winarc-signals', '*/10 * * * *', 'select public.deliver_signals()');
  end if;
end
$do$;

revoke all on function public.money(int, text) from public, anon, authenticated;
revoke all on function public.nudge_body(text[], int, int) from public, anon, authenticated;
revoke all on function public.settlement_body(int, int, int, int, text, text, int, int) from public, anon, authenticated;
revoke all on function public.deliver_signals(timestamptz) from public, anon, authenticated;
revoke all on function public.due_for_nudge(timestamptz) from public, anon, authenticated;
revoke all on function public.nudge_due() from public, anon, authenticated;
revoke all on function public.on_mark_stamped() from public, anon, authenticated;
revoke all on function public.settle_squad_week(uuid, int, date) from public, anon, authenticated;
