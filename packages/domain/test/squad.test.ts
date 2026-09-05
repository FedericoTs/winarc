import { describe, it, expect } from 'vitest';
import {
  CODE_ALPHABET,
  SquadError,
  canJoin,
  formatStake,
  generateCode,
  normalizeCode,
  shouldDissolve,
  spotsLeft,
  validateTerms,
} from '../src/squad';

describe('squad terms', () => {
  const ok = { size: 5, stakeCents: 1000, potRule: 'pot' as const, currency: 'EUR' as const };

  it('accepts sizes two to eight, the three stake tiers and the live pot rule', () => {
    expect(validateTerms(ok)).toBe(ok);
    expect(validateTerms({ ...ok, size: 2 })).toBeTruthy();
    expect(validateTerms({ ...ok, size: 8, stakeCents: 2500 })).toBeTruthy();
    expect(() => validateTerms({ ...ok, size: 1 })).toThrow(SquadError);
    expect(() => validateTerms({ ...ok, size: 9 })).toThrow(/2 to 8/);
    expect(() => validateTerms({ ...ok, stakeCents: 700 })).toThrow(/Stake/);
    expect(() => validateTerms({ ...ok, potRule: 'charity' })).toThrow(/not live/);
  });

  it('generates codes people can read aloud', () => {
    expect(generateCode()).toMatch(/^ARC-[A-HJ-NP-Z2-9]{4}$/);
    expect(CODE_ALPHABET).not.toMatch(/[IO01]/);
    expect(generateCode(() => 0)).toBe('ARC-AAAA');
  });

  it('normalizes typed codes', () => {
    expect(normalizeCode('arc-7k2q')).toBe('ARC-7K2Q');
    expect(normalizeCode(' 7k2q ')).toBe('ARC-7K2Q');
    expect(normalizeCode('ARC 7K2Q')).toBe('ARC-7K2Q');
    expect(normalizeCode('ARCD')).toBe('ARC-ARCD');
    expect(normalizeCode('ARC-7K2')).toBeNull();
    expect(normalizeCode('ARC-7K2O')).toBeNull();
  });

  it('tracks spots, joining and dissolving', () => {
    expect(spotsLeft(5, 1)).toBe(4);
    expect(spotsLeft(2, 3)).toBe(0);
    expect(canJoin({ size: 5, memberCount: 4, dateISO: '2026-10-06' })).toEqual({ ok: true });
    expect(canJoin({ size: 5, memberCount: 5, dateISO: '2026-10-06' })).toEqual({ ok: false, reason: 'full' });
    expect(canJoin({ size: 5, memberCount: 1, dateISO: '2026-10-07' })).toEqual({ ok: false, reason: 'locked' });
    expect(canJoin({ size: 5, memberCount: 1, dateISO: '2026-10-01', dissolved: true })).toEqual({
      ok: false,
      reason: 'dissolved',
    });
    expect(shouldDissolve(5, 2)).toBe(true);
    expect(shouldDissolve(5, 3)).toBe(false);
    expect(shouldDissolve(2, 1)).toBe(true);
    expect(shouldDissolve(2, 2)).toBe(false);
    expect(shouldDissolve(8, 3)).toBe(false);
  });

  it('formats stakes in the squad currency', () => {
    expect(formatStake(1000, 'EUR')).toBe('€10');
    expect(formatStake(2500, 'USD')).toBe('$25');
    expect(formatStake(1050, 'EUR')).toBe('€10.50');
  });
});
