-- Local development seed. Creates two members and one squad so screens have data.
-- Passwords are for the local stack only.

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'you@arc.local', crypt('password', gen_salt('bf')), now(), '{"name":"You"}', now(), now()),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'marco@arc.local', crypt('password', gen_salt('bf')), now(), '{"name":"Marco"}', now(), now())
on conflict (id) do nothing;

update public.profiles set handle = 'you', tz = 'Europe/Rome', adult_confirmed_at = now() where id = '00000000-0000-0000-0000-000000000001';
update public.profiles set handle = 'marco', tz = 'Europe/Rome', adult_confirmed_at = now() where id = '00000000-0000-0000-0000-000000000002';

insert into public.squads (id, season_id, name, code, size, stake_cents, pot_rule, currency, founder_id)
values ('10000000-0000-0000-0000-000000000001', 'S01', 'The Cold Starters', 'WIN-7K2Q', 5, 1000, 'pot', 'EUR', '00000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;

insert into public.squad_members (squad_id, profile_id, season_id, role) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'S01', 'founder'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'S01', 'member')
on conflict do nothing;

insert into public.contracts (id, profile_id, squad_id, season_id, weigh_in, signed_at)
values ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'S01', true, now())
on conflict (id) do nothing;

insert into public.contract_lines (contract_id, key, kind, name, per_week, days, verification, staked, position) values
  ('20000000-0000-0000-0000-000000000001', 'GYM', 'sport', 'Gym sessions', 4, '{1,2,4,6}', 'health_photo', true, 0),
  ('20000000-0000-0000-0000-000000000001', 'weigh', 'body', 'Weekly weigh-in', 1, '{0}', 'health_photo', false, 1),
  ('20000000-0000-0000-0000-000000000001', 'read', 'mind', 'Read 20 pages', 7, '{0,1,2,3,4,5,6}', 'photo', true, 2)
on conflict do nothing;
