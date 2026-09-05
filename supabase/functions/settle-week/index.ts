/**
 * settle-week
 *
 * Runs hourly from pg_cron. For every active squad whose founder's local time
 * is Sunday 21:00, or the finale day at 21:00, it closes the day's open marks,
 * settles the week with the shared domain logic, writes the round and the
 * ledger entries, and names the MVP. Settlement is a ledger update: no card
 * is charged, ever, in season one.
 *
 * Idempotent through the unique (squad_id, week) round.
 */
import { SEASON_ONE, localISODate, phaseOn, settleWeek, weekOfSeason, weekdayOf, type DayMark, type MemberWeek } from '@arc/domain';
import { adminClient, json, localHour, requireCronSecret } from '../_shared/supabase.ts';

declare const Deno: { serve(handler: (req: Request) => Promise<Response> | Response): void };

type Squad = { id: string; stake_cents: number; founder_id: string; profiles: { tz: string } | { tz: string }[] | null };
type Mark = { id: string; profile_id: string; contract_line_id: string; local_date: string; mark: DayMark };

const SETTLE_HOUR = 21;

Deno.serve(async (req) => {
  const denied = requireCronSecret(req);
  if (denied) return denied;

  const admin = adminClient();
  const now = new Date();
  const { data: squads } = await admin
    .from('squads')
    .select('id, stake_cents, founder_id, profiles!squads_founder_id_fkey(tz)')
    .is('dissolved_at', null)
    .eq('season_id', SEASON_ONE.id)
    .returns<Squad[]>();

  const settled: string[] = [];

  for (const squad of squads ?? []) {
    const founder = Array.isArray(squad.profiles) ? squad.profiles[0] : squad.profiles;
    const tz = founder?.tz ?? 'UTC';
    if (localHour(now, tz) !== SETTLE_HOUR) continue;
    const today = localISODate(now, tz);
    const phase = phaseOn(today, SEASON_ONE);
    const isFinale = today === SEASON_ONE.finaleOn;
    if (!(phase === 'live' && weekdayOf(today) === 0) && !isFinale) continue;

    const week = weekOfSeason(today, SEASON_ONE);
    const { data: existing } = await admin.from('rounds').select('id').match({ squad_id: squad.id, week }).maybeSingle();
    if (existing) continue;

    // Sunday and finale marks close at 21:00, when the ledger runs.
    await admin
      .from('day_marks')
      .update({ mark: 'X', closed_at: now.toISOString() })
      .match({ squad_id: squad.id, local_date: today, mark: 'P' });

    const { data: marks } = await admin
      .from('day_marks')
      .select('id, profile_id, contract_line_id, local_date, mark')
      .match({ squad_id: squad.id, week })
      .returns<Mark[]>();

    const byMember = new Map<string, MemberWeek>();
    for (const m of marks ?? []) {
      if (m.mark === 'P') continue; // still open: never counted
      const entry = byMember.get(m.profile_id) ?? { memberId: m.profile_id, marks: [] };
      entry.marks.push(m.mark);
      byMember.set(m.profile_id, entry);
    }

    const result = settleWeek([...byMember.values()], squad.stake_cents);
    const { data: round, error } = await admin
      .from('rounds')
      .insert({
        squad_id: squad.id,
        week,
        pot_added_cents: result.potAddedCents,
        hit_rate: Number(result.hitRate.toFixed(4)),
        mvp_profile_id: result.mvp,
      })
      .select('id')
      .single<{ id: string }>();
    if (error || !round) continue;

    const entries = (marks ?? [])
      .filter((m) => m.mark === 'X')
      .map((m) => ({
        squad_id: squad.id,
        round_id: round.id,
        profile_id: m.profile_id,
        amount_cents: squad.stake_cents,
        reason: 'miss',
        local_date: m.local_date,
        contract_line_id: m.contract_line_id,
      }));
    if (entries.length) await admin.from('ledger_entries').insert(entries);
    settled.push(squad.id);
  }

  return json({ settled, at: now.toISOString() });
});
