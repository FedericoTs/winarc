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

- Deploy: `supabase functions deploy verify-proof` and `supabase functions deploy title-episode`.
- Secrets: `supabase secrets set ANTHROPIC_API_KEY=... VERIFY_MODEL=claude-opus-5`.
- Smoke test with real images from a phone, on your machine:
  `ANTHROPIC_API_KEY=... pnpm --filter @winarc/eval-verification smoke -- ./rear.jpg ./front.jpg GYM`
  Expect a verified Silver in under 8 seconds. Then run the eval set in `evals/verification` and check false accepts stay under 5% and false rejects under 10%.
- Confirm a refusal never charges: a proof the model refuses becomes an ask with retake, vouch and appeal.

## 4. The app, building for iOS from Windows

There is no Xcode on Windows, so every iOS build runs on EAS. That works, but it puts two things on the critical path that have their own clocks: Apple Developer enrolment and the build queue.

- **Enrol in the Apple Developer Program** (99 USD a year) before anything else here. Approval can take a day or two and everything below waits on it.
- **Install and link.** `npm i -g eas-cli`, then `eas login`, then from `apps/mobile` run `eas init`. That writes the project id into `app.json` under `extra.eas.projectId`. Commit that change: push notifications read it at runtime and fail without it.
- **Set the build-time environment variables.** `apps/mobile/.env` is git-ignored, and EAS uploads from git, so a build would otherwise ship with an empty Supabase URL. The repository is public, so these must live in EAS and not in `eas.json`. From `apps/mobile`, for each of `development`, `preview` and `production`:

  ```
  eas env:create --environment development --name EXPO_PUBLIC_SUPABASE_URL --value https://YOUR-PROJECT.supabase.co --visibility plaintext
  eas env:create --environment development --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value eyJ... --visibility sensitive
  ```

  Running `eas env:create` with no flags prompts for each field instead. Add `EXPO_PUBLIC_POSTHOG_KEY` the same way once analytics is wanted; leaving it unset simply sends nothing. Check the result with `eas env:list --environment development`.
- **Register your iPhone.** Development and preview builds use internal distribution, which is ad hoc: the device has to be in the provisioning profile. Run `eas device:create`, open the link on the phone, install the profile, then confirm with `eas device:list`. A build made before the device is registered will not install on it.
- **Build the dev client.** `eas build --profile development --platform ios`. First run asks to generate a distribution certificate and provisioning profile; let EAS manage both. Expect 10 to 25 minutes including queue. When it finishes, open the build link on the phone and install.
- **Connect Metro.** `pnpm mobile` from the repository root, then scan the QR from inside the dev client. The phone and the laptop must be on the same network, and Windows Firewall will ask to allow Node the first time. Say yes for private networks.
- **Apple capabilities.** In the developer portal, `app.winarc.season` needs HealthKit, Sign in with Apple and Push Notifications. Upload an APNs key with `eas credentials`.
- **Run the whole ritual on the device.** Sign a contract, share the poster, take a dual-cam proof, get the stamp, request a vouch from a second account and grant it, log a weigh-in. Then force a settlement and read the Ledger tab:

  ```
  select * from public.settle_squad_week('<squad-id>', 1, current_date);
  ```

- **Test a nudge.** Send one from https://expo.dev/notifications to a token from `select token from public.push_tokens;` and confirm the tap lands on Today.
- **Ship.** `eas build --profile production --platform ios` then `eas submit --profile production --platform ios`.

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
