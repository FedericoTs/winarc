import { SEASON_ONE, localISODate, pickSeason, seasonFromRow, type Season, type SeasonRow } from '@winarc/domain';
import { supabase } from './supabase';

/**
 * The season is a database row, not a constant compiled into the app. Every
 * screen renders `season()`, which `loadSeason` sets before the first paint.
 * A rehearsal is one row on a staging project, and a slipped launch date is
 * an update, not a new binary. `SEASON_ONE` stays as the offline fallback.
 */

const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
const LOAD_TIMEOUT_MS = 4000;

let current: Season = SEASON_ONE;
let source: 'database' | 'fallback' = 'fallback';

export function season(): Season {
  return current;
}

export function seasonSource(): 'database' | 'fallback' {
  return source;
}

/** Reads the public seasons table and picks the one for today. Never throws and never waits longer than the timeout. */
export async function loadSeason(): Promise<Season> {
  const read = (async () => {
    const { data } = await supabase.from('seasons').select('id, starts_on, arc_days, locks_on, finale_on');
    const rows = (data as SeasonRow[] | null) ?? [];
    return pickSeason(rows.map(seasonFromRow), localISODate(new Date(), tz));
  })();
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), LOAD_TIMEOUT_MS));
  try {
    const picked = await Promise.race([read, timeout]);
    if (picked) {
      current = picked;
      source = 'database';
    }
  } catch {
    // Offline or no env: the compiled season keeps the app usable.
  }
  return current;
}
