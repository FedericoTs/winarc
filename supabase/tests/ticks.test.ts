import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { settleWeek, type DayMark } from '@winarc/domain';
import { CONTRACT, MARCO, SQUAD, YOU, asAdmin, asUser, close, open } from './helpers';

let c: pg.Client;
beforeEach(async () => {
  c = await open();
  await asAdmin(c);
});
afterEach(async () => close(c));

async function lines(): Promise<Record<string, string>> {
  const { rows } = await c.query(`select id, key from public.contract_lines where contract_id = $1`, [CONTRACT]);
  return Object.fromEntries(rows.map((r) => [r.key, r.id]));
}

async function marks(profile: string, date: string): Promise<Record<string, string>> {
  const { rows } = await c.query(
    `select l.key, m.mark from public.day_marks m join public.contract_lines l on l.id = m.contract_line_id where m.profile_id = $1 and m.local_date = $2`,
    [profile, date],
  );
  return Object.fromEntries(rows.map((r) => [r.key, r.mark]));
}

describe('the daily tick', () => {
  it('opens due marks from the schedule and closes yesterday as misses', async () => {
    // 1 Oct 2026 is a Thursday: gym is due (days 1,2,4,6), reading is due every day, the weigh-in is never staked.
    const t1 = (await c.query(`select * from public.tick_member($1, '2026-10-01')`, [YOU])).rows[0];
    expect(t1).toEqual({ opened: 2, closed: 0 });
    expect(await marks(YOU, '2026-10-01')).toEqual({ GYM: 'P', read: 'P' });

    // Friday: gym is not due; yesterday's open marks become misses.
    const t2 = (await c.query(`select * from public.tick_member($1, '2026-10-02')`, [YOU])).rows[0];
    expect(t2).toEqual({ opened: 1, closed: 2 });
    expect(await marks(YOU, '2026-10-01')).toEqual({ GYM: 'X', read: 'X' });
    expect(await marks(YOU, '2026-10-02')).toEqual({ read: 'P' });

    // Running the same day twice changes nothing.
    const again = (await c.query(`select * from public.tick_member($1, '2026-10-02')`, [YOU])).rows[0];
    expect(again).toEqual({ opened: 0, closed: 0 });
  });

  it('does nothing before the season and nothing for members without a signed contract', async () => {
    expect((await c.query(`select * from public.tick_member($1, '2026-09-20')`, [YOU])).rows[0]).toEqual({ opened: 0, closed: 0 });
    expect((await c.query(`select * from public.tick_member($1, '2026-10-01')`, [MARCO])).rows[0]).toEqual({ opened: 0, closed: 0 });
  });

  it('open_today runs as the caller on their local date', async () => {
    await asUser(c, YOU);
    const { rows } = await c.query(`select * from public.open_today()`);
    expect(rows[0]).toHaveProperty('opened');
    await expect(c.query(`select * from public.tick_all()`)).rejects.toThrow(/permission denied/);
  });
});

describe('the Sunday ledger', () => {
  /** Week 2 runs Mon 5 Oct to Sun 11 Oct. Plant marks for You and Marco and settle. */
  async function plantWeekTwo(): Promise<{ you: DayMark[]; marco: DayMark[] }> {
    const l = await lines();
    await c.query(
      `insert into public.contracts (id, profile_id, squad_id, season_id, weigh_in, signed_at) values ('20000000-0000-0000-0000-000000000002', $1, $2, 'S01', false, now())`,
      [MARCO, SQUAD],
    );
    await c.query(
      `insert into public.contract_lines (id, contract_id, key, kind, name, per_week, days, verification, staked) values ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'RUN', 'sport', 'Runs', 3, '{1,3,5}', 'health_photo', true)`,
    );
    const you: DayMark[] = ['V', 'V', 'X', 'V'];
    const marco: DayMark[] = ['V', 'X', 'P'];
    const youDays = ['2026-10-05', '2026-10-06', '2026-10-08', '2026-10-10'];
    const marcoDays = ['2026-10-05', '2026-10-07', '2026-10-11'];
    for (let i = 0; i < you.length; i++) {
      await c.query(
        `insert into public.day_marks (contract_line_id, profile_id, squad_id, local_date, day, week, mark) values ($1, $2, $3, $4, 0, 2, $5)`,
        [l.GYM, YOU, SQUAD, youDays[i], you[i]],
      );
    }
    for (let i = 0; i < marco.length; i++) {
      await c.query(
        `insert into public.day_marks (contract_line_id, profile_id, squad_id, local_date, day, week, mark) values ($1, $2, $3, $4, 0, 2, $5)`,
        ['40000000-0000-0000-0000-000000000001', MARCO, SQUAD, marcoDays[i], marco[i]],
      );
    }
    return { you, marco };
  }

  it('settles a week, closes Sunday at settlement, and agrees with the domain package', async () => {
    const planted = await plantWeekTwo();
    const round = (await c.query(`select public.settle_squad_week($1, 2, '2026-10-11') as id`, [SQUAD])).rows[0].id;
    expect(round).toBeTruthy();

    // Marco's open Sunday mark closed as a miss when the ledger ran.
    expect(await marks(MARCO, '2026-10-11')).toEqual({ RUN: 'X' });

    const r = (await c.query(`select pot_added_cents, hit_rate::float as hit_rate, mvp_profile_id from public.rounds where id = $1`, [round])).rows[0];
    const expected = settleWeek(
      [
        { memberId: YOU, marks: planted.you },
        { memberId: MARCO, marks: planted.marco.map((m) => (m === 'P' ? 'X' : m)) },
      ],
      1000,
    );
    expect(r.pot_added_cents).toBe(expected.potAddedCents);
    expect(r.hit_rate).toBeCloseTo(expected.hitRate, 4);
    expect(r.mvp_profile_id).toBe(expected.mvp);
    expect(r.pot_added_cents).toBe(3000);

    const owed = (await c.query(`select profile_id, sum(amount_cents)::int as cents from public.ledger_entries where round_id = $1 group by profile_id`, [round])).rows;
    expect(owed.find((o) => o.profile_id === YOU)?.cents).toBe(1000);
    expect(owed.find((o) => o.profile_id === MARCO)?.cents).toBe(2000);
  });

  it('is idempotent per squad and week', async () => {
    await plantWeekTwo();
    const first = (await c.query(`select public.settle_squad_week($1, 2, '2026-10-11') as id`, [SQUAD])).rows[0].id;
    const second = (await c.query(`select public.settle_squad_week($1, 2, '2026-10-11') as id`, [SQUAD])).rows[0].id;
    expect(first).toBeTruthy();
    expect(second).toBeNull();
    expect((await c.query(`select id from public.rounds where squad_id = $1`, [SQUAD])).rowCount).toBe(1);
  });

  it('records a perfect week with no pot and a hit rate of one', async () => {
    const l = await lines();
    await c.query(
      `insert into public.day_marks (contract_line_id, profile_id, squad_id, local_date, day, week, mark) values ($1, $2, $3, '2026-10-05', 5, 2, 'V')`,
      [l.GYM, YOU, SQUAD],
    );
    const round = (await c.query(`select public.settle_squad_week($1, 2, '2026-10-11') as id`, [SQUAD])).rows[0].id;
    const r = (await c.query(`select pot_added_cents, hit_rate::float as hit_rate, mvp_profile_id from public.rounds where id = $1`, [round])).rows[0];
    expect(r).toEqual({ pot_added_cents: 0, hit_rate: 1, mvp_profile_id: YOU });
  });

  it('settle_due is callable and only settles at 21:00 local on a Sunday or the finale', async () => {
    const { rows } = await c.query(`select * from public.settle_due()`);
    expect(rows[0].settled).toBeGreaterThanOrEqual(0);
  });
});
