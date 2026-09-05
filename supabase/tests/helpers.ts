import pg from 'pg';
import { testUrl } from './setup';

export const YOU = '00000000-0000-0000-0000-000000000001';
export const MARCO = '00000000-0000-0000-0000-000000000002';
export const SQUAD = '10000000-0000-0000-0000-000000000001';
export const CONTRACT = '20000000-0000-0000-0000-000000000001';

/** One client per test, wrapped in a transaction that is rolled back, so the seed stays pristine. */
export async function open(): Promise<pg.Client> {
  const c = new pg.Client({ connectionString: process.env.WINARC_TEST_URL ?? testUrl() });
  await c.connect();
  await c.query('begin');
  return c;
}

export async function close(c: pg.Client): Promise<void> {
  try {
    await c.query('rollback');
  } finally {
    await c.end();
  }
}

/** Act as a signed-in member for the rest of the transaction. */
export async function asUser(c: pg.Client, id: string): Promise<void> {
  await c.query('reset role');
  await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: id, role: 'authenticated' })]);
  await c.query('set local role authenticated');
}

export async function asAnon(c: pg.Client): Promise<void> {
  await c.query('reset role');
  await c.query(`select set_config('request.jwt.claims', '', true)`);
  await c.query('set local role anon');
}

/** Back to the superuser, the way a service-role edge function sees the data. */
export async function asAdmin(c: pg.Client): Promise<void> {
  await c.query('reset role');
  await c.query(`select set_config('request.jwt.claims', '', true)`);
}

let counter = 0;
/** A brand-new auth user; the trigger creates the profile. */
export async function newUser(c: pg.Client, name: string, tz = 'Europe/Rome'): Promise<string> {
  await asAdmin(c);
  const id = `30000000-0000-0000-0000-${String(++counter).padStart(12, '0')}`;
  await c.query(
    `insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
     values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, $3, now(), now())`,
    [id, `${name.toLowerCase()}${counter}@winarc.local`, JSON.stringify({ name })],
  );
  await c.query('update public.profiles set tz = $2 where id = $1', [id, tz]);
  return id;
}

/** Runs a query expecting Postgres to raise; returns the error message. */
export async function expectError(c: pg.Client, sql: string, params: unknown[] = []): Promise<string> {
  await c.query('savepoint sp');
  try {
    await c.query(sql, params);
  } catch (e) {
    await c.query('rollback to savepoint sp');
    return (e as Error).message;
  }
  await c.query('release savepoint sp');
  throw new Error(`Expected an error from: ${sql}`);
}
