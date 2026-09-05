# 0007. The daily tick and the Sunday ledger run inside Postgres

Date: 2026-09-05. Status: accepted.

## Context

The first scaffold ran the daily close and the weekly settlement as Deno edge functions triggered by pg_cron over HTTP with a shared secret. That is three moving parts, a cold start, and a secret to rotate, for logic that only touches the database.

## Decision

`tick_member`, `tick_all`, `settle_squad_week` and `settle_due` are SQL functions in migration `20260905000001`. pg_cron calls `tick_all` and `settle_due` hourly, and each checks local time per member or per squad founder. The app calls `open_today` right after a contract is signed so the home screen is never empty. The TypeScript domain package keeps `settleWeek` for previews, and the database tests assert the SQL and the TypeScript agree on the same fixture.

The only edge function left is `verify-proof`, because it needs the model and the storage bucket.

## Consequences

Settlement is transactional and idempotent per squad and week. Tests run the real migrations against plain Postgres through a small shim of Supabase's auth and storage schemas, locally and in CI. Enabling pg_cron in the Supabase dashboard is a launch checklist item; the migration guards the schedule so it also applies where pg_cron is absent.
