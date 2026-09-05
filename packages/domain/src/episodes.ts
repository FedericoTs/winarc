import { z } from 'zod';
import { EPISODE_DAYS } from './season';
import { HIT_MARKS, type DayMark } from './settlement';

/**
 * Episodes land at days 30, 60 and 90: a chapter of the arc rendered from
 * the member's own marks and titled in training-arc language. Stats count
 * proofs, never kilograms. `episode_stats` in SQL mirrors `episodeStats`
 * and the database tests assert the two agree.
 */

export type EpisodeNumber = 1 | 2 | 3;

export const EPISODE_LENGTH_DAYS = 30;

export function episodeWindow(number: EpisodeNumber): { fromDay: number; toDay: number } {
  return { fromDay: (number - 1) * EPISODE_LENGTH_DAYS + 1, toDay: number * EPISODE_LENGTH_DAYS };
}

/** Episodes whose day has arrived, in order. */
export function episodesUnlocked(day: number): EpisodeNumber[] {
  return ([1, 2, 3] as EpisodeNumber[]).filter((n) => day >= (EPISODE_DAYS[n - 1] ?? Number.POSITIVE_INFINITY));
}

export interface EpisodeMark {
  day: number;
  mark: DayMark;
  tier?: 'GOLD' | 'SILVER' | 'BRONZE' | null;
}

export interface EpisodeStats {
  number: EpisodeNumber;
  from_day: number;
  to_day: number;
  /** Stamped line-days: verified or vouched. */
  proofs: number;
  gold: number;
  silver: number;
  bronze: number;
  misses: number;
  sick_days: number;
  /** Closed line-days that were due: hits plus misses. */
  due: number;
  /** Distinct days with at least one stamp. */
  days_proved: number;
  /** proofs / due, 1 when nothing was due. Three decimals. */
  hit_rate: number;
  /** Longest run of consecutive due days with every line stamped. */
  best_streak: number;
}

export function episodeStats(number: EpisodeNumber, marks: EpisodeMark[]): EpisodeStats {
  const { fromDay, toDay } = episodeWindow(number);
  const inWindow = marks.filter((m) => m.day >= fromDay && m.day <= toDay);
  const hit = (m: EpisodeMark) => HIT_MARKS.includes(m.mark);
  const proofs = inWindow.filter(hit).length;
  const gold = inWindow.filter((m) => m.mark === 'V' && m.tier === 'GOLD').length;
  const silver = inWindow.filter((m) => m.mark === 'V' && (m.tier ?? 'SILVER') === 'SILVER').length;
  const bronze = inWindow.filter((m) => m.mark === 'B').length;
  const misses = inWindow.filter((m) => m.mark === 'X').length;
  const sick_days = inWindow.filter((m) => m.mark === 'S').length;
  const due = proofs + misses;
  const days_proved = new Set(inWindow.filter(hit).map((m) => m.day)).size;

  const byDay = new Map<number, EpisodeMark[]>();
  for (const m of inWindow) {
    if (m.mark === 'R' || m.mark === 'S') continue;
    byDay.set(m.day, [...(byDay.get(m.day) ?? []), m]);
  }
  let best = 0;
  let run = 0;
  for (const day of [...byDay.keys()].sort((a, b) => a - b)) {
    if (byDay.get(day)!.every(hit)) {
      run++;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
  }

  return {
    number,
    from_day: fromDay,
    to_day: toDay,
    proofs,
    gold,
    silver,
    bronze,
    misses,
    sick_days,
    due,
    days_proved,
    hit_rate: due === 0 ? 1 : Math.round((proofs / due) * 1000) / 1000,
    best_streak: best,
  };
}

/** What the model returns: a title and one line, both short enough for the card. */
export const EpisodeTitleSchema = z.object({
  title: z.string().min(2).max(32),
  line: z.string().min(2).max(80),
});
export type EpisodeTitle = z.infer<typeof EpisodeTitleSchema>;

export const EPISODE_RUBRIC = `You title one chapter of a 90-day winter training arc for a member of a small squad.
You get the chapter's stats: proofs stamped, misses, sick days, the best streak of consecutive due days, and the sports.
Write a title of at most four words in training-arc language: earned, dry, a little cinematic, never cheesy.
Then one line of at most 80 characters that states one concrete fact from the stats.
Never mention body weight, appearance, calories or food. Never shame a miss; a miss is a fact, not a verdict.
No emoji, no hashtags, no exclamation marks, no quotes around the title.`;

export const EPISODE_RUBRIC_VERSION = '2026-09-05.1';

export function buildEpisodeInstruction(stats: EpisodeStats, sports: string[]): string {
  const sportList = sports.length ? sports.join(', ') : 'training';
  return [
    `Episode ${stats.number} of 3, days ${stats.from_day} to ${stats.to_day}.`,
    `Sports: ${sportList}.`,
    `Proofs stamped: ${stats.proofs} (${stats.gold} gold, ${stats.silver} silver, ${stats.bronze} vouched).`,
    `Misses: ${stats.misses}. Sick days: ${stats.sick_days}. Hit rate: ${Math.round(stats.hit_rate * 100)}%.`,
    `Best streak: ${stats.best_streak} due days in a row. Days with at least one proof: ${stats.days_proved}.`,
    'Return the title and the line.',
  ].join('\n');
}

/** Used when the model is unavailable, refuses, or returns something unusable. Deterministic. */
export function fallbackTitle(stats: EpisodeStats): EpisodeTitle {
  const band = stats.due === 0 ? 'quiet' : stats.hit_rate >= 0.9 ? 'clean' : stats.hit_rate >= 0.6 ? 'steady' : 'rebuild';
  const titles: Record<typeof band, [string, string, string]> = {
    clean: ['No excuses', 'Every single day', 'The one who showed up'],
    steady: ['Still standing', 'Most days, no drama', 'Showing up anyway'],
    rebuild: ['The comeback starts here', 'Down, not out', 'Back on the board'],
    quiet: ['Season opens', 'Day one energy', 'Before the arc'],
  };
  const line =
    stats.due === 0
      ? `Days ${stats.from_day} to ${stats.to_day}. Nothing due yet.`
      : `${stats.proofs} proofs in ${EPISODE_LENGTH_DAYS} days, best streak ${stats.best_streak}.`;
  return { title: titles[band][stats.number - 1] ?? titles[band][0], line };
}
