-- Episodes at days 30, 60 and 90.
--
-- `episode_stats` mirrors `episodeStats` in packages/domain and the database
-- tests assert they agree on one fixture. Members and their squadmates may
-- read stats; only the title-episode function, running as the service role,
-- writes an episode row, so titles come from one place.

create or replace function public.episode_stats(p_profile uuid, p_number int)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_from int := (p_number - 1) * 30 + 1;
  v_to int := p_number * 30;
  v_proofs int; v_gold int; v_silver int; v_bronze int; v_misses int; v_sick int; v_due int; v_days_proved int;
  v_best int := 0;
  v_run int := 0;
  r record;
begin
  if p_number not between 1 and 3 then
    raise exception 'episode number must be 1, 2 or 3';
  end if;
  if auth.uid() is not null and auth.uid() <> p_profile and not public.is_squadmate_of(p_profile) then
    raise exception 'not your squad';
  end if;

  select count(*) filter (where m.mark in ('V', 'B')),
         count(*) filter (where m.mark = 'V' and p.tier = 'GOLD'),
         count(*) filter (where m.mark = 'V' and coalesce(p.tier, 'SILVER') = 'SILVER'),
         count(*) filter (where m.mark = 'B'),
         count(*) filter (where m.mark = 'X'),
         count(*) filter (where m.mark = 'S'),
         count(*) filter (where m.mark in ('V', 'B', 'X')),
         count(distinct m.day) filter (where m.mark in ('V', 'B'))
    into v_proofs, v_gold, v_silver, v_bronze, v_misses, v_sick, v_due, v_days_proved
    from public.day_marks m
    left join public.proofs p on p.contract_line_id = m.contract_line_id and p.local_date = m.local_date
   where m.profile_id = p_profile
     and m.day between v_from and v_to;

  for r in
    select m.day, bool_and(m.mark in ('V', 'B')) as clean
      from public.day_marks m
     where m.profile_id = p_profile
       and m.day between v_from and v_to
       and m.mark not in ('R', 'S')
     group by m.day
     order by m.day
  loop
    if r.clean then
      v_run := v_run + 1;
      v_best := greatest(v_best, v_run);
    else
      v_run := 0;
    end if;
  end loop;

  return jsonb_build_object(
    'number', p_number,
    'from_day', v_from,
    'to_day', v_to,
    'proofs', v_proofs,
    'gold', v_gold,
    'silver', v_silver,
    'bronze', v_bronze,
    'misses', v_misses,
    'sick_days', v_sick,
    'due', v_due,
    'days_proved', v_days_proved,
    'hit_rate', case when v_due = 0 then 1 else round(v_proofs::numeric / v_due, 3) end,
    'best_streak', v_best
  );
end;
$$;

revoke all on function public.episode_stats(uuid, int) from public, anon;
grant execute on function public.episode_stats(uuid, int) to authenticated;
