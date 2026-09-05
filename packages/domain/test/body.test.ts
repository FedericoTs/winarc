import { describe, expect, it } from 'vitest';
import { formatDelta, isWeighDay, rollupMark, validKg, weighTrend } from '../src';

describe('weigh-in trend', () => {
  it('is empty without readings and never invents a target', () => {
    expect(weighTrend([])).toEqual({ first: null, latest: null, deltaKg: 0, readings: 0 });
    expect(weighTrend([{ date: '2026-10-04', kg: 84 }])).toMatchObject({ deltaKg: 0, readings: 1 });
  });

  it('sorts by date and reports latest minus first to a tenth', () => {
    const t = weighTrend([
      { date: '2026-10-18', kg: 82.46 },
      { date: '2026-10-04', kg: 84 },
      { date: '2026-10-11', kg: 83.2 },
    ]);
    expect(t.first?.date).toBe('2026-10-04');
    expect(t.latest?.date).toBe('2026-10-18');
    expect(t.deltaKg).toBe(-1.5);
    expect(t.readings).toBe(3);
  });

  it('formats deltas with a sign and one decimal', () => {
    expect(formatDelta(-1.24)).toBe('−1.2 kg');
    expect(formatDelta(0.04)).toBe('±0.0 kg');
    expect(formatDelta(0.5)).toBe('+0.5 kg');
  });

  it('bounds readings and knows the weigh day', () => {
    expect(validKg(19)).toBe(false);
    expect(validKg(82.4)).toBe(true);
    expect(validKg(Number.NaN)).toBe(false);
    expect(isWeighDay([0], 0)).toBe(true);
    expect(isWeighDay([0], 3)).toBe(false);
  });
});

describe('board rollup', () => {
  it('lets a miss outrank a pending and a pending outrank a hit', () => {
    expect(rollupMark(['V', 'X'])).toBe('X');
    expect(rollupMark(['V', 'P'])).toBe('P');
    expect(rollupMark(['B', 'V'])).toBe('V');
    expect(rollupMark(['S'])).toBe('S');
    expect(rollupMark([])).toBe('R');
  });
});
