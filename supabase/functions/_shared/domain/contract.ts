import { SPORTS, customSport, type Sport, type VerificationMethod } from './sports.ts';
import { HABITS, customHabit, type Habit, type HabitKind } from './habits.ts';

/**
 * A contract is three to five lines a person can screenshot. Sports lines are
 * staked. The weigh-in is weekly, private, optional and never staked: money
 * rides on the process, not the outcome. Mind and money lines are capped at
 * two so the product stays fitness-led.
 */

export const LIMITS = {
  sportsMin: 1,
  sportsMax: 3,
  habitsMax: 2,
  perWeekMin: 1,
  perWeekMax: 7,
} as const;

export type LineKind = 'sport' | 'body' | HabitKind;

export interface ContractLine {
  key: string;
  kind: LineKind;
  name: string;
  perWeek: number;
  /** Weekdays the line is due, 0 = Sunday. A due day that closes without a hit is a miss. */
  days: number[];
  verification: VerificationMethod;
  /** Misses on staked lines feed the pot. */
  staked: boolean;
}

/** Default training days for a weekly frequency, spread across the week. */
export function defaultDays(perWeek: number): number[] {
  const table: Record<number, number[]> = {
    1: [2],
    2: [1, 4],
    3: [1, 3, 5],
    4: [1, 2, 4, 6],
    5: [1, 2, 3, 5, 6],
    6: [1, 2, 3, 4, 5, 6],
    7: [0, 1, 2, 3, 4, 5, 6],
  };
  return [...(table[clampPerWeek(perWeek)] ?? table[3]!)];
}

/** Validates a chosen schedule against the line frequency. */
export function normalizeDays(days: number[] | undefined, perWeek: number): number[] {
  if (!days) return defaultDays(perWeek);
  const clean = [...new Set(days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b);
  if (clean.length !== perWeek) throw new ContractError('per_week', `Pick exactly ${perWeek} training days`);
  return clean;
}

export interface CustomSportInput {
  key: string;
  name: string;
}

export interface CustomHabitInput {
  key: string;
  name: string;
  verification: VerificationMethod;
  kind?: HabitKind;
}

export interface ContractInput {
  /** Catalog keys or custom keys, one to three. */
  sports: string[];
  customSports?: CustomSportInput[];
  /** Overrides per line key, clamped to 1..7. */
  perWeek?: Record<string, number>;
  /** Chosen weekdays per line key; must match the line frequency. */
  days?: Record<string, number[]>;
  /** Defaults to true. */
  weighIn?: boolean;
  /** Catalog keys or custom keys, at most two. */
  habits?: string[];
  customHabits?: CustomHabitInput[];
}

export type ContractErrorCode =
  | 'sports_min'
  | 'sports_max'
  | 'habits_max'
  | 'per_week'
  | 'unknown_sport'
  | 'unknown_habit';

export class ContractError extends Error {
  constructor(
    public readonly code: ContractErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ContractError';
  }
}

export function clampPerWeek(n: number): number {
  if (!Number.isFinite(n)) throw new ContractError('per_week', 'Frequency must be a number');
  return Math.min(LIMITS.perWeekMax, Math.max(LIMITS.perWeekMin, Math.round(n)));
}

export function resolveSport(key: string, custom: CustomSportInput[] = []): Sport {
  const preset = SPORTS[key];
  if (preset) return preset;
  const c = custom.find((x) => x.key === key);
  if (!c) throw new ContractError('unknown_sport', `Unknown sport: ${key}`);
  return customSport(c.name, c.key);
}

export function resolveHabit(key: string, custom: CustomHabitInput[] = []): Habit {
  const preset = HABITS[key];
  if (preset) return preset;
  const c = custom.find((x) => x.key === key);
  if (!c) throw new ContractError('unknown_habit', `Unknown habit: ${key}`);
  return customHabit(c.name, c.verification, c.kind, c.key);
}

export function buildContract(input: ContractInput): ContractLine[] {
  const sports = [...new Set(input.sports)];
  if (sports.length < LIMITS.sportsMin) throw new ContractError('sports_min', 'Pick at least one sport');
  if (sports.length > LIMITS.sportsMax) {
    throw new ContractError('sports_max', `Pick at most ${LIMITS.sportsMax} sports`);
  }
  const habits = [...new Set(input.habits ?? [])];
  if (habits.length > LIMITS.habitsMax) {
    throw new ContractError('habits_max', `At most ${LIMITS.habitsMax} mind and money lines`);
  }

  const lines: ContractLine[] = [];
  for (const key of sports) {
    const sport = resolveSport(key, input.customSports);
    const perWeek = clampPerWeek(input.perWeek?.[key] ?? sport.sessionsPerWeek);
    lines.push({
      key,
      kind: 'sport',
      name: sport.name,
      perWeek,
      days: normalizeDays(input.days?.[key], perWeek),
      verification: sport.verification,
      staked: true,
    });
  }
  if (input.weighIn ?? true) {
    lines.push({
      key: 'weigh',
      kind: 'body',
      name: 'Weekly weigh-in',
      perWeek: 1,
      days: input.days?.weigh ? normalizeDays(input.days.weigh, 1) : [0],
      verification: 'health_photo',
      staked: false,
    });
  }
  for (const key of habits) {
    const habit = resolveHabit(key, input.customHabits);
    const perWeek = clampPerWeek(input.perWeek?.[key] ?? habit.perWeek);
    lines.push({
      key,
      kind: habit.kind,
      name: habit.name,
      perWeek,
      days: normalizeDays(input.days?.[key], perWeek),
      verification: habit.verification,
      staked: true,
    });
  }
  return lines;
}

/** Staked sport sessions per week; the number the stake math quotes. */
export function sessionsPerWeek(lines: ContractLine[]): number {
  return lines.filter((l) => l.kind === 'sport').reduce((sum, l) => sum + l.perWeek, 0);
}
