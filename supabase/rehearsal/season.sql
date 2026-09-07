-- Rehearsal season for a STAGING project. Never run this against production.
--
-- Rewrites the one season row to a two-week arc starting tomorrow: squads lock
-- after two days, two Sunday ledgers fall inside it, and the finale lands the
-- day after the last arc day. The app, the web page, the daily tick and the
-- settlement all read this row, so nothing else changes and no binary is
-- rebuilt. Episodes will not fire in a 14-day arc; that is expected.
--
-- Run it in the SQL editor of the staging project, then sign contracts on the
-- staging build. To end the rehearsal, run reset.sql.

update public.seasons
   set starts_on = current_date + 1,
       arc_days = 14,
       locks_on = current_date + 3,
       finale_on = current_date + 15
 where id = 'S01';

select id, starts_on, arc_days, locks_on, finale_on from public.seasons;
