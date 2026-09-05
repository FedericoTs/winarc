# WinArc

Squad season app for the winter arc. Sign a contract you can screenshot, join a squad of two to eight, prove every session with the in-app dual camera, and settle the pot every Sunday. Season one: 1 October to 29 December 2026, finale on 31 December.

The product rules that every session must respect are in [CLAUDE.md](./CLAUDE.md). The tap-through prototype is in [docs/prototype/season-one.html](./docs/prototype/season-one.html).

## Layout

```
apps/mobile          Expo SDK 57, expo-router. The app.
apps/web             Next.js. Landing page and /join/[code].
packages/domain      Pure product logic with tests. Seasons, contracts, squads, verification decisions, settlement.
packages/verifier    The one model call, shared by the edge function and the evals.
supabase             Schema with row-level security, storage, the verify-proof and title-episode functions, ticks, settlement, rescues and episodes in SQL, and the database tests.
evals/verification   Labeled proof set and the runner that gates rubric changes.
docs                 Product rules, flows, design system, decisions, research, prototype.
```

## Quickstart

```
scripts/bootstrap.sh          # pnpm install, runs the domain tests, prints next steps
pnpm domain:test
pnpm db:test                  # real migrations on a local Postgres; see CLAUDE.md
pnpm typecheck
pnpm mobile:bundle            # Metro bundles the iOS app without a device
```

On Windows `cmd` the bootstrap script will not run, since it is bash. Do the same three things directly:

```
npm i -g pnpm@10
pnpm install
pnpm domain:test
```

Everything else is cross-platform. The only other bash script is `scripts/sync-domain.sh`, needed before deploying edge functions after editing `packages/domain` or `packages/verifier`; run it from Git Bash, and CI runs it on every push either way.

For the backend you need Docker and the Supabase CLI:

```
supabase start
supabase db reset             # applies migrations and seed
supabase secrets set ANTHROPIC_API_KEY=... VERIFY_MODEL=claude-opus-5
supabase functions serve --env-file supabase/.env
```

The camera and HealthKit need native modules, so the app runs in a dev client, not Expo Go. With Xcode or Android Studio you can build locally; without them, and on Windows, EAS builds it in the cloud:

```
cp .env.example apps/mobile/.env
pnpm mobile                    # Metro; then press i for iOS, or scan from the dev client
npx expo install --fix         # if package versions drift from SDK 57
```

```
eas build --profile development --platform ios
```

Build profiles are in `apps/mobile/eas.json`. They read the Supabase values from EAS environments rather than `.env`, which is git-ignored and never uploaded. See [docs/ops/launch-checklist.md](./docs/ops/launch-checklist.md) section 4 for the full path, including registering your device for internal distribution.

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

Season one launch scope is built and verified as far as a machine without a phone can go:

- Domain rules run as tests (38). The real migrations run on plain Postgres in CI with 34 tests over RPCs, policies, ticks, settlement, rescues, nudges, weigh-ins, episodes and the squad-witnessed habit path.
- The iOS app bundles under Metro in CI, so every screen's imports resolve against the versions Expo SDK 57 ships.
- Both edge functions type-check under Deno against the synced domain and verifier copies.
- Not yet exercised: the model call itself (needs a key; `evals/verification/smoke.ts`), the app on a device, Android on a device, and push delivery. The widget and Live Activity from the Day 30 list need native targets and are not started. `docs/ops/launch-checklist.md` walks the rest.
