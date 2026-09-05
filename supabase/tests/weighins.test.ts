import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { MARCO, YOU, asAdmin, asAnon, asUser, close, expectError, open } from './helpers';

let c: pg.Client;
beforeEach(async () => {
  c = await open();
  await asAdmin(c);
});
afterEach(async () => close(c));

describe('the weekly weigh-in', () => {
  it('upserts one reading per local day and reports the change since the first reading', async () => {
    // A reading from a week ago, so today's is not the first.
    await asAdmin(c);
    await c.query(`insert into public.weigh_ins (profile_id, local_date, kg, source) values ($1, public.local_date_for($1) - 7, 84.0, 'manual')`, [YOU]);

    await asUser(c, YOU);
    const first = (await c.query(`select * from public.log_weigh_in(82.46, 'healthkit')`)).rows[0];
    expect(Number(first.weight_kg)).toBe(82.46);
    expect(Number(first.first_kg)).toBe(84);
    expect(Number(first.delta_kg)).toBeCloseTo(-1.54, 2);
    expect(first.readings).toBe(2);

    // Weighing twice on the same day replaces the reading; it never adds a row.
    const again = (await c.query(`select * from public.log_weigh_in(82.1, 'manual')`)).rows[0];
    expect(again.readings).toBe(2);
    const { rows } = await c.query(`select kg, source from public.weigh_ins where profile_id = $1 and local_date = public.local_date_for($1)`, [YOU]);
    expect(rows).toEqual([{ kg: '82.10', source: 'manual' }]);
  });

  it('stays private to its owner and refuses impossible numbers', async () => {
    await asUser(c, YOU);
    await c.query(`select * from public.log_weigh_in(80, 'manual')`);
    expect(await expectError(c, `select * from public.log_weigh_in(10, 'manual')`)).toMatch(/weigh_ins_kg_check/);

    // A squadmate sees no rows, not even a count, and cannot write into someone else's readings.
    await asUser(c, MARCO);
    expect((await c.query(`select count(*)::int as n from public.weigh_ins`)).rows[0].n).toBe(0);
    expect(await expectError(c, `insert into public.weigh_ins (profile_id, local_date, kg, source) values ($1, '2026-10-11', 70, 'manual')`, [YOU])).toMatch(/row-level security/);

    await asAnon(c);
    expect(await expectError(c, `select * from public.log_weigh_in(80, 'manual')`)).toMatch(/permission denied/);
  });
});
