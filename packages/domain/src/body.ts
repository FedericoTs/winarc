/**
 * The weekly weigh-in. Private, optional, never staked, never a target. The
 * only number the product derives is the change since the first reading.
 * Squad surfaces never show it; see docs/product/01-product-rules.md.
 */

export const WEIGH_KEY = 'weigh';

export const WEIGH_LIMITS = { minKg: 20, maxKg: 400 } as const;

export interface WeighIn {
  /** Local calendar date, ISO. */
  date: string;
  kg: number;
}

export interface WeighTrend {
  first: WeighIn | null;
  latest: WeighIn | null;
  /** Latest minus first, rounded to a tenth. Zero until there are two readings. */
  deltaKg: number;
  readings: number;
}

export function weighTrend(readings: WeighIn[]): WeighTrend {
  const sorted = readings
    .filter((r) => Number.isFinite(r.kg))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const first = sorted[0] ?? null;
  const latest = sorted[sorted.length - 1] ?? null;
  return {
    first,
    latest,
    deltaKg: first && latest ? tenth(latest.kg - first.kg) : 0,
    readings: sorted.length,
  };
}

/** Signed, one decimal, a real minus sign: "−1.2 kg", "+0.5 kg", "±0.0 kg". */
export function formatDelta(deltaKg: number): string {
  const r = tenth(deltaKg);
  if (r === 0) return '±0.0 kg';
  return `${r > 0 ? '+' : '−'}${Math.abs(r).toFixed(1)} kg`;
}

export function validKg(kg: number): boolean {
  return Number.isFinite(kg) && kg >= WEIGH_LIMITS.minKg && kg <= WEIGH_LIMITS.maxKg;
}

/** Whether a weekday (0 = Sunday) is one of the line's days. */
export function isWeighDay(days: number[], weekday: number): boolean {
  return days.includes(weekday);
}

function tenth(n: number): number {
  return Math.round(n * 10) / 10;
}
