-- Push tokens and the 20:00 nudge.
--
-- Rule from the flows: at most three notifications a day, and the evening
-- nudge only when a proof is still missing. The selection is a SQL function
-- so it is testable; the send goes through pg_net to Expo's push service,
-- guarded so the migration also applies where pg_net is absent.

create table public.push_tokens (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (profile_id, token)
);

alter table public.push_tokens enable row level security;

create policy "own push tokens" on public.push_tokens
  for all to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- Members with an open mark whose local time is 20:xx: one row per member with the line names due.
create or replace function public.due_for_nudge(p_at timestamptz default now())
returns table (profile_id uuid, token text, lines text[])
language sql
stable
security definer
set search_path = public
as $$
  select m.profile_id, t.token, array_agg(distinct l.name order by l.name) as lines
    from public.day_marks m
    join public.contract_lines l on l.id = m.contract_line_id
    join public.profiles p on p.id = m.profile_id
    join public.push_tokens t on t.profile_id = m.profile_id
   where m.mark = 'P'
     and m.local_date = (p_at at time zone p.tz)::date
     and extract(hour from p_at at time zone p.tz)::int = 20
   group by m.profile_id, t.token;
$$;

-- Runs hourly at :00. Sends one nudge per token through Expo.
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
          'body', array_to_string(r.lines, ', ') || '. Your squad can see the board.',
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

revoke all on function public.due_for_nudge(timestamptz) from public, anon, authenticated;
revoke all on function public.nudge_due() from public, anon, authenticated;

do $do$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobname) from cron.job where jobname = 'winarc-nudge';
    perform cron.schedule('winarc-nudge', '0 * * * *', 'select public.nudge_due()');
  end if;
end
$do$;
