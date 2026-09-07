-- Under-18s cannot set weight tracking (product rule 2).
--
-- The weigh-in is gated on an adult confirmation stored on the profile and
-- enforced in the database: a contract cannot carry weigh_in without it and a
-- reading cannot be logged without it, so no client path can skip the gate.
-- It is a self-attestation; the product has no way to verify age and does
-- not pretend to. The member sets it once from the app.

alter table public.profiles add column adult_confirmed_at timestamptz;

create or replace function public.require_adult_for_weigh_in()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.weigh_in and not exists (
    select 1 from public.profiles p where p.id = new.profile_id and p.adult_confirmed_at is not null
  ) then
    raise exception 'the weigh-in needs an adult confirmation';
  end if;
  return new;
end;
$$;

drop trigger if exists contracts_adult_weigh_in on public.contracts;
create trigger contracts_adult_weigh_in
before insert or update of weigh_in on public.contracts
for each row execute function public.require_adult_for_weigh_in();

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
  if not exists (select 1 from public.profiles p where p.id = v_me and p.adult_confirmed_at is not null) then
    raise exception 'the weigh-in needs an adult confirmation';
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
