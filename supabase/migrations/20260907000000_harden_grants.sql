-- Hardening from the Supabase security advisors on the production project.
--
-- 1. Helper functions pin their search_path, so a caller cannot shadow a
--    table or function through their own schema.
-- 2. Member RPCs are executable by signed-in members only. Postgres grants
--    EXECUTE to PUBLIC by default, so anonymous callers could reach them and
--    get "not signed in"; now they get "permission denied" before any code
--    runs. squad_preview stays public: the join page behind every share card
--    calls it before anyone has an account. Trigger functions are left alone:
--    PostgREST refuses to call them, and their grants are what the auth
--    service relies on to create profiles.

alter function public.day_of_season(date, public.seasons) set search_path = public;
alter function public.week_of_season(date, public.seasons) set search_path = public;
alter function public.fortnight_of_season(date, public.seasons) set search_path = public;
alter function public.season_on(date) set search_path = public;
alter function public.local_date_for(uuid) set search_path = public;
alter function public.generate_squad_code() set search_path = public;

revoke execute on function public.create_squad(text, int, int, text, text, text) from public, anon;
revoke execute on function public.join_squad(text) from public, anon;
revoke execute on function public.open_today() from public, anon;
revoke execute on function public.use_sick_day() from public, anon;
revoke execute on function public.request_vouch(uuid) from public, anon;
revoke execute on function public.attest_today(uuid, text) from public, anon;
revoke execute on function public.is_member_of(uuid) from public, anon;
revoke execute on function public.is_squadmate_of(uuid) from public, anon;
revoke execute on function public.generate_squad_code() from public, anon;

grant execute on function public.create_squad(text, int, int, text, text, text) to authenticated, service_role;
grant execute on function public.join_squad(text) to authenticated, service_role;
grant execute on function public.open_today() to authenticated, service_role;
grant execute on function public.use_sick_day() to authenticated, service_role;
grant execute on function public.request_vouch(uuid) to authenticated, service_role;
grant execute on function public.attest_today(uuid, text) to authenticated, service_role;
grant execute on function public.is_member_of(uuid) to authenticated, service_role;
grant execute on function public.is_squadmate_of(uuid) to authenticated, service_role;
grant execute on function public.generate_squad_code() to authenticated, service_role;
