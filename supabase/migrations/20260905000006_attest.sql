-- Squad-witnessed lines.
--
-- Mind and money lines verify by attestation, a photo or an artifact. They
-- never go through the model: the member's word or one photo goes on the
-- board where the squad can see it, and the day stamps Bronze. The
-- dual-cam ritual and the verifier stay for sport lines, where the money is.

alter table public.proofs drop constraint proofs_status_check;
alter table public.proofs add constraint proofs_status_check
  check (status in ('pending', 'verified', 'ask', 'vouched', 'appealed', 'attested'));

create or replace function public.attest_today(p_line uuid, p_photo_path text default null)
returns table (attested_proof uuid, day_mark text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date;
  v_season public.seasons;
  v_line record;
  v_mark text;
  v_proof uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  v_today := public.local_date_for(auth.uid());
  v_season := public.season_on(v_today);
  if v_season.id is null then raise exception 'no season today'; end if;

  select l.id, l.verification, c.profile_id, c.squad_id into v_line
    from public.contract_lines l
    join public.contracts c on c.id = l.contract_id
   where l.id = p_line;
  if v_line.id is null or v_line.profile_id <> auth.uid() then raise exception 'not your line'; end if;
  if v_line.verification not in ('attest', 'photo', 'artifact') then
    raise exception 'this line needs a dual-cam proof';
  end if;
  if v_line.verification <> 'attest' and p_photo_path is null then raise exception 'this line needs a photo'; end if;
  if p_photo_path is not null and split_part(p_photo_path, '/', 1) <> auth.uid()::text then
    raise exception 'the photo must be in your own folder';
  end if;

  select m.mark into v_mark from public.day_marks m where m.contract_line_id = p_line and m.local_date = v_today;
  if v_mark is null or v_mark <> 'P' then raise exception 'nothing due today on this line'; end if;

  insert into public.proofs (contract_line_id, profile_id, squad_id, local_date, day, rear_path, status, tier)
  values (p_line, auth.uid(), v_line.squad_id, v_today, public.day_of_season(v_today, v_season), p_photo_path, 'attested', 'BRONZE')
  on conflict (contract_line_id, local_date) do update
    set rear_path = coalesce(excluded.rear_path, public.proofs.rear_path), status = 'attested', tier = 'BRONZE', ask_reason = null
  returning id into v_proof;

  update public.day_marks set mark = 'B', proof_id = v_proof
   where contract_line_id = p_line and local_date = v_today;

  return query select v_proof, 'B'::text;
end;
$$;

grant execute on function public.attest_today(uuid, text) to authenticated;
