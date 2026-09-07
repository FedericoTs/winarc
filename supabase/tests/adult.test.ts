import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { SQUAD, asAdmin, asUser, close, expectError, newUser, open } from './helpers';

let c: pg.Client;
beforeEach(async () => {
  c = await open();
  await asAdmin(c);
});
afterEach(async () => close(c));

describe('under-18s cannot set weight tracking', () => {
  it('refuses the weigh-in on the contract and at the reading until the profile carries an adult confirmation', async () => {
    const nadia = await newUser(c, 'Nadia');
    await c.query(`insert into public.squad_members (squad_id, profile_id, season_id, role) values ($1, $2, 'S01', 'member')`, [SQUAD, nadia]);

    expect(
      await expectError(c, `insert into public.contracts (profile_id, squad_id, season_id, weigh_in, signed_at) values ($1, $2, 'S01', true, now())`, [nadia, SQUAD]),
    ).toMatch(/adult confirmation/);
    // A contract without the weigh-in is fine at any age.
    await c.query(`insert into public.contracts (profile_id, squad_id, season_id, weigh_in, signed_at) values ($1, $2, 'S01', false, now())`, [nadia, SQUAD]);

    await asUser(c, nadia);
    expect(await expectError(c, `select * from public.log_weigh_in(80, 'manual')`)).toMatch(/adult confirmation/);
    expect(await expectError(c, `update public.contracts set weigh_in = true where profile_id = $1`, [nadia])).toMatch(/adult confirmation/);

    // The member confirms once, on their own row, and both doors open.
    await c.query(`update public.profiles set adult_confirmed_at = now() where id = $1`, [nadia]);
    expect((await c.query(`select * from public.log_weigh_in(80, 'manual')`)).rows[0].readings).toBe(1);
    await c.query(`update public.contracts set weigh_in = true where profile_id = $1`, [nadia]);
    expect((await c.query(`select weigh_in from public.contracts where profile_id = $1`, [nadia])).rows[0].weigh_in).toBe(true);
  });
});
