import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { SEASON_ONE, addDays, dayOfSeason, weekOfSeason } from '@winarc/domain';
import { SQUAD, asAdmin, close, expectError, open } from './helpers';

let c: pg.Client;
beforeEach(async () => {
  c = await open();
  await asAdmin(c);
});
afterEach(async () => close(c));

const TABLES = [
  'profiles', 'seasons', 'squads', 'squad_members', 'contracts', 'contract_lines', 'proofs', 'verifications',
  'vouches', 'day_marks', 'rescues', 'rounds', 'ledger_entries', 'pot_votes', 'episodes', 'connections',
];

describe('schema', () => {
  it('applies the migrations and the seed', async () => {
    const { rows } = await c.query(`select code, size, stake_cents, pot_rule from public.squads where id = $1`, [SQUAD]);
    expect(rows[0]).toMatchObject({ code: 'WIN-7K2Q', size: 5, stake_cents: 1000, pot_rule: 'pot' });
    const season = await c.query(`select starts_on::text, arc_days, locks_on::text, finale_on::text from public.seasons where id = 'S01'`);
    expect(season.rows[0]).toEqual({ starts_on: '2026-10-01', arc_days: 90, locks_on: '2026-10-07', finale_on: '2026-12-31' });
  });

  it('has row-level security on every table', async () => {
    const { rows } = await c.query(
      `select relname, relrowsecurity from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r'`,
    );
    for (const t of TABLES) {
      const row = rows.find((r) => r.relname === t);
      expect(row, t).toBeDefined();
      expect(row.relrowsecurity, `${t} rls`).toBe(true);
    }
  });

  it('rejects codes outside the alphabet and squads outside two to eight', async () => {
    expect(
      await expectError(c, `insert into public.squads (season_id, name, code, size, stake_cents, founder_id) values ('S01', 'x', 'WIN-7K2O', 5, 1000, '00000000-0000-0000-0000-000000000001')`),
    ).toMatch(/check/);
    expect(
      await expectError(c, `insert into public.squads (season_id, name, code, size, stake_cents, founder_id) values ('S01', 'x', 'WIN-AB23', 9, 1000, '00000000-0000-0000-0000-000000000001')`),
    ).toMatch(/check/);
  });

  it('agrees with the domain calendar for every day of the season', async () => {
    for (let i = -3; i < 96; i++) {
      const d = addDays(SEASON_ONE.startsOn, i);
      const { rows } = await c.query(
        `select public.day_of_season($1::date, s) as day, public.week_of_season($1::date, s) as week from public.seasons s where s.id = 'S01'`,
        [d],
      );
      expect(rows[0].day, d).toBe(dayOfSeason(d));
      expect(rows[0].week, d).toBe(weekOfSeason(d));
    }
  });
});
