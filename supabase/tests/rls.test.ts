import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { CONTRACT, MARCO, SQUAD, YOU, asAdmin, asUser, close, expectError, newUser, open } from './helpers';

let c: pg.Client;
beforeEach(async () => {
  c = await open();
});
afterEach(async () => close(c));

async function gymLine(): Promise<string> {
  await asAdmin(c);
  const { rows } = await c.query(`select id from public.contract_lines where contract_id = $1 and key = 'GYM'`, [CONTRACT]);
  return rows[0].id;
}

describe('row-level security', () => {
  it('shows a squad only to its members', async () => {
    await asUser(c, YOU);
    expect((await c.query(`select id from public.squads`)).rowCount).toBe(1);
    expect((await c.query(`select profile_id from public.squad_members`)).rowCount).toBe(2);
    const stranger = await newUser(c, 'Stranger');
    await asUser(c, stranger);
    expect((await c.query(`select id from public.squads`)).rowCount).toBe(0);
    expect((await c.query(`select id from public.contracts`)).rowCount).toBe(0);
  });

  it('lets a member capture only their own proof', async () => {
    const line = await gymLine();
    await asUser(c, YOU);
    await c.query(
      `insert into public.proofs (contract_line_id, profile_id, squad_id, local_date, day) values ($1, $2, $3, '2026-10-01', 1)`,
      [line, YOU, SQUAD],
    );
    await asUser(c, MARCO);
    expect(
      await expectError(c, `insert into public.proofs (contract_line_id, profile_id, squad_id, local_date, day) values ($1, $2, $3, '2026-10-02', 2)`, [line, YOU, SQUAD]),
    ).toMatch(/row-level security/);
    expect((await c.query(`select id from public.proofs`)).rowCount).toBe(1);
  });

  it('lets squadmates vouch, never the member for themselves', async () => {
    const line = await gymLine();
    await asUser(c, YOU);
    const proof = (
      await c.query(
        `insert into public.proofs (contract_line_id, profile_id, squad_id, local_date, day) values ($1, $2, $3, '2026-10-01', 1) returning id`,
        [line, YOU, SQUAD],
      )
    ).rows[0].id;
    expect(await expectError(c, `insert into public.vouches (proof_id, voucher_id) values ($1, $2)`, [proof, YOU])).toMatch(/row-level security/);
    await asUser(c, MARCO);
    await c.query(`insert into public.vouches (proof_id, voucher_id) values ($1, $2)`, [proof, MARCO]);
    expect((await c.query(`select voucher_id from public.vouches`)).rowCount).toBe(1);
  });

  it('keeps verifications off the member API and votes to their owner', async () => {
    await asAdmin(c);
    const line = await gymLine();
    const proof = (
      await c.query(
        `insert into public.proofs (contract_line_id, profile_id, squad_id, local_date, day) values ($1, $2, $3, '2026-10-01', 1) returning id`,
        [line, YOU, SQUAD],
      )
    ).rows[0].id;
    await c.query(
      `insert into public.verifications (proof_id, model, rubric_version, result, decision) values ($1, 'claude-opus-5', 'test', '{}', '{}')`,
      [proof],
    );
    await asUser(c, YOU);
    expect((await c.query(`select id from public.verifications`)).rowCount).toBe(0);
    await c.query(`insert into public.pot_votes (squad_id, profile_id, option) values ($1, $2, 'Finale dinner')`, [SQUAD, YOU]);
    await asUser(c, MARCO);
    await expect(c.query(`update public.pot_votes set option = 'Gear' where profile_id = $1`, [YOU])).resolves.toMatchObject({ rowCount: 0 });
  });

  it('only lets members read the seasons and profiles they need', async () => {
    await asUser(c, YOU);
    expect((await c.query(`select id from public.seasons`)).rowCount).toBe(1);
    await expect(c.query(`update public.profiles set display_name = 'x' where id = $1`, [MARCO])).resolves.toMatchObject({ rowCount: 0 });
    await c.query(`update public.profiles set display_name = 'Federico' where id = $1`, [YOU]);
    expect((await c.query(`select display_name from public.profiles where id = $1`, [YOU])).rows[0].display_name).toBe('Federico');
  });
});
