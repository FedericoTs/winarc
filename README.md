# ARC

Squad season app for the winter arc. Sign a contract you can screenshot, join a squad of two to eight, prove every session with the in-app dual camera, and settle the pot every Sunday. Season one: 1 October to 29 December 2026, finale on 31 December.

The product rules that every session must respect are in [CLAUDE.md](./CLAUDE.md). The tap-through prototype is in [docs/prototype/season-one.html](./docs/prototype/season-one.html).

## Layout

```
apps/mobile          Expo SDK 57, expo-router. The app.
apps/web             Next.js. Landing page and /join/[code].
packages/domain      Pure product logic with tests. Seasons, contracts, squads, verification decisions, settlement.
packages/verifier    The one model call, shared by the edge function and the evals.
supabase             Schema with row-level security, storage buckets, edge functions, cron.
evals/verification   Labeled proof set and the runner that gates rubric changes.
docs                 Product rules, flows, design system, decisions, research, prototype.
```

## Quickstart

```
scripts/bootstrap.sh          # pnpm install, runs the domain tests, prints next steps
pnpm domain:test
pnpm typecheck
```

For the backend you need Docker and the Supabase CLI:

```
supabase start
supabase db reset             # applies migrations and seed
supabase secrets set ANTHROPIC_API_KEY=... VERIFY_MODEL=claude-opus-5
supabase functions serve --env-file supabase/.env
```

For the app you need Xcode or Android Studio and a dev client, since the camera and HealthKit need native modules:

```
cp .env.example apps/mobile/.env
pnpm mobile                    # then press i for iOS
npx expo install --fix         # if package versions drift from SDK 57
```

## Season one dates

| Date | Event |
|---|---|
| 1 Oct | Day 1. Arcs open. |
| 4 Oct | First Sunday ledger, 21:00 local. |
| 7 Oct | Squads lock. No new members, no contract edits. |
| 30 Oct, 29 Nov, 29 Dec | Episodes 1, 2 and 3 at days 30, 60 and 90. |
| 29 Dec | Day 90. |
| 31 Dec | Finale: certificate, season stats, pot vote, final settlement. |

## Status

Scaffold. Domain logic and its tests are real. The schema, edge functions, app shell and eval runner are structured but not yet run end to end. See the cut line in CLAUDE.md.
