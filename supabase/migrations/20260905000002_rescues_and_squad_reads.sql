-- Rescue mechanics and squad reads.
--
-- Rule 3: a miss never resets the arc. One sick day per fortnight, one vouch
-- request per week, and two squadmates stamp a Bronze. Rule 8: visibility is
-- squad-only, so squadmates can see each other's proof images.

create or replace function public.fortnight_of_season(p_date date, p_season public.seasons)
returns int
language sql
immutable
as $$
  select ceil(public.week_of_season(p_date, p_season)::numeric / 2)::int;
$$;

-- ---------------------------------------------------------------------------
-- sick day: today's open marks become S, nothing is owed, the squad is told
-- ---------------------------------------------------------------------------
create or replace function public.use_sick_day()
returns table (marks int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date;
  v_season public.seasons;
  v_squad uuid;
  v_week int;
  v_fortnight int;
  n int;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  v_today := public.local_date_for(auth.uid());
  v_season := public.season_on(v_today);
  if v_season.id is null then raise exception 'no season today'; end if;
  v_week := public.week_of_season(v_today, v_season);
  v_fortnight := public.fortnight_of_season(v_today, v_season);
  select squad_id into v_squad
    from public.squad_members
   where profile_id = auth.uid() and season_id = v_season.id and left_at is null;
  if v_squad is null then raise exception 'not in a squad'; end if;
  if exists (
    select 1 from public.rescues where profile_id = auth.uid() and kind = 'sick' and fortnight = v_fortnight
  ) then
    raise exception 'no sick days left this fortnight';
  end if;
  update public.day_marks set mark = 'S', closed_at = now()
   where profile_id = auth.uid() and local_date = v_today and mark = 'P';
  get diagnostics n = row_count;
  if n = 0 then raise exception 'nothing due today'; end if;
  insert into public.rescues (profile_id, squad_id, kind, local_date, week, fortnight)
  values (auth.uid(), v_squad, 'sick', v_today, v_week, v_fortnight);
  return query select n;
end;
$$;

grant execute on function public.use_sick_day() to authenticated;

-- ---------------------------------------------------------------------------
-- vouch request: once a week, on a proof that is not yet stamped
-- ---------------------------------------------------------------------------
create or replace function public.request_vouch(p_proof uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.proofs;
  v_season public.seasons;
  v_week int;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into p from public.proofs where id = p_proof and profile_id = auth.uid();
  if p.id is null then raise exception 'not your proof'; end if;
  if p.status in ('verified', 'vouched') then raise exception 'already stamped'; end if;
  v_season := public.season_on(p.local_date);
  v_week := public.week_of_season(p.local_date, v_season);
  if exists (
    select 1 from public.rescues where profile_id = auth.uid() and kind = 'vouch_request' and week = v_week
  ) then
    raise exception 'no vouches left this week';
  end if;
  insert into public.rescues (profile_id, squad_id, kind, local_date, week, fortnight, proof_id)
  values (auth.uid(), p.squad_id, 'vouch_request', p.local_date, v_week, public.fortnight_of_season(p.local_date, v_season), p_proof);
  update public.proofs set status = 'ask', ask_reason = coalesce(ask_reason, 'low_confidence') where id = p_proof;
end;
$$;

grant execute on function public.request_vouch(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- two vouches stamp a Bronze, flip the day mark, and reverse a settled miss
-- ---------------------------------------------------------------------------
create or replace function public.on_vouch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.proofs;
  n int;
begin
  select * into p from public.proofs where id = new.proof_id;
  select count(*) into n from public.vouches where proof_id = new.proof_id;
  if n >= 2 and p.status not in ('verified', 'vouched') then
    update public.proofs set status = 'vouched', tier = 'BRONZE', ask_reason = null where id = p.id;
    update public.day_marks set mark = 'B', proof_id = p.id
     where contract_line_id = p.contract_line_id and local_date = p.local_date and mark in ('P', 'X');
    update public.rescues set resolved_at = now()
     where proof_id = p.id and kind = 'vouch_request' and resolved_at is null;
    -- A miss that already went to the ledger comes back out as an adjustment.
    insert into public.ledger_entries (squad_id, round_id, profile_id, amount_cents, reason, local_date, contract_line_id)
    select e.squad_id, e.round_id, e.profile_id, -e.amount_cents, 'adjustment', e.local_date, e.contract_line_id
      from public.ledger_entries e
     where e.contract_line_id = p.contract_line_id and e.local_date = p.local_date and e.reason = 'miss'
       and not exists (
         select 1 from public.ledger_entries a
          where a.contract_line_id = e.contract_line_id and a.local_date = e.local_date and a.reason = 'adjustment'
       );
  end if;
  return new;
end;
$$;

drop trigger if exists vouches_after_insert on public.vouches;
create trigger vouches_after_insert
after insert on public.vouches
for each row execute function public.on_vouch();

-- Vouching is for proofs that still need it.
drop policy if exists "squadmates can vouch, never for themselves" on public.vouches;
create policy "squadmates can vouch, never for themselves" on public.vouches
  for insert to authenticated with check (
    voucher_id = auth.uid() and exists (
      select 1 from public.proofs p
      where p.id = proof_id
        and p.profile_id <> auth.uid()
        and p.status not in ('verified', 'vouched')
        and public.is_member_of(p.squad_id)
    )
  );

-- ---------------------------------------------------------------------------
-- squadmates can read each other's proof images; the board shows faces
-- ---------------------------------------------------------------------------
create or replace function public.is_squadmate_of(p_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.squad_members a
      join public.squad_members b on b.squad_id = a.squad_id
     where a.profile_id = auth.uid() and a.left_at is null
       and b.profile_id = p_owner and b.left_at is null
  );
$$;

create policy "squadmates read each other's proofs" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'proofs'
    and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    and public.is_squadmate_of(((storage.foldername(name))[1])::uuid)
  );
