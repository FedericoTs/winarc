-- The weekly weigh-in. Private, optional, never staked.
--
-- Rule 2: money rides on sessions and habits, never on kilograms. Readings
-- live in their own table with an owner-only policy, so no squad read policy
-- on tables or storage can reach them. The product never derives a target
-- from them; the only number it computes is the change since the first
-- reading. The daily tick ignores the weigh line because it is unstaked, so
-- a skipped weigh-in is never a miss.

create table public.weigh_ins (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  local_date date not null,
  kg numeric(5, 2) not null check (kg between 20 and 400),
  source text not null check (source in ('healthkit', 'health_connect', 'manual')),
  created_at timestamptz not null default now(),
  unique (profile_id, local_date)
);

alter table public.weigh_ins enable row level security;

create policy "own weigh-ins" on public.weigh_ins
  for all to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- Upserts today's reading for the caller and returns the change since the first reading.
-- Runs as the caller, so row-level security applies to every read and write inside.
create or replace function public.log_weigh_in(p_kg numeric, p_source text)
returns table (on_date date, weight_kg numeric, first_kg numeric, delta_kg numeric, readings int)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_today date;
  v_kg numeric := round(p_kg, 2);
begin
  if v_me is null then
    raise exception 'not signed in';
  end if;
  v_today := public.local_date_for(v_me);

  insert into public.weigh_ins (profile_id, local_date, kg, source)
  values (v_me, v_today, v_kg, p_source)
  on conflict (profile_id, local_date) do update set kg = excluded.kg, source = excluded.source;

  return query
    select v_today,
           v_kg,
           f.kg,
           v_kg - f.kg,
           (select count(*)::int from public.weigh_ins w where w.profile_id = v_me)
      from (select w.kg from public.weigh_ins w where w.profile_id = v_me order by w.local_date asc limit 1) f;
end;
$$;

revoke all on function public.log_weigh_in(numeric, text) from public, anon;
grant execute on function public.log_weigh_in(numeric, text) to authenticated;
