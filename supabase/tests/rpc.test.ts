import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { asAdmin, asAnon, asUser, close, expectError, newUser, open } from './helpers';

let c: pg.Client;
beforeEach(async () => {
  c = await open();
});
afterEach(async () => close(c));

describe('squad RPCs', () => {
  it('founds a squad with terms and a readable code, once per season', async () => {
    const founder = await newUser(c, 'Lena');
    await asUser(c, founder);
    const { rows } = await c.query(`select * from public.create_squad('Ghiaccio', 4, 2500)`);
    expect(rows[0].code).toMatch(/^WIN-[A-HJ-NP-Z2-9]{4}$/);
    expect(rows[0]).toMatchObject({ size: 4, stake_cents: 2500, pot_rule: 'pot', currency: 'EUR' });
    const member = await c.query(`select role from public.squad_members where squad_id = $1 and profile_id = $2`, [rows[0].id, founder]);
    expect(member.rows[0].role).toBe('founder');
    expect(await expectError(c, `select * from public.create_squad('Again', 4, 1000)`)).toMatch(/already in a squad/);
  });

  it('refuses pot rules that are not live this season', async () => {
    const founder = await newUser(c, 'Tom');
    await asUser(c, founder);
    expect(await expectError(c, `select * from public.create_squad('Charity', 4, 1000, 'charity')`)).toMatch(/not live/);
  });

  it('previews a squad by code without membership and shows spots left', async () => {
    await asAnon(c);
    const { rows } = await c.query(`select * from public.squad_preview('win-7k2q')`);
    expect(rows[0]).toMatchObject({ name: 'The Cold Starters', size: 5, member_count: 2, spots_left: 3, stake_cents: 1000, locked: false });
  });

  it('joins by code, inherits terms, and refuses a full or locked squad', async () => {
    const founder = await newUser(c, 'Nour');
    await asUser(c, founder);
    const squad = (await c.query(`select * from public.create_squad('Pact', 2, 500)`)).rows[0];

    const joiner = await newUser(c, 'Sam');
    await asUser(c, joiner);
    const joined = (await c.query(`select * from public.join_squad($1)`, [squad.code.toLowerCase()])).rows[0];
    expect(joined.stake_cents).toBe(500);

    const third = await newUser(c, 'Ayse');
    await asUser(c, third);
    expect(await expectError(c, `select * from public.join_squad($1)`, [squad.code])).toMatch(/full/);

    await asAdmin(c);
    await c.query(`update public.seasons set locks_on = current_date - 1 where id = 'S01'`);
    const late = await newUser(c, 'Late');
    await asUser(c, late);
    expect(await expectError(c, `select * from public.join_squad('WIN-7K2Q')`)).toMatch(/locked/);
  });

  it('rejects unknown codes and unsigned callers', async () => {
    const u = await newUser(c, 'Kai');
    await asUser(c, u);
    expect(await expectError(c, `select * from public.join_squad('WIN-ZZZZ')`)).toMatch(/no squad/);
    await asAnon(c);
    expect(await expectError(c, `select * from public.create_squad('Anon', 3, 1000)`)).toMatch(/not signed in/);
  });
});
