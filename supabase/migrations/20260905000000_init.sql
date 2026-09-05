-- WinArc season one schema.
-- Rules encoded here mirror CLAUDE.md: squad terms live on the squad, stakes are
-- process-only, the pot is a ledger, visibility is squad-only.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text unique check (handle ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null default '',
  avatar_path text,
  tz text not null default 'UTC',
  currency text not null default 'EUR' check (currency in ('EUR', 'USD')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- seasons
-- ---------------------------------------------------------------------------
create table public.seasons (
  id text primary key,
  starts_on date not null,
  arc_days int not null check (arc_days between 1 and 366),
  locks_on date not null,
  finale_on date not null
);

insert into public.seasons (id, starts_on, arc_days, locks_on, finale_on)
values ('S01', '2026-10-01', 90, '2026-10-07', '2026-12-31');

-- ---------------------------------------------------------------------------
-- squads and members
-- ---------------------------------------------------------------------------
create table public.squads (
  id uuid primary key default gen_random_uuid(),
  season_id text not null references public.seasons (id),
  name text not null check (char_length(name) between 1 and 28),
  code text not null unique check (code ~ '^WIN-[A-HJ-NP-Z2-9]{4}$'),
  size int not null check (size between 2 and 8),
  stake_cents int not null check (stake_cents in (500, 1000, 2500)),
  pot_rule text not null default 'pot' check (pot_rule in ('pot', 'charity', 'anti_charity')),
  currency text not null default 'EUR' check (currency in ('EUR', 'USD')),
  founder_id uuid not null references public.profiles (id),
  crew_id uuid,
  dissolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.squad_members (
  squad_id uuid not null references public.squads (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  season_id text not null references public.seasons (id),
  role text not null default 'member' check (role in ('founder', 'member')),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (squad_id, profile_id)
);

-- One home squad per member per season.
create unique index squad_members_one_active_per_season
  on public.squad_members (profile_id, season_id)
  where left_at is null;

create index squad_members_squad_active on public.squad_members (squad_id) where left_at is null;

-- ---------------------------------------------------------------------------
-- contracts
-- ---------------------------------------------------------------------------
create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  squad_id uuid not null references public.squads (id) on delete cascade,
  season_id text not null references public.seasons (id),
  weigh_in boolean not null default true,
  signed_at timestamptz,
  signature_path text,
  created_at timestamptz not null default now(),
  unique (profile_id, season_id)
);

create table public.contract_lines (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts (id) on delete cascade,
  key text not null,
  kind text not null check (kind in ('sport', 'body', 'mind', 'money')),
  name text not null,
  per_week int not null check (per_week between 1 and 7),
  days int[] not null check (cardinality(days) between 1 and 7),
  verification text not null check (verification in ('health_photo', 'photo', 'health', 'attest', 'artifact')),
  staked boolean not null default true,
  position int not null default 0,
  unique (contract_id, key)
);

-- ---------------------------------------------------------------------------
-- proofs, verifications, vouches
-- ---------------------------------------------------------------------------
create table public.proofs (
  id uuid primary key default gen_random_uuid(),
  contract_line_id uuid not null references public.contract_lines (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  squad_id uuid not null references public.squads (id) on delete cascade,
  local_date date not null,
  day int not null,
  captured_at timestamptz not null default now(),
  rear_path text,
  front_path text,
  health_workout jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'verified', 'ask', 'vouched', 'appealed')),
  tier text check (tier in ('GOLD', 'SILVER', 'BRONZE')),
  ask_reason text check (ask_reason in ('unclear', 'no_person', 'recapture', 'low_confidence')),
  created_at timestamptz not null default now(),
  unique (contract_line_id, local_date)
);

create index proofs_squad_date on public.proofs (squad_id, local_date);

create table public.verifications (
  id uuid primary key default gen_random_uuid(),
  proof_id uuid not null references public.proofs (id) on delete cascade,
  model text not null,
  rubric_version text not null,
  result jsonb not null,
  decision jsonb not null,
  input_tokens int,
  output_tokens int,
  cache_read_tokens int,
  latency_ms int,
  refused boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.vouches (
  proof_id uuid not null references public.proofs (id) on delete cascade,
  voucher_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (proof_id, voucher_id)
);

-- ---------------------------------------------------------------------------
-- day marks: one row per staked line per due day. The board and the ledger read these.
-- V verified, B vouched, X missed, R rest, S sick, P pending.
-- ---------------------------------------------------------------------------
create table public.day_marks (
  id uuid primary key default gen_random_uuid(),
  contract_line_id uuid not null references public.contract_lines (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  squad_id uuid not null references public.squads (id) on delete cascade,
  local_date date not null,
  day int not null,
  week int not null,
  mark text not null default 'P' check (mark in ('V', 'B', 'X', 'R', 'S', 'P')),
  proof_id uuid references public.proofs (id),
  closed_at timestamptz,
  unique (contract_line_id, local_date)
);

create index day_marks_squad_week on public.day_marks (squad_id, week);

-- ---------------------------------------------------------------------------
-- rescues: sick days, vouch requests, appeals
-- ---------------------------------------------------------------------------
create table public.rescues (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  squad_id uuid not null references public.squads (id) on delete cascade,
  kind text not null check (kind in ('sick', 'vouch_request', 'appeal')),
  local_date date not null,
  week int not null,
  fortnight int not null,
  proof_id uuid references public.proofs (id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index rescues_profile_fortnight on public.rescues (profile_id, kind, fortnight);

-- ---------------------------------------------------------------------------
-- rounds and the ledger
-- ---------------------------------------------------------------------------
create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  squad_id uuid not null references public.squads (id) on delete cascade,
  week int not null,
  settled_at timestamptz not null default now(),
  pot_added_cents int not null default 0,
  hit_rate numeric(5, 4) not null default 1,
  mvp_profile_id uuid references public.profiles (id),
  unique (squad_id, week)
);

create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  squad_id uuid not null references public.squads (id) on delete cascade,
  round_id uuid references public.rounds (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  amount_cents int not null,
  reason text not null check (reason in ('miss', 'adjustment')),
  local_date date,
  contract_line_id uuid references public.contract_lines (id),
  created_at timestamptz not null default now()
);

create index ledger_entries_squad on public.ledger_entries (squad_id);

create table public.pot_votes (
  squad_id uuid not null references public.squads (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  option text not null check (char_length(option) between 1 and 40),
  created_at timestamptz not null default now(),
  primary key (squad_id, profile_id)
);

-- ---------------------------------------------------------------------------
-- episodes and connections
-- ---------------------------------------------------------------------------
create table public.episodes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  squad_id uuid not null references public.squads (id) on delete cascade,
  number int not null check (number between 1 and 3),
  title text not null,
  stats jsonb not null default '{}'::jsonb,
  card_path text,
  created_at timestamptz not null default now(),
  unique (profile_id, number)
);

create table public.connections (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null check (provider in ('healthkit', 'health_connect', 'strava', 'terra', 'garmin')),
  status text not null default 'connected' check (status in ('connected', 'revoked')),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (profile_id, provider)
);

-- ---------------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_member_of(target_squad uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.squad_members m
    where m.squad_id = target_squad and m.profile_id = auth.uid() and m.left_at is null
  );
$$;

create or replace function public.generate_squad_code()
returns text
language plpgsql
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  body text;
begin
  loop
    body := '';
    for i in 1..4 loop
      body := body || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.squads where code = 'WIN-' || body);
  end loop;
  return 'WIN-' || body;
end;
$$;

-- Founder creates a squad and sets the terms once.
create or replace function public.create_squad(
  p_name text,
  p_size int,
  p_stake_cents int,
  p_pot_rule text default 'pot',
  p_currency text default 'EUR',
  p_season text default 'S01'
)
returns public.squads
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.squads;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_pot_rule <> 'pot' then raise exception 'pot rule % is not live this season', p_pot_rule; end if;
  if exists (
    select 1 from public.squad_members where profile_id = auth.uid() and season_id = p_season and left_at is null
  ) then
    raise exception 'already in a squad this season';
  end if;
  insert into public.squads (season_id, name, code, size, stake_cents, pot_rule, currency, founder_id)
  values (p_season, p_name, public.generate_squad_code(), p_size, p_stake_cents, p_pot_rule, p_currency, auth.uid())
  returning * into s;
  insert into public.squad_members (squad_id, profile_id, season_id, role)
  values (s.id, auth.uid(), p_season, 'founder');
  return s;
end;
$$;

-- What the join screen shows before anyone is a member. Terms are inherited, not chosen.
create or replace function public.squad_preview(p_code text)
returns table (
  id uuid, name text, size int, stake_cents int, pot_rule text, currency text,
  member_count int, spots_left int, locks_on date, locked boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.name, s.size, s.stake_cents, s.pot_rule, s.currency,
         (select count(*)::int from public.squad_members m where m.squad_id = s.id and m.left_at is null) as member_count,
         greatest(0, s.size - (select count(*)::int from public.squad_members m where m.squad_id = s.id and m.left_at is null)) as spots_left,
         se.locks_on,
         (current_date >= se.locks_on) as locked
  from public.squads s
  join public.seasons se on se.id = s.season_id
  where s.code = upper(p_code) and s.dissolved_at is null;
$$;

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
  if current_date >= locks then raise exception 'squads are locked'; end if;
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
-- row-level security: squad-only visibility, own writes, cross-member writes via RPC or service role
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.seasons enable row level security;
alter table public.squads enable row level security;
alter table public.squad_members enable row level security;
alter table public.contracts enable row level security;
alter table public.contract_lines enable row level security;
alter table public.proofs enable row level security;
alter table public.verifications enable row level security;
alter table public.vouches enable row level security;
alter table public.day_marks enable row level security;
alter table public.rescues enable row level security;
alter table public.rounds enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.pot_votes enable row level security;
alter table public.episodes enable row level security;
alter table public.connections enable row level security;

create policy "profiles are readable by signed-in members" on public.profiles
  for select to authenticated using (true);
create policy "profiles are editable by their owner" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "seasons are public" on public.seasons for select to anon, authenticated using (true);

create policy "squads are visible to members" on public.squads
  for select to authenticated using (public.is_member_of(id));

create policy "squad members see each other" on public.squad_members
  for select to authenticated using (public.is_member_of(squad_id));
create policy "a member can leave" on public.squad_members
  for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy "contracts are visible to the squad" on public.contracts
  for select to authenticated using (public.is_member_of(squad_id));
create policy "own contract writes" on public.contracts
  for insert to authenticated with check (profile_id = auth.uid() and public.is_member_of(squad_id));
create policy "own contract updates" on public.contracts
  for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy "lines are visible to the squad" on public.contract_lines
  for select to authenticated using (
    exists (select 1 from public.contracts c where c.id = contract_id and public.is_member_of(c.squad_id))
  );
create policy "own line writes" on public.contract_lines
  for all to authenticated using (
    exists (select 1 from public.contracts c where c.id = contract_id and c.profile_id = auth.uid())
  ) with check (
    exists (select 1 from public.contracts c where c.id = contract_id and c.profile_id = auth.uid())
  );

create policy "proofs are visible to the squad" on public.proofs
  for select to authenticated using (public.is_member_of(squad_id));
create policy "own proof capture" on public.proofs
  for insert to authenticated with check (profile_id = auth.uid() and public.is_member_of(squad_id));

-- verifications: no member policies; only the service role reads and writes them.

create policy "vouches are visible to the squad" on public.vouches
  for select to authenticated using (
    exists (select 1 from public.proofs p where p.id = proof_id and public.is_member_of(p.squad_id))
  );
create policy "squadmates can vouch, never for themselves" on public.vouches
  for insert to authenticated with check (
    voucher_id = auth.uid() and exists (
      select 1 from public.proofs p
      where p.id = proof_id and p.profile_id <> auth.uid() and public.is_member_of(p.squad_id)
    )
  );

create policy "marks are visible to the squad" on public.day_marks
  for select to authenticated using (public.is_member_of(squad_id));

create policy "rescues are visible to the squad" on public.rescues
  for select to authenticated using (public.is_member_of(squad_id));
create policy "own rescues" on public.rescues
  for insert to authenticated with check (profile_id = auth.uid() and public.is_member_of(squad_id));

create policy "rounds are visible to the squad" on public.rounds
  for select to authenticated using (public.is_member_of(squad_id));
create policy "ledger is visible to the squad" on public.ledger_entries
  for select to authenticated using (public.is_member_of(squad_id));

create policy "votes are visible to the squad" on public.pot_votes
  for select to authenticated using (public.is_member_of(squad_id));
create policy "own vote" on public.pot_votes
  for all to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid() and public.is_member_of(squad_id));

create policy "episodes are visible to the squad" on public.episodes
  for select to authenticated using (public.is_member_of(squad_id));

create policy "own connections" on public.connections
  for all to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- ---------------------------------------------------------------------------
-- storage: private buckets, owner uploads, squadmates read through signed URLs
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values
  ('proofs', 'proofs', false),
  ('signatures', 'signatures', false),
  ('cards', 'cards', false)
on conflict (id) do nothing;

create policy "members upload their own proofs" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('proofs', 'signatures', 'cards') and (storage.foldername(name))[1] = auth.uid()::text);

create policy "members read their own files" on storage.objects
  for select to authenticated
  using (bucket_id in ('proofs', 'signatures', 'cards') and (storage.foldername(name))[1] = auth.uid()::text);

-- The daily tick and the Sunday settlement live in 20260905000001_ticks_and_settlement.sql.
