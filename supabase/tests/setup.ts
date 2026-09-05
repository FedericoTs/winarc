/**
 * Global setup: creates a fresh `winarc_test` database, applies the Supabase
 * shim, every migration in order, and the seed. Tests then connect to it.
 *
 * DATABASE_URL points at a superuser on a plain Postgres. Default matches the
 * CI service container and a local `docker run postgres`.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ADMIN_URL = process.env.DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:5432/postgres';
export const TEST_DB = 'winarc_test';

export function testUrl(): string {
  const u = new URL(ADMIN_URL);
  u.pathname = `/${TEST_DB}`;
  return u.toString();
}

export default async function setup(): Promise<void> {
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${TEST_DB} with (force)`);
  await admin.query(`create database ${TEST_DB}`);
  await admin.end();

  const db = new pg.Client({ connectionString: testUrl() });
  await db.connect();
  const migrationsDir = path.join(here, '..', 'migrations');
  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
  await db.query(await readFile(path.join(here, 'shim.sql'), 'utf8'));
  for (const f of files) {
    await db.query(await readFile(path.join(migrationsDir, f), 'utf8'));
  }
  await db.query(await readFile(path.join(here, '..', 'seed.sql'), 'utf8'));
  await db.end();
  process.env.WINARC_TEST_URL = testUrl();
}
