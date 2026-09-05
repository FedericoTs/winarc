import { describe, it, expect } from 'vitest';
import { ledgerOrder, settleWeek, sickDaysLeft, squadStreak, vouchesLeft, type DayMark } from '../src/settlement';

const marks = (s: string): DayMark[] => s.split('') as DayMark[];

const week = [
  { memberId: 'you', marks: marks('VVRVVRV') },
  { memberId: 'marco', marks: marks('VXRVBRV') },
  { memberId: 'giulia', marks: marks('VVVRVRV') },
  { memberId: 'sam', marks: marks('XVRXVRV') },
];

describe('the Sunday ledger', () => {
  it('counts hits, misses, what is owed and the pot', () => {
    const s = settleWeek(week, 1000);
    expect(s.rows.find((r) => r.memberId === 'marco')).toMatchObject({ hits: 4, misses: 1, owedCents: 1000, clean: false });
    expect(s.rows.find((r) => r.memberId === 'sam')?.owedCents).toBe(2000);
    expect(s.rows.find((r) => r.memberId === 'you')).toMatchObject({ hits: 5, misses: 0, owedCents: 0, clean: true });
    expect(s.potAddedCents).toBe(3000);
    expect(s.hitRate).toBeCloseTo(0.85);
  });

  it('names the MVP among clean weeks, first on ties', () => {
    expect(settleWeek(week, 1000).mvp).toBe('you');
    const empty = settleWeek([], 1000);
    expect(empty.mvp).toBeNull();
    expect(empty.hitRate).toBe(1);
    expect(empty.potAddedCents).toBe(0);
  });

  it('orders the ledger clean first, then by hits, then as given', () => {
    const rows = ledgerOrder(settleWeek(week, 1000).rows);
    expect(rows.map((r) => r.memberId)).toEqual(['you', 'giulia', 'marco', 'sam']);
  });

  it('counts the squad streak and ignores squad-wide rest days', () => {
    expect(squadStreak([marks('VV'), marks('VB'), marks('RR'), marks('VV')])).toBe(3);
    expect(squadStreak([marks('VV'), marks('VB'), marks('RR'), marks('VX')])).toBe(0);
    expect(squadStreak([marks('VS'), marks('VV')])).toBe(2);
    expect(squadStreak([])).toBe(0);
  });

  it('tracks rescue allowances', () => {
    expect(sickDaysLeft(0)).toBe(1);
    expect(sickDaysLeft(1)).toBe(0);
    expect(vouchesLeft(0)).toBe(1);
    expect(vouchesLeft(2)).toBe(0);
  });
});
