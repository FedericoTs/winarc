import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { episodeStats, type EpisodeMark } from '@winarc/domain';
import { CONTRACT, MARCO, SQUAD, YOU, asAdmin, asUser, close, expectError, newUser, open } from './helpers';

let c: pg.Client;
beforeEach(async () => {
  c = await open();
  await asAdmin(c);
});
afterEach(async () => close(c));

const fixture: EpisodeMark[] = [
  { day: 1, mark: 'V', tier: 'GOLD' },
  { day: 2, mark: 'V', tier: 'SILVER' },
  { day: 3, mark: 'X' },
  { day: 4, mark: 'S' },
  { day: 5, mark: 'B', tier: 'BRONZE' },
  { day: 6, mark: 'V', tier: 'GOLD' },
  { day: 8, mark: 'V', tier: 'SILVER' },
  { day: 31, mark: 'V', tier: 'GOLD' },
];

/** Writes the fixture as gym marks with matching proofs, one per day. */
async function seedMarks(): Promise<void> {
  const line = (await c.query(`select id from public.contract_lines where contract_id = $1 and key = 'GYM'`, [CONTRACT])).rows[0].id;
  for (const m of fixture) {
    const date = `2026-10-${String(m.day).padStart(2, '0')}`;
    const week = Math.ceil((m.day + 3) / 7);
    await c.query(
      `insert into public.day_marks (contract_line_id, profile_id, squad_id, local_date, day, week, mark) values ($1, $2, $3, $4, $5, $6, $7)`,
      [line, YOU, SQUAD, date, m.day, week, m.mark],
    );
    if (m.tier) {
      await c.query(
        `insert into public.proofs (contract_line_id, profile_id, squad_id, local_date, day, status, tier) values ($1, $2, $3, $4, $5, $6, $7)`,
        [line, YOU, SQUAD, date, m.day, m.mark === 'B' ? 'vouched' : 'verified', m.tier],
      );
    }
  }
}

describe('episode stats', () => {
  it('agrees with the domain on the same fixture and ignores the next chapter', async () => {
    await seedMarks();
    await asUser(c, YOU);
    const sql = (await c.query(`select public.episode_stats($1, 1) as s`, [YOU])).rows[0].s;
    const expected = episodeStats(1, fixture);
    expect({ ...sql, hit_rate: Number(sql.hit_rate) }).toEqual(expected);
    expect(expected).toMatchObject({ proofs: 5, misses: 1, sick_days: 1, best_streak: 3, days_proved: 5 });

    const second = (await c.query(`select public.episode_stats($1, 2) as s`, [YOU])).rows[0].s;
    expect(second).toMatchObject({ proofs: 1, gold: 1, due: 1, best_streak: 1 });
  });

  it('is readable by a squadmate, not by a stranger, and only for episodes 1 to 3', async () => {
    await seedMarks();
    await asUser(c, MARCO);
    expect((await c.query(`select public.episode_stats($1, 1) as s`, [YOU])).rows[0].s.proofs).toBe(5);
    expect(await expectError(c, `select public.episode_stats($1, 4)`, [YOU])).toMatch(/1, 2 or 3/);

    const stranger = await newUser(c, 'Nadia');
    await asUser(c, stranger);
    expect(await expectError(c, `select public.episode_stats($1, 1)`, [YOU])).toMatch(/not your squad/);
  });
});
