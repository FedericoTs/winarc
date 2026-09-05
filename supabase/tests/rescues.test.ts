import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { CONTRACT, MARCO, SQUAD, YOU, asAdmin, asUser, close, expectError, newUser, open } from './helpers';

let c: pg.Client;
beforeEach(async () => {
  c = await open();
  await asAdmin(c);
});
afterEach(async () => close(c));

async function gymLine(): Promise<string> {
  const { rows } = await c.query(`select id from public.contract_lines where contract_id = $1 and key = 'GYM'`, [CONTRACT]);
  return rows[0].id;
}

/** A third member of the seed squad, so two vouchers exist. */
async function thirdMember(): Promise<string> {
  const id = await newUser(c, 'Giulia');
  await asAdmin(c);
  await c.query(`insert into public.squad_members (squad_id, profile_id, season_id) values ($1, $2, 'S01')`, [SQUAD, id]);
  return id;
}

async function pendingProof(line: string, date: string, mark: 'P' | 'X' = 'P'): Promise<string> {
  await asAdmin(c);
  await c.query(
    `insert into public.day_marks (contract_line_id, profile_id, squad_id, local_date, day, week, mark) values ($1, $2, $3, $4, 1, 1, $5)`,
    [line, YOU, SQUAD, date, mark],
  );
  const { rows } = await c.query(
    `insert into public.proofs (contract_line_id, profile_id, squad_id, local_date, day, status) values ($1, $2, $3, $4, 1, 'pending') returning id`,
    [line, YOU, SQUAD, date],
  );
  return rows[0].id;
}

describe('sick days', () => {
  it('turns today into a rest day once per fortnight and only when something is due', async () => {
    const line = await gymLine();
    await asUser(c, YOU);
    expect(await expectError(c, `select * from public.use_sick_day()`)).toMatch(/nothing due today/);

    await asAdmin(c);
    await c.query(
      `insert into public.day_marks (contract_line_id, profile_id, squad_id, local_date, day, week, mark)
       values ($1, $2, $3, public.local_date_for($2), 1, 1, 'P')`,
      [line, YOU, SQUAD],
    );
    await asUser(c, YOU);
    const { rows } = await c.query(`select * from public.use_sick_day()`);
    expect(rows[0].marks).toBe(1);
    const mark = await c.query(`select mark from public.day_marks where contract_line_id = $1 and profile_id = $2`, [line, YOU]);
    expect(mark.rows[0].mark).toBe('S');
    expect((await c.query(`select kind from public.rescues where profile_id = $1`, [YOU])).rows[0].kind).toBe('sick');

    await asAdmin(c);
    await c.query(`update public.day_marks set mark = 'P' where contract_line_id = $1 and profile_id = $2`, [line, YOU]);
    await asUser(c, YOU);
    expect(await expectError(c, `select * from public.use_sick_day()`)).toMatch(/no sick days left/);
  });
});

describe('vouching', () => {
  it('allows one request a week and stamps Bronze after two squadmates confirm', async () => {
    const line = await gymLine();
    const third = await thirdMember();
    const proof = await pendingProof(line, '2026-10-01');

    await asUser(c, YOU);
    await c.query(`select public.request_vouch($1)`, [proof]);
    expect((await c.query(`select status from public.proofs where id = $1`, [proof])).rows[0].status).toBe('ask');
    expect(await expectError(c, `select public.request_vouch($1)`, [proof])).toMatch(/no vouches left this week/);

    await asUser(c, MARCO);
    await c.query(`insert into public.vouches (proof_id, voucher_id) values ($1, $2)`, [proof, MARCO]);
    await asAdmin(c);
    expect((await c.query(`select status, tier from public.proofs where id = $1`, [proof])).rows[0]).toEqual({ status: 'ask', tier: null });

    await asUser(c, third);
    await c.query(`insert into public.vouches (proof_id, voucher_id) values ($1, $2)`, [proof, third]);
    await asAdmin(c);
    expect((await c.query(`select status, tier from public.proofs where id = $1`, [proof])).rows[0]).toEqual({ status: 'vouched', tier: 'BRONZE' });
    expect((await c.query(`select mark, proof_id from public.day_marks where contract_line_id = $1 and local_date = '2026-10-01'`, [line])).rows[0]).toEqual({ mark: 'B', proof_id: proof });
    expect((await c.query(`select resolved_at from public.rescues where proof_id = $1`, [proof])).rows[0].resolved_at).not.toBeNull();
  });

  it('refuses vouches on stamped proofs and requests on other people\'s proofs', async () => {
    const line = await gymLine();
    const proof = await pendingProof(line, '2026-10-02');
    await c.query(`update public.proofs set status = 'verified', tier = 'GOLD' where id = $1`, [proof]);
    await asUser(c, MARCO);
    expect(await expectError(c, `insert into public.vouches (proof_id, voucher_id) values ($1, $2)`, [proof, MARCO])).toMatch(/row-level security/);
    expect(await expectError(c, `select public.request_vouch($1)`, [proof])).toMatch(/not your proof/);
  });

  it('reverses a miss that already went to the ledger', async () => {
    const line = await gymLine();
    const third = await thirdMember();
    const proof = await pendingProof(line, '2026-10-05', 'X');
    const round = (await c.query(`insert into public.rounds (squad_id, week, pot_added_cents) values ($1, 2, 1000) returning id`, [SQUAD])).rows[0].id;
    await c.query(
      `insert into public.ledger_entries (squad_id, round_id, profile_id, amount_cents, reason, local_date, contract_line_id) values ($1, $2, $3, 1000, 'miss', '2026-10-05', $4)`,
      [SQUAD, round, YOU, line],
    );
    await asUser(c, MARCO);
    await c.query(`insert into public.vouches (proof_id, voucher_id) values ($1, $2)`, [proof, MARCO]);
    await asUser(c, third);
    await c.query(`insert into public.vouches (proof_id, voucher_id) values ($1, $2)`, [proof, third]);
    await asAdmin(c);
    const net = (await c.query(`select coalesce(sum(amount_cents), 0)::int as cents from public.ledger_entries where profile_id = $1`, [YOU])).rows[0].cents;
    expect(net).toBe(0);
    expect((await c.query(`select mark from public.day_marks where contract_line_id = $1 and local_date = '2026-10-05'`, [line])).rows[0].mark).toBe('B');
  });
});

describe('squad reads of proof images', () => {
  it('lets squadmates read each other\'s proof files and nobody else', async () => {
    await c.query(`insert into storage.objects (bucket_id, name, owner) values ('proofs', $1, $2)`, [`${YOU}/2026-10-01/gym-rear.jpg`, YOU]);
    const stranger = await newUser(c, 'Stranger');
    await asUser(c, MARCO);
    expect((await c.query(`select name from storage.objects where bucket_id = 'proofs'`)).rowCount).toBe(1);
    await asUser(c, YOU);
    expect((await c.query(`select name from storage.objects where bucket_id = 'proofs'`)).rowCount).toBe(1);
    await asUser(c, stranger);
    expect((await c.query(`select name from storage.objects where bucket_id = 'proofs'`)).rowCount).toBe(0);
  });
});
