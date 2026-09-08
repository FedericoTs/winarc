import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { CONTRACT, MARCO, SQUAD, YOU, asAdmin, asUser, close, open } from './helpers';

let c: pg.Client;
beforeEach(async () => {
  c = await open();
  await asAdmin(c);
});
afterEach(async () => close(c));

const MARCO_CONTRACT = '20000000-0000-0000-0000-000000000002';
const RUN = '40000000-0000-0000-0000-000000000001';

/** Marco gets a contract with one line, so both members can have marks on the same day. */
async function marcoRuns(): Promise<void> {
  await c.query(
    `insert into public.contracts (id, profile_id, squad_id, season_id, weigh_in, signed_at) values ($1, $2, $3, 'S01', false, now())`,
    [MARCO_CONTRACT, MARCO, SQUAD],
  );
  await c.query(
    `insert into public.contract_lines (id, contract_id, key, kind, name, per_week, days, verification, staked) values ($1, $2, 'RUN', 'sport', 'Runs', 3, '{1,3,5}', 'health_photo', true)`,
    [RUN, MARCO_CONTRACT],
  );
}

async function gymLine(): Promise<string> {
  return (await c.query(`select id from public.contract_lines where contract_id = $1 and key = 'GYM'`, [CONTRACT])).rows[0].id;
}

async function mark(line: string, profile: string, date: string, mark: string, week = 3): Promise<void> {
  await c.query(
    `insert into public.day_marks (contract_line_id, profile_id, squad_id, local_date, day, week, mark) values ($1, $2, $3, $4, 0, $5, $6)`,
    [line, profile, SQUAD, date, week, mark],
  );
}

/** Today on the members' clock, since the trigger only pings for the day the prover is in. */
async function romeToday(): Promise<string> {
  return (await c.query(`select to_char((now() at time zone 'Europe/Rome')::date, 'YYYY-MM-DD') as d`)).rows[0].d;
}

async function signals(kind: string): Promise<Array<{ recipient_id: string; title: string; body: string; route: string; sent_at: string | null; dropped_at: string | null }>> {
  return (await c.query(`select recipient_id, title, body, route, sent_at, dropped_at from public.signals where kind = $1 order by recipient_id`, [kind])).rows;
}

describe('the nudge with the squad in it', () => {
  it('writes the copy from the count', async () => {
    const body = async (lines: string[], proved: number, due: number) =>
      (await c.query(`select public.nudge_body($1::text[], $2, $3) as b`, [lines, proved, due])).rows[0].b;
    expect(await body(['Gym sessions'], 3, 4)).toBe('Gym sessions. 3 of 4 proved. You are the one missing.');
    expect(await body(['Gym sessions', 'Read 20 pages'], 1, 4)).toBe('Gym sessions, Read 20 pages. 1 of 4 proved. The squad can see the board.');
    expect(await body(['Gym sessions'], 0, 1)).toBe('Gym sessions. Your squad can see the board.');
  });

  it('counts squadmates with something due and those who are done', async () => {
    await marcoRuns();
    const gym = await gymLine();
    await mark(gym, YOU, '2026-10-12', 'P');
    await mark(RUN, MARCO, '2026-10-12', 'V');
    await c.query(`insert into public.push_tokens (profile_id, token, platform) values ($1, 'ExponentPushToken[you]', 'ios')`, [YOU]);
    const due = (await c.query(`select * from public.due_for_nudge('2026-10-12T18:30:00Z'::timestamptz)`)).rows;
    expect(due).toHaveLength(1);
    expect(due[0]).toMatchObject({ profile_id: YOU, lines: ['Gym sessions'], proved: 1, due: 2 });
    expect((await c.query(`select public.nudge_body($1::text[], $2, $3) as b`, [due[0].lines, due[0].proved, due[0].due])).rows[0].b).toBe(
      'Gym sessions. 1 of 2 proved. You are the one missing.',
    );
  });
});

describe('the first proof of the day', () => {
  it('pings the squadmates still open, once, and nobody who has proved or opted out', async () => {
    await marcoRuns();
    const gym = await gymLine();
    const today = await romeToday();
    await mark(gym, YOU, today, 'P');
    await mark(RUN, MARCO, today, 'P');

    // Marco stamps first: You are still open, so You get the ping.
    await c.query(`update public.day_marks set mark = 'V' where contract_line_id = $1 and local_date = $2`, [RUN, today]);
    let rows = await signals('first_proof');
    expect(rows).toHaveLength(1);
    expect(rows[0].recipient_id).toBe(YOU);
    expect(rows[0].title).toBe('Marco went first');
    expect(rows[0].body).toMatch(/^Runs at \d\d:\d\d\. Yours is still open\.$/);
    expect(rows[0].route).toBe('/(tabs)/today');

    // You stamp second: nobody is open any more, and second is not first.
    await c.query(`update public.day_marks set mark = 'V' where contract_line_id = $1 and local_date = $2`, [gym, today]);
    rows = await signals('first_proof');
    expect(rows).toHaveLength(1);
  });

  it('respects the opt-out and ignores stamps on a day that is not today', async () => {
    await marcoRuns();
    const gym = await gymLine();
    const today = await romeToday();
    await c.query(`update public.profiles set squad_pings = false where id = $1`, [YOU]);
    await mark(gym, YOU, today, 'P');
    await mark(RUN, MARCO, today, 'P');
    await c.query(`update public.day_marks set mark = 'V' where contract_line_id = $1 and local_date = $2`, [RUN, today]);
    expect(await signals('first_proof')).toHaveLength(0);

    // A vouch that lands on a closed day flips the mark but pings nobody.
    await c.query(`update public.profiles set squad_pings = true where id = $1`, [YOU]);
    await mark(gym, YOU, '2026-10-05', 'P', 2);
    await mark(RUN, MARCO, '2026-10-05', 'X', 2);
    await c.query(`update public.day_marks set mark = 'B' where contract_line_id = $1 and local_date = '2026-10-05'`, [RUN]);
    expect(await signals('first_proof')).toHaveLength(0);
  });

  it('members can flip their own switch and nobody else\'s', async () => {
    await asUser(c, YOU);
    await c.query(`update public.profiles set squad_pings = false where id = $1`, [YOU]);
    await c.query(`update public.profiles set squad_pings = false where id = $1`, [MARCO]);
    await asAdmin(c);
    const { rows } = await c.query(`select id, squad_pings from public.profiles where id in ($1, $2) order by id`, [YOU, MARCO]);
    expect(rows).toEqual([
      { id: YOU, squad_pings: false },
      { id: MARCO, squad_pings: true },
    ]);
  });
});

describe('delivery', () => {
  async function queue(createdAt = 'now()'): Promise<void> {
    await c.query(
      `insert into public.signals (kind, squad_id, local_date, recipient_id, title, body, created_at)
       values ('first_proof', $1, (now() at time zone 'Europe/Rome')::date, $2, 'Marco went first', 'Runs at 06:48. Yours is still open.', ${createdAt})`,
      [SQUAD, YOU],
    );
  }

  it('holds during quiet hours and sends from 07:00 local', async () => {
    const gym = await gymLine();
    await mark(gym, YOU, await romeToday(), 'P');
    // Queued at 04:00 in Rome on 12 Oct 2026, which is 02:00 UTC; the clock below is that morning.
    await queue(`'2026-10-12T02:00:00Z'::timestamptz`);
    let r = (await c.query(`select * from public.deliver_signals('2026-10-12T02:30:00Z'::timestamptz)`)).rows[0];
    expect(r).toMatchObject({ sent: 0, held: 1, dropped: 0 });
    expect((await signals('first_proof'))[0].sent_at).toBeNull();
    r = (await c.query(`select * from public.deliver_signals('2026-10-12T06:30:00Z'::timestamptz)`)).rows[0];
    expect(r).toMatchObject({ sent: 1, held: 0, dropped: 0 });
    expect((await signals('first_proof'))[0].sent_at).not.toBeNull();
    // Delivered once.
    r = (await c.query(`select * from public.deliver_signals('2026-10-12T07:30:00Z'::timestamptz)`)).rows[0];
    expect(r).toMatchObject({ sent: 0, held: 0, dropped: 0 });
  });

  it('drops a first-proof ping once the recipient has proved, and anything older than a day', async () => {
    const gym = await gymLine();
    await mark(gym, YOU, await romeToday(), 'V');
    await queue(`'2026-10-12T09:00:00Z'::timestamptz`);
    let r = (await c.query(`select * from public.deliver_signals('2026-10-12T10:00:00Z'::timestamptz)`)).rows[0];
    expect(r).toMatchObject({ sent: 0, held: 0, dropped: 1 });
    expect((await signals('first_proof'))[0].dropped_at).not.toBeNull();

    await c.query(`delete from public.signals`);
    await c.query(`update public.day_marks set mark = 'P' where contract_line_id = $1`, [gym]);
    await queue(`now() - interval '2 days'`);
    r = (await c.query(`select * from public.deliver_signals(now())`)).rows[0];
    expect(r).toMatchObject({ sent: 0, held: 0, dropped: 1 });
  });
});

describe('settlement reaches the phone', () => {
  it('writes the copy from the week', async () => {
    const body = async (args: unknown[]) =>
      (await c.query(`select public.settlement_body($1, $2, $3, $4, $5, $6, $7, $8) as b`, args)).rows[0].b;
    expect(await body([5, 2, 2000, 3000, 'EUR', 'Marco', 0, 1000])).toBe('5 of 7 proofs landed. 2 misses fed the pot, now €30. You were clean. Marco was MVP.');
    expect(await body([6, 1, 1000, 1000, 'EUR', null, 1, 1000])).toBe('6 of 7 proofs landed. 1 miss fed the pot, now €10. You missed 1, €10.');
    expect(await body([7, 0, 0, 2500, 'USD', 'You', 0, 500])).toBe('7 of 7 proofs landed. Nobody missed, the pot stays at $25. You were clean. You was MVP.');
    expect((await c.query(`select public.money(1250, 'EUR') as m`)).rows[0].m).toBe('€12.50');
  });

  it('queues one settlement per member with their own line in it', async () => {
    await marcoRuns();
    const gym = await gymLine();
    for (const [d, m] of [['2026-10-05', 'V'], ['2026-10-06', 'V'], ['2026-10-08', 'X'], ['2026-10-10', 'V']] as const) await mark(gym, YOU, d, m, 2);
    for (const [d, m] of [['2026-10-05', 'V'], ['2026-10-07', 'X'], ['2026-10-11', 'P']] as const) await mark(RUN, MARCO, d, m, 2);

    const round = (await c.query(`select public.settle_squad_week($1, 2, '2026-10-11') as id`, [SQUAD])).rows[0].id;
    expect(round).toBeTruthy();
    const rows = await signals('settlement');
    expect(rows.map((r) => r.recipient_id)).toEqual([YOU, MARCO]);
    expect(rows[0].title).toBe('Week 2 settled');
    expect(rows[0].route).toBe('/(tabs)/ledger');
    // Marco's open Sunday closed as a miss at settlement: 4 hits, 3 misses, 30 euro into the pot, nobody flawless.
    expect(rows[0].body).toBe('4 of 7 proofs landed. 3 misses fed the pot, now €30. You missed 1, €10.');
    expect(rows[1].body).toBe('4 of 7 proofs landed. 3 misses fed the pot, now €30. You missed 2, €20.');

    // Settling the same week again is a no-op, and so is the queue.
    expect((await c.query(`select public.settle_squad_week($1, 2, '2026-10-11') as id`, [SQUAD])).rows[0].id).toBeNull();
    expect(await signals('settlement')).toHaveLength(2);
  });
});
