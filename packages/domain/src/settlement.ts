/**
 * The Sunday ledger. Settlement is a ledger update, never a card charge:
 * misses become pot entries the squad spends by vote at the finale.
 *
 * Callers pass only closed days. A day closes at 23:59 local, so a round run
 * on Sunday 21:00 covers Monday to Saturday plus any earlier Sunday marks
 * that were already closed by rest or sick day.
 */

/** V verified, B vouched, X missed, R rest, S sick day, P pending (open). */
export type DayMark = 'V' | 'B' | 'X' | 'R' | 'S' | 'P';

export const HIT_MARKS: readonly DayMark[] = ['V', 'B'];

export interface MemberWeek {
  memberId: string;
  marks: DayMark[];
}

export interface MemberRow {
  memberId: string;
  hits: number;
  misses: number;
  owedCents: number;
  clean: boolean;
}

export interface Settlement {
  rows: MemberRow[];
  potAddedCents: number;
  /** hits / (hits + misses), 1 when nothing was due. */
  hitRate: number;
  mvp: string | null;
}

export function settleWeek(members: MemberWeek[], stakeCents: number): Settlement {
  const rows: MemberRow[] = members.map((m) => {
    let hits = 0;
    let misses = 0;
    for (const mark of m.marks) {
      if (HIT_MARKS.includes(mark)) hits++;
      else if (mark === 'X') misses++;
    }
    return { memberId: m.memberId, hits, misses, owedCents: misses * stakeCents, clean: misses === 0 };
  });
  const hits = rows.reduce((a, r) => a + r.hits, 0);
  const misses = rows.reduce((a, r) => a + r.misses, 0);
  const potAddedCents = rows.reduce((a, r) => a + r.owedCents, 0);
  const hitRate = hits + misses === 0 ? 1 : hits / (hits + misses);

  let mvp: MemberRow | null = null;
  for (const r of rows) {
    if (!r.clean || r.hits === 0) continue;
    if (!mvp || r.hits > mvp.hits) mvp = r;
  }
  return { rows, potAddedCents, hitRate, mvp: mvp?.memberId ?? null };
}

/** Rows ordered for the ledger: clean weeks first, then by hits, then by name order given. */
export function ledgerOrder(rows: MemberRow[]): MemberRow[] {
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => a.r.misses - b.r.misses || b.r.hits - a.r.hits || a.i - b.i)
    .map((x) => x.r);
}

export const RESCUE = {
  sickDaysPerFortnight: 1,
  vouchesPerWeek: 1,
} as const;

export function sickDaysLeft(usedThisFortnight: number): number {
  return Math.max(0, RESCUE.sickDaysPerFortnight - usedThisFortnight);
}

export function vouchesLeft(usedThisWeek: number): number {
  return Math.max(0, RESCUE.vouchesPerWeek - usedThisWeek);
}

/** A miss costs the stake and marks the day. It never resets a streak to zero. */
export function squadStreak(days: DayMark[][]): number {
  // days[d] holds one mark per member for day d, oldest first.
  let streak = 0;
  for (let d = days.length - 1; d >= 0; d--) {
    const marks = days[d] ?? [];
    const due = marks.filter((m) => m !== 'R' && m !== 'S');
    if (due.length === 0) continue; // a squad-wide rest day neither breaks nor extends the streak
    if (due.every((m) => HIT_MARKS.includes(m))) streak++;
    else break;
  }
  return streak;
}

/** How a member's marks for one day roll up on the board: a miss outranks a pending, a pending outranks a hit. */
const ROLLUP_ORDER: DayMark[] = ['X', 'P', 'V', 'B', 'S', 'R'];

export function rollupMark(marks: DayMark[]): DayMark {
  return ROLLUP_ORDER.find((m) => marks.includes(m)) ?? 'R';
}
