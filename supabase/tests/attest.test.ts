import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { CONTRACT, MARCO, SQUAD, YOU, asAdmin, asUser, close, expectError, open } from './helpers';

let c: pg.Client;
beforeEach(async () => {
  c = await open();
  await asAdmin(c);
});
afterEach(async () => close(c));

async function lineId(key: string): Promise<string> {
  const { rows } = await c.query(`select id from public.contract_lines where contract_id = $1 and key = $2`, [CONTRACT, key]);
  return rows[0].id;
}

async function openToday(line: string): Promise<void> {
  await asAdmin(c);
  await c.query(
    `insert into public.day_marks (contract_line_id, profile_id, squad_id, local_date, day, week, mark)
     values ($1, $2, $3, public.local_date_for($2), 1, 1, 'P')`,
    [line, YOU, SQUAD],
  );
}

describe('squad-witnessed lines', () => {
  it('stamps a photo line Bronze from one photo in the member\'s own folder, once', async () => {
    const read = await lineId('read');
    await openToday(read);
    await asUser(c, YOU);
    expect(await expectError(c, `select * from public.attest_today($1)`, [read])).toMatch(/needs a photo/);
    expect(await expectError(c, `select * from public.attest_today($1, $2)`, [read, `${MARCO}/2026-10-05/x.jpg`])).toMatch(/own folder/);

    const { rows } = await c.query(`select * from public.attest_today($1, $2)`, [read, `${YOU}/2026-10-05/${read}-rear.jpg`]);
    expect(rows[0].day_mark).toBe('B');
    const proof = (await c.query(`select status, tier, rear_path from public.proofs where id = $1`, [rows[0].attested_proof])).rows[0];
    expect(proof).toEqual({ status: 'attested', tier: 'BRONZE', rear_path: `${YOU}/2026-10-05/${read}-rear.jpg` });
    const mark = (await c.query(`select mark, proof_id from public.day_marks where contract_line_id = $1`, [read])).rows[0];
    expect(mark).toEqual({ mark: 'B', proof_id: rows[0].attested_proof });

    // Stamped days stay stamped; a second attestation has nothing to do.
    expect(await expectError(c, `select * from public.attest_today($1, $2)`, [read, `${YOU}/2026-10-05/again.jpg`])).toMatch(/nothing due today/);
  });

  it('takes a member\'s word on an attest line, and keeps sport lines on the dual-cam ritual', async () => {
    await asAdmin(c);
    const { rows } = await c.query(
      `insert into public.contract_lines (contract_id, key, kind, name, per_week, days, verification, staked, position)
       values ($1, 'alcohol', 'mind', 'No alcohol', 7, '{0,1,2,3,4,5,6}', 'attest', true, 3) returning id`,
      [CONTRACT],
    );
    const alcohol = rows[0].id;
    const gym = await lineId('GYM');
    await openToday(alcohol);
    await openToday(gym);

    await asUser(c, YOU);
    expect((await c.query(`select * from public.attest_today($1)`, [alcohol])).rows[0].day_mark).toBe('B');
    expect((await c.query(`select rear_path from public.proofs where contract_line_id = $1`, [alcohol])).rows[0].rear_path).toBeNull();
    expect(await expectError(c, `select * from public.attest_today($1)`, [gym])).toMatch(/dual-cam/);

    await asUser(c, MARCO);
    expect(await expectError(c, `select * from public.attest_today($1)`, [alcohol])).toMatch(/not your line/);
  });
});

describe('squad-witnessed lines at settlement', () => {
  it('counts an attested day as a hit, so nothing goes to the pot', async () => {
    const { rows } = await c.query(`select id from public.contract_lines where contract_id = $1 and key = 'read'`, [CONTRACT]);
    const read = rows[0].id;
    await openToday(read);
    await asUser(c, YOU);
    await c.query(`select * from public.attest_today($1, $2)`, [read, `${YOU}/today/${read}-rear.jpg`]);

    await asAdmin(c);
    const round = (await c.query(`select public.settle_squad_week($1, 1, public.local_date_for($2)) as id`, [SQUAD, YOU])).rows[0].id;
    const r = (await c.query(`select pot_added_cents, hit_rate::float as hit_rate, mvp_profile_id from public.rounds where id = $1`, [round])).rows[0];
    expect(r).toEqual({ pot_added_cents: 0, hit_rate: 1, mvp_profile_id: YOU });
    expect((await c.query(`select count(*)::int as n from public.ledger_entries where squad_id = $1`, [SQUAD])).rows[0].n).toBe(0);
  });
});
