import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { CONTRACT, MARCO, SQUAD, YOU, asAdmin, asUser, close, open } from './helpers';

let c: pg.Client;
beforeEach(async () => {
  c = await open();
  await asAdmin(c);
});
afterEach(async () => close(c));

describe('the 20:00 nudge', () => {
  it('selects members with an open mark at 20:xx local time, once per token, and nobody else', async () => {
    const line = (await c.query(`select id from public.contract_lines where contract_id = $1 and key = 'GYM'`, [CONTRACT])).rows[0].id;
    // 20:30 in Rome on 12 Oct 2026 is 18:30 UTC.
    const at = '2026-10-12T18:30:00Z';
    await c.query(`update public.profiles set tz = 'Europe/Rome' where id in ($1, $2)`, [YOU, MARCO]);
    await c.query(
      `insert into public.day_marks (contract_line_id, profile_id, squad_id, local_date, day, week, mark) values ($1, $2, $3, '2026-10-12', 12, 3, 'P')`,
      [line, YOU, SQUAD],
    );
    await c.query(`insert into public.push_tokens (profile_id, token, platform) values ($1, 'ExponentPushToken[you]', 'ios')`, [YOU]);
    await c.query(`insert into public.push_tokens (profile_id, token, platform) values ($1, 'ExponentPushToken[marco]', 'ios')`, [MARCO]);

    const due = (await c.query(`select * from public.due_for_nudge($1::timestamptz)`, [at])).rows;
    expect(due).toHaveLength(1);
    expect(due[0]).toMatchObject({ profile_id: YOU, token: 'ExponentPushToken[you]', lines: ['Gym sessions'] });

    // Not at 21:xx, and not once the proof is stamped.
    expect((await c.query(`select * from public.due_for_nudge('2026-10-12T19:30:00Z'::timestamptz)`)).rows).toHaveLength(0);
    await c.query(`update public.day_marks set mark = 'V' where contract_line_id = $1 and local_date = '2026-10-12'`, [line]);
    expect((await c.query(`select * from public.due_for_nudge($1::timestamptz)`, [at])).rows).toHaveLength(0);
  });

  it('keeps push tokens to their owner and runs the sender without pg_net', async () => {
    await asUser(c, YOU);
    await c.query(`insert into public.push_tokens (profile_id, token, platform) values ($1, 'ExponentPushToken[a]', 'ios')`, [YOU]);
    await asUser(c, MARCO);
    expect((await c.query(`select token from public.push_tokens`)).rowCount).toBe(0);
    await asAdmin(c);
    const { rows } = await c.query(`select * from public.nudge_due()`);
    expect(rows[0].sent).toBeGreaterThanOrEqual(0);
  });
});
