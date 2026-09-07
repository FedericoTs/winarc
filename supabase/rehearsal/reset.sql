-- Ends a rehearsal on a STAGING project: restores season one's real dates and
-- clears every row the rehearsal produced, leaving accounts in place so the
-- same people can sign real contracts. Never run this against production.

begin;

delete from public.ledger_entries;
delete from public.pot_votes;
delete from public.rounds;
delete from public.episodes;
delete from public.vouches;
delete from public.rescues;
delete from public.day_marks;
delete from public.verifications;
delete from public.proofs;
delete from public.weigh_ins;
delete from public.contract_lines;
delete from public.contracts;
delete from public.squad_members;
delete from public.squads;
delete from public.push_tokens;

update public.seasons
   set starts_on = '2026-10-01', arc_days = 90, locks_on = '2026-10-07', finale_on = '2026-12-31'
 where id = 'S01';

commit;

select id, starts_on, arc_days, locks_on, finale_on from public.seasons;
