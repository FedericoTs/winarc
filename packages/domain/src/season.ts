/**
 * Season calendar. Dates are ISO `YYYY-MM-DD` strings and all arithmetic is
 * done in UTC on date-only values, so nothing here depends on the server's
 * timezone. A member's "today" is derived with `localISODate` from their own
 * timezone before it reaches these functions.
 */

export interface Season {
  id: string;
  /** First arc day. */
  startsOn: string;
  /** Length of the arc in days. Day 1 is `startsOn`. */
  arcDays: number;
  /** Squads lock on this date: no new members, no contract edits. */
  locksOn: string;
  /** Finale and final settlement. May fall after the last arc day. */
  finaleOn: string;
}

/** Season one: 1 Oct 2026 to 29 Dec 2026 (90 days), finale on 31 Dec. */
export const SEASON_ONE: Season = {
  id: 'S01',
  startsOn: '2026-10-01',
  arcDays: 90,
  locksOn: '2026-10-07',
  finaleOn: '2026-12-31',
};

const DAY_MS = 86_400_000;
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

export function utcOf(dateISO: string): number {
  const m = ISO.exec(dateISO);
  if (!m) throw new Error(`Bad ISO date: ${dateISO}`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function isoOf(utcMs: number): string {
  return new Date(utcMs).toISOString().slice(0, 10);
}

export function addDays(dateISO: string, n: number): string {
  return isoOf(utcOf(dateISO) + n * DAY_MS);
}

/** 0 = Sunday ... 6 = Saturday. */
export function weekdayOf(dateISO: string): number {
  return new Date(utcOf(dateISO)).getUTCDay();
}

/** The calendar date of an instant in the member's timezone. */
export function localISODate(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}

export function endsOn(season: Season = SEASON_ONE): string {
  return addDays(season.startsOn, season.arcDays - 1);
}

/** 1-based day of the arc. Below 1 before the start, above `arcDays` after it. */
export function dayOfSeason(dateISO: string, season: Season = SEASON_ONE): number {
  return Math.floor((utcOf(dateISO) - utcOf(season.startsOn)) / DAY_MS) + 1;
}

export type SeasonPhase = 'upcoming' | 'live' | 'finale' | 'ended';

export function phaseOn(dateISO: string, season: Season = SEASON_ONE): SeasonPhase {
  const day = dayOfSeason(dateISO, season);
  if (day < 1) return 'upcoming';
  if (day <= season.arcDays) return 'live';
  if (dateISO <= season.finaleOn) return 'finale';
  return 'ended';
}

export function isLocked(dateISO: string, season: Season = SEASON_ONE): boolean {
  return dateISO >= season.locksOn;
}

/**
 * 1-based week of the season. Weeks end on Sundays. Week 1 runs from the
 * start date to the first Sunday inclusive, so it may be short.
 */
export function weekOfSeason(dateISO: string, season: Season = SEASON_ONE): number {
  const day = dayOfSeason(dateISO, season);
  if (day < 1) return 0;
  const firstSundayOffset = (7 - weekdayOf(season.startsOn)) % 7;
  if (day - 1 <= firstSundayOffset) return 1;
  return 2 + Math.floor((day - 2 - firstSundayOffset) / 7);
}

/** Two weeks per fortnight, used for the sick-day allowance. */
export function fortnightOfSeason(dateISO: string, season: Season = SEASON_ONE): number {
  return Math.ceil(weekOfSeason(dateISO, season) / 2);
}

/** Every Sunday of the season, then the finale day. The ledger runs on these. */
export function settlementDays(season: Season = SEASON_ONE): string[] {
  const out: string[] = [];
  let sunday = addDays(season.startsOn, (7 - weekdayOf(season.startsOn)) % 7);
  while (sunday < season.finaleOn) {
    out.push(sunday);
    sunday = addDays(sunday, 7);
  }
  out.push(season.finaleOn);
  return out;
}

/** Local hour at which the week settles and the ledger is published. */
export const SETTLEMENT_HOUR_LOCAL = 21;

export const EPISODE_DAYS = [30, 60, 90] as const;

export function episodeAtDay(day: number): 1 | 2 | 3 | null {
  const i = EPISODE_DAYS.indexOf(day as (typeof EPISODE_DAYS)[number]);
  return i < 0 ? null : ((i + 1) as 1 | 2 | 3);
}
