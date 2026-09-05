# 0001. pnpm monorepo with Expo, Supabase and a pure domain package

Date: 2026-09-05. Status: accepted.

## Context

One founder, two and a half weeks to season one, an iOS-first app that also has to run on Android, a backend with row-level security and scheduled jobs, and a model call that must behave identically in production and in evals.

## Decision

- pnpm workspaces. `packages/domain` holds all product logic with tests and no I/O. `packages/verifier` holds the one model call.
- Expo SDK 57 with expo-router for the app, one codebase for both platforms, dev client because the camera and HealthKit need native modules.
- Supabase for Postgres, auth, storage, edge functions and cron. Edge functions import copies of the domain and verifier packages, produced by `scripts/sync-domain.sh`, because Supabase bundles only files under its functions folder.
- Next.js for the landing page and the join links.

## Consequences

Screens and functions cannot drift from the rules because they call the same code. The sync step is a small tax on every domain change; CI should fail if the copies are stale.
