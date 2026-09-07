# WinArc

Squad season app. People sign a short training contract, join a squad of two to eight, prove every session with an in-app dual-camera capture, and settle a virtual pot every Sunday. Season one runs 1 Oct to 29 Dec 2026 with the finale on 31 Dec. Squads lock on 7 Oct.

This file is read by every Claude Code session. It holds the rules that must survive across sessions. Product detail lives in `docs/product`, decisions in `docs/decisions`, the tap-through prototype in `docs/prototype/season-one.html`.

## Product rules

These are settled. Changing one needs a new file in `docs/decisions`.

1. **Squad terms live on the squad.** Size two to eight, stake tier 500, 1000 or 2500 cents per miss, pot rule. The founder sets them once; everyone who joins inherits them and never sees a stake screen.
2. **Stake the process, never the outcome.** Sessions and habits are staked. The weigh-in is weekly, private, optional and never staked. No calorie targets anywhere in the product.
3. **A miss costs the stake and marks the day. It never resets the arc.** Rescue mechanics: one sick day per fortnight, one vouch per week confirmed by two squadmates, and an appeal. All three are visible on the home screen.
4. **The app never rejects a person. It asks.** Below the confidence floor the order is retake, vouch, appeal. Nothing is charged on an ask. Copy never accuses; see `askCopy` in the domain package.
5. **Tiers.** Gold is Health evidence plus photo. Silver is photo. Bronze is vouched. All three are hits on the board.
6. **Proof is the in-app dual-cam only.** Rear then front, about one second apart. No gallery uploads, ever.
7. **Season one money is a ledger.** The pot is virtual. No Stripe, no charges, no payouts, no money held. Revenue comes only from the Arc Pass through in-app purchase via RevenueCat. Charity and anti-charity beneficiaries are season two and need a legal entity first.
8. **No feed.** Visibility is squad-only. The only public surfaces are share cards and the web join page.
9. **No coaching.** We verify and narrate. We never prescribe training or diet.
10. **Strava data is shown only to its owner** and is never a verification input or a model input. HealthKit and Health Connect are the verification sources. Garmin arrives through those, or through Terra later.
11. **One home squad per contract.** Crews, which group squads under a creator, gym or city, come later.
12. **Every share card** is 9:16, carries one number, the member's identity, the squad, a watermark and the join code, and reads at thumbnail size.

## Vocabulary

Season, Arc, Day N of 90, Contract, Line, Squad, Terms, Code, Draft, Proof, Stamp, Tier, Board, Ledger, Round, Pot, Rescue, Sick day, Vouch, Appeal, Episode, Finale, Crew. Use these words in code, copy and commits. Do not introduce synonyms.

## Design system

Single dark world on the phone. Ground `#0B0D12`, surface `#141821`, line `#262E3C`, ink `#EAF2FA`, ink-2 `#8A97A8`.

Each color has one job. Ember `#FF7A1A` is proof and streaks only. Gold `#E9B54A` is money only. Ice `#9CD3FF` is structure and every primary action. Rose `#FF4D6D` is a miss. Mint `#7EE0B8` is the squad: MVP, matched, vouched.

Type: Big Shoulders Display for numerals and slates, Instrument Sans for UI, IBM Plex Mono for the ledger and timecodes. Tokens are in `apps/mobile/src/theme/tokens.ts`.

Copy is written from the member's side, active voice, no em-dashes. Never a number on every point; one number per card.

## Architecture

pnpm monorepo.

- The season is a database row (ADR 0011): the app renders `season()` from `apps/mobile/src/lib/season.ts`, the web page `getSeason()`, both loaded before paint. `SEASON_ONE` in the domain is the offline fallback and the value tests pin; never read it directly from a screen.
- `packages/domain`: pure product logic with tests. Seasons, sports, habits, contracts, squads, verification decisions, settlement. No I/O, no SDKs. Imported by the app, the verifier, the evals, and copied into the edge functions.
- `packages/verifier`: the one model call. Takes two images and a sport, returns a structured result and a decision. Used by the edge function and the evals so they can never drift.
- `apps/mobile`: Expo SDK 57 with expo-router. iOS first, Android from the same code.
- Analytics: a fetch-based PostHog facade in `apps/mobile/src/lib/analytics.ts`, a no-op without a key. The event list in `docs/product/06-analytics.md` is the contract; an event never carries a body weight, an image, a name or anything from Strava.
- `apps/web`: Next.js landing page and `/join/[code]`.
- `supabase`: Postgres with row-level security, private Storage buckets, two Deno edge functions, proof verification and episode titling, and the daily tick and Sunday settlement as SQL functions run by pg_cron. Migrations are append-only. `supabase/tests` applies the real migrations to a plain Postgres through a small shim and verifies RPCs, policies, ticks and settlement.
- `evals/verification`: the labeled proof set and the runner. Ship a rubric change only when false accepts are under 5 percent and false rejects under 10 percent.

## Commands

```
pnpm install                      # everything
pnpm domain:test                  # the product rules as tests
pnpm db:test                      # real migrations on Postgres; needs DATABASE_URL or a local postgres:postgres
pnpm typecheck                    # all packages
pnpm mobile                       # Expo dev client
pnpm mobile:bundle                # Metro bundles the iOS app; catches a bad import or version drift without a device
pnpm web                          # Next.js
pnpm eval:verification            # needs ANTHROPIC_API_KEY and a labeled set
scripts/sync-domain.sh            # after editing packages/domain or packages/verifier, before deploying functions
supabase start && supabase db reset
supabase functions serve --env-file supabase/.env
```

## Conventions

- Logic goes in `packages/domain` with a test. Screens and functions call it; they do not reimplement it.
- One migration per concern, timestamped, never edited after it lands. Row-level security on every table. Writes that cross members go through security-definer RPCs.
- Dates: a member's day is their local calendar date; profiles store a timezone. Use the season helpers. Store instants in UTC.
- Money is integer cents plus a currency. Never a float.
- Model calls use `claude-opus-5`, structured output through a zod schema, adaptive thinking at low effort, the cached rubric, and server-side refusal fallbacks. Every verification row stores model, rubric version, tokens and latency.
- `supabase/functions/_shared/domain` and `_shared/verifier` are generated by the sync script. Never edit them by hand.
- Analytics events are named `surface.action`, for example `proof.stamped`, `card.shared`, `squad.joined`.
- Commits are imperative and about one thing.

## Definition of done, season one

A feature is done when the domain logic is tested, row-level security covers its tables, it runs on the iOS dev client, its copy has been checked against rule 4, its analytics event exists, and any card it produces passes the screenshot test.

## Cut line

- **By 1 Oct.** Contract and poster, squads with codes and a hand-matched draft, dual-cam proof with verification, HealthKit auto-verify, Squad Board, Sunday settlement on the ledger, share cards, push notifications.
- **By Day 30.** Widget and Live Activity, episode cards, Android via Health Connect.
- **By Day 60.** Terra connector, the first sport pack, video episodes, the finale fund if counsel clears it.

## Things not to build this season

Stripe or any payment for stakes. A feed. Coaching or training plans. Weight targets in absolute numbers. Strava data on any squad surface. A second squad for the same contract.
