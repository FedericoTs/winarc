import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { SEASON_ONE, pickSeason, seasonFromRow, type SeasonRow } from '@winarc/domain';
import { asAdmin, asAnon, close, open } from './helpers';

let c: pg.Client;
beforeEach(async () => {
  c = await open();
  await asAdmin(c);
});
afterEach(async () => close(c));

describe('the season row', () => {
  it('is readable before sign-in and maps onto the compiled fallback', async () => {
    await asAnon(c);
    const rows = (await c.query(`select id, starts_on::text, arc_days, locks_on::text, finale_on::text from public.seasons`)).rows as SeasonRow[];
    expect(rows.map(seasonFromRow)).toContainEqual(SEASON_ONE);
  });

  it('season_on in SQL and pickSeason in the domain choose the same season on the same dates', async () => {
    await c.query(`insert into public.seasons (id, starts_on, arc_days, locks_on, finale_on) values ('S00', '2026-09-08', 14, '2026-09-10', '2026-09-22')`);
    const rows = (await c.query(`select id, starts_on::text, arc_days, locks_on::text, finale_on::text from public.seasons`)).rows as SeasonRow[];
    const seasons = rows.map(seasonFromRow);
    for (const date of ['2026-08-15', '2026-09-12', '2026-09-25', '2026-11-01']) {
      const sql = (await c.query(`select (public.season_on($1::date)).id as id`, [date])).rows[0].id;
      expect({ date, sql }).toEqual({ date, sql: pickSeason(seasons, date)?.id ?? null });
    }
  });
});
