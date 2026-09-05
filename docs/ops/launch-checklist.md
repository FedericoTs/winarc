# Launch checklist

Season one starts 1 October 2026 and locks squads on 7 October. Everything below is done once, in this order, by the founder. Where a step needs a human decision it says so.

## 1. Supabase project

- Create the production project in the EU region. Note the project ref, the URL and the anon key.
- In Database → Extensions enable `pg_cron` and `pg_net`. The migrations are guarded and apply without them, but the tick, the settlement and the nudge only run with them.
- Link and push: `supabase link --project-ref <ref>` then `supabase db push`. Migrations 0000 to 0004 create the tables, policies, buckets, RPCs and cron jobs.
- Verify the three jobs exist: `select jobname, schedule from cron.job;` should list `winarc-tick`, `winarc-settle` and `winarc-nudge`, all hourly.
- Do not run `supabase/seed.sql` in production. It is for the local stack only.
- Run `supabase db test`-style checks locally first: `pnpm db:test` applies the same migrations to plain Postgres and runs 30 assertions.

## 2. Auth

- Apple: in Authentication → Providers enable Apple with the Services ID, Team ID, Key ID and the .p8 key from the Apple Developer account. The bundle identifier is `app.winarc.season`.
- Email: keep the OTP flow. In Authentication → Email Templates make the "Magic Link" template show `{{ .Token }}` so the message carries the six-digit code the app asks for. Set OTP expiry to 10 minutes.
- Turn off anonymous sign-ins. Leave sign-ups on; the join code is the gate, not the account.

## 3. Verification edge function

- Deploy: `supabase functions deploy verify-proof`.
- Secrets: `supabase secrets set ANTHROPIC_API_KEY=... VERIFY_MODEL=claude-opus-5`.
- Smoke test with real images from a phone, on your machine:
  `ANTHROPIC_API_KEY=... pnpm --filter @winarc/eval-verification smoke -- ./rear.jpg ./front.jpg GYM`
  Expect a verified Silver in under 8 seconds. Then run the eval set in `evals/verification` and check false accepts stay under 5% and false rejects under 10%.
- Confirm a refusal never charges: a proof the model refuses becomes an ask with retake, vouch and appeal.

## 4. The app

- `cd apps/mobile && cp .env.example .env` and fill `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- `eas init` writes the EAS project id into `app.json` under `extra.eas.projectId`. Push tokens need it; without it the app runs but never registers for the 20:00 nudge.
- Capabilities in the Apple Developer portal for `app.winarc.season`: HealthKit, Sign in with Apple, Push Notifications. Upload the APNs key to Expo (`eas credentials`).
- Build the dev client and run the ritual on a real iPhone: sign the contract, share the poster, open Today, take a dual-cam proof, get the stamp, see it on the board, log a weigh-in. Then force one settlement on the test squad with `select * from public.settle_squad_week('<squad>', 1, current_date);` and check the Ledger tab.
- Send a test nudge from https://expo.dev/notifications to a registered token and confirm the tap lands on Today.
- `eas build --profile production --platform ios` and `eas submit`.

## 5. App Store

- Privacy nutrition labels: Health and fitness (workouts, weight, not linked to identity outside the account), Photos (captured in app, never the library), Contact info (email), Identifiers (user id).
- Age rating 17+ is not required; the weigh-in is optional and unstaked. The under-18 weigh-in restriction from the product rules needs an age gate that does not exist yet; ship it before opening sign-ups to anyone under 18 or keep the first season invite-only to adults.
- Screenshots come from the share cards and the Squad Board on a dark background. No feed, no charts.

## 6. Domain and links

- Buy `winarc.app` first, then the defensive ones (`.team`, `.fit`, `.co`). Founder's call.
- Point the web app at the domain and check `winarc://` plus `https://winarc.app/join/WIN-XXXX` open the join screen.

## 7. Go / no-go on 30 September

- CI green on `main`: domain, database and web jobs.
- One full ritual completed on a production build by two accounts in one squad, including a vouch.
- `select count(*) from public.push_tokens;` is at least the number of test devices.
- The three cron jobs have run at least once: `select * from cron.job_run_details order by start_time desc limit 10;`.
