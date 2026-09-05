import { describe, it, expect } from 'vitest';
import { ContractError, buildContract, clampPerWeek, sessionsPerWeek } from '../src/contract';
import { customSportKey } from '../src/sports';

describe('contracts', () => {
  it('builds a default gym contract with a staked sport and a private unstaked weigh-in', () => {
    const lines = buildContract({ sports: ['GYM'] });
    expect(lines.map((l) => l.key)).toEqual(['GYM', 'weigh']);
    expect(lines[0]).toMatchObject({ kind: 'sport', perWeek: 4, staked: true, verification: 'health_photo' });
    expect(lines[1]).toMatchObject({ kind: 'body', perWeek: 1, staked: false });
  });

  it('caps sports at three and mind and money lines at two', () => {
    expect(() => buildContract({ sports: ['GYM', 'RUN', 'SWIM', 'RIDE'] })).toThrow(ContractError);
    try {
      buildContract({ sports: ['GYM', 'RUN', 'SWIM', 'RIDE'] });
    } catch (e) {
      expect((e as ContractError).code).toBe('sports_max');
    }
    expect(() => buildContract({ sports: [] })).toThrow(/at least one/);
    expect(() => buildContract({ sports: ['GYM'], habits: ['read', 'alcohol', 'deep'] })).toThrow(/mind and money/);
  });

  it('resolves custom sports and custom habits', () => {
    const key = customSportKey('Cold plunge');
    expect(key).toBe('C_COLD_PLUNGE');
    const lines = buildContract({
      sports: ['GYM', key],
      customSports: [{ key, name: 'Cold plunge' }],
      weighIn: false,
      habits: ['X_med'],
      customHabits: [{ key: 'X_med', name: 'Meditate 10 min', verification: 'attest' }],
    });
    expect(lines.map((l) => l.name)).toEqual(['Gym sessions', 'Cold plunge sessions', 'Meditate 10 min']);
    expect(lines[1]?.verification).toBe('health_photo');
    expect(lines[2]).toMatchObject({ kind: 'mind', perWeek: 7, staked: true });
  });

  it('clamps frequency to 1..7 and dedupes keys', () => {
    expect(clampPerWeek(0)).toBe(1);
    expect(clampPerWeek(9)).toBe(7);
    expect(clampPerWeek(2.6)).toBe(3);
    const lines = buildContract({ sports: ['RUN', 'RUN'], perWeek: { RUN: 10 }, weighIn: false });
    expect(lines).toHaveLength(1);
    expect(lines[0]?.perWeek).toBe(7);
    expect(sessionsPerWeek(lines)).toBe(7);
  });

  it('schedules training days and validates chosen ones', () => {
    const lines = buildContract({ sports: ['GYM'] });
    expect(lines[0]?.days).toEqual([1, 2, 4, 6]);
    expect(lines[1]?.days).toEqual([0]);
    const chosen = buildContract({ sports: ['RUN'], days: { RUN: [6, 2, 4] }, weighIn: false });
    expect(chosen[0]?.days).toEqual([2, 4, 6]);
    expect(() => buildContract({ sports: ['RUN'], days: { RUN: [1, 2] } })).toThrow(/exactly 3 training days/);
    expect(() => buildContract({ sports: ['RUN'], days: { RUN: [1, 2, 9] } })).toThrow(/exactly 3/);
  });

  it('rejects unknown keys', () => {
    expect(() => buildContract({ sports: ['NOPE'] })).toThrow(/Unknown sport/);
    expect(() => buildContract({ sports: ['GYM'], habits: ['nope'] })).toThrow(/Unknown habit/);
  });
});
