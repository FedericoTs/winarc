/**
 * close-day
 *
 * Runs hourly from pg_cron. For every member whose local clock just passed
 * midnight, it closes yesterday's open marks as misses and opens today's due
 * marks from the contract schedule. Days close at 23:59 local; Sundays close
 * at 21:00 inside settle-week instead, when the ledger runs.
 *
 * Idempotent: a second run in the same hour finds nothing to change.
 */
import { SEASON_ONE, addDays, dayOfSeason, localISODate, phaseOn, weekOfSeason, weekdayOf } from '@arc/domain';
import { adminClient, json, localHour, requireCronSecret } from '../_shared/supabase.ts';

declare const Deno: { serve(handler: (req: Request) => Promise<Response> | Response): void };

type Profile = { id: string; tz: string };
type Line = { id: string; kind: string; days: number[]; staked: boolean; contracts: { profile_id: string; squad_id: string } | { profile_id: string; squad_id: string }[] | null };

Deno.serve(async (req) => {
  const denied = requireCronSecret(req);
  if (denied) return denied;

  const admin = adminClient();
  const now = new Date();
  const { data: profiles } = await admin.from('profiles').select('id, tz').returns<Profile[]>();
  let closed = 0;
  let opened = 0;

  for (const profile of profiles ?? []) {
    if (localHour(now, profile.tz) !== 0) continue;
    const today = localISODate(now, profile.tz);
    if (phaseOn(today, SEASON_ONE) !== 'live') continue;
    const yesterday = addDays(today, -1);

    const { count } = await admin
      .from('day_marks')
      .update({ mark: 'X', closed_at: now.toISOString() }, { count: 'exact' })
      .match({ profile_id: profile.id, local_date: yesterday, mark: 'P' });
    closed += count ?? 0;

    const { data: lines } = await admin
      .from('contract_lines')
      .select('id, kind, days, staked, contracts!inner(profile_id, squad_id, season_id)')
      .eq('contracts.profile_id', profile.id)
      .eq('contracts.season_id', SEASON_ONE.id)
      .returns<Line[]>();

    const weekday = weekdayOf(today);
    for (const line of lines ?? []) {
      if (!line.staked || !line.days.includes(weekday)) continue;
      const contract = Array.isArray(line.contracts) ? line.contracts[0] : line.contracts;
      if (!contract) continue;
      const { error } = await admin.from('day_marks').upsert(
        {
          contract_line_id: line.id,
          profile_id: profile.id,
          squad_id: contract.squad_id,
          local_date: today,
          day: dayOfSeason(today, SEASON_ONE),
          week: weekOfSeason(today, SEASON_ONE),
          mark: 'P',
        },
        { onConflict: 'contract_line_id,local_date', ignoreDuplicates: true },
      );
      if (!error) opened++;
    }
  }

  return json({ closed, opened, at: now.toISOString() });
});
