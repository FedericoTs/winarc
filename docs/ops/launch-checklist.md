# Launch checklist

Season one starts 1 October 2026 and locks squads on 7 October. Everything below is done once, in this order, by the founder. Where a step needs a human decision it says so.

## 1. Supabase project

Done on 7 September through the connector: project `winarc`, ref `gixfcrtnyjzlpylcimrb`, Frankfurt, Postgres 17. All seven migrations applied in one transaction; `pg_cron` and `pg_net` enabled; the three jobs `winarc-tick`, `winarc-settle` and `winarc-nudge` scheduled; the migration history written with the repository's versions, so `supabase db push` treats them as applied. The remote schema was fingerprinted against the local test database: functions, columns, policies, indexes and check constraints all match by hash.

- URL: `https://gixfcrtnyjzlpylcimrb.supabase.co`
- Publishable key: `sb_publishable_FHBR5Ro-szpYciar1NuuKA_Qj88GLbL`. This is a client key by design; the app and the web page use it as the anon key. Row-level security is what protects data, and the tests cover it.
- `ai-rush` was paused to free the second free-tier slot; its data is intact and it resumes from the dashboard in one click.
- Never run `supabase/seed.sql` against this project.
- To use the CLI later, `npx supabase link --project-ref gixfcrtnyjzlpylcimrb` asks for the database password: reset it under Settings, Database if you never saw it.

## 2. Auth

- Season one signs in with Apple only (ADR 0012). Nothing to configure for email; the code path is off behind `features.emailSignIn`.
- Apple: once the developer account exists, in Authentication → Providers enable Apple and put `app.winarc.season` in the Client IDs field. Native sign-in tokens carry the bundle id as their audience and are rejected otherwise. The Services ID and secret key fields are for the web flow and can wait.
- Turn off anonymous sign-ins. Leave sign-ups on; the join code is the gate, not the account.

## 3. Edge functions and their secrets

The connector cannot set secrets and deploys functions only by retyping their source, so these two run from your machine. They need only a browser login, not the database password:

```
npx supabase login
npx supabase secrets set --project-ref gixfcrtnyjzlpylcimrb ANTHROPIC_API_KEY=sk-ant-... VERIFY_MODEL=claude-opus-5
npx supabase functions deploy verify-proof title-episode --project-ref gixfcrtnyjzlpylcimrb --use-api
```

`--use-api` bundles on Supabase's side, so no Docker; each function's `deno.json` import map is picked up from its folder. Confirm with `npx supabase functions list --project-ref gixfcrtnyjzlpylcimrb`.

Deployed on 7 September, both at version 1 with `verify_jwt` on. Two facts worth knowing when probing them: the gateway treats the publishable key in the `apikey` header as a valid credential, so such a request reaches the function code, and a request with no credential at all is refused at the gateway with `UNAUTHORIZED_NO_AUTH_HEADER`. The functions do their own authentication regardless: an anonymous call with a valid body gets `not signed in` (401) before any proof is loaded, and a signed-in member asking about someone else's proof gets `not your proof` (403) before the model is called. Nobody reaches the model without owning the proof.

- Smoke test with real images from a phone, on your machine. Put the two JPEGs in `evals/verification/cases/`, which is git-ignored, then run from that folder so the paths resolve:

  ```
  cd evals/verification
  pnpm smoke cases/rear.jpg cases/front.jpg GYM
  ```

  Export `ANTHROPIC_API_KEY` first (`set` on Windows `cmd`). No photos to hand? `pnpm smoke fixtures/rear.jpg fixtures/front.jpg GYM` runs the same call on two drawn fixtures and should answer `ask`; it proves the plumbing, not the calibration. The files must be real JPEGs: an iPhone shoots HEIC by default, and sending the photos to yourself through WhatsApp or Mail converts them. Expect a verified Silver in under 8 seconds; add `true` as a fourth argument to simulate a matching workout and get Gold.
- Then run the eval set in `evals/verification` and check false accepts stay under 5% and false rejects under 10%.
- Confirm a refusal never charges: a proof the model refuses becomes an ask with retake, vouch and appeal.

## 4. The app, building for iOS from Windows

There is no Xcode on Windows, so every iOS build runs on EAS. That works, but it puts two things on the critical path that have their own clocks: Apple Developer enrolment and the build queue.

- **Enrol in the Apple Developer Program** (99 USD a year) before anything else here. Approval can take a day or two and everything below waits on it.
- **Install and link.** `npm i -g eas-cli`, then `eas login`, then from `apps/mobile` run `eas init`. That writes the project id into `app.json` under `extra.eas.projectId`. Commit that change: push notifications read it at runtime and fail without it.
- **Environment variables are optional.** The app and the web page carry the production URL and publishable key as defaults, so a build with no EAS environment reaches production. Set them only to point a `preview` build at a staging project: `apps/mobile/.env` is git-ignored, and EAS uploads from git, so a build would otherwise ship with an empty Supabase URL. The repository is public, so these must live in EAS and not in `eas.json`. From `apps/mobile`, for each of `development`, `preview` and `production`:

  ```
  eas env:set --environment development --name EXPO_PUBLIC_SUPABASE_URL --value https://gixfcrtnyjzlpylcimrb.supabase.co --visibility plaintext
  eas env:set --environment development --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value sb_publishable_FHBR5Ro-szpYciar1NuuKA_Qj88GLbL --visibility plaintext
  ```

  `env:set` creates or updates; the older `env:create` is deprecated. Running it with no flags prompts for each field instead. Add `EXPO_PUBLIC_POSTHOG_KEY` the same way once analytics is wanted; leaving it unset simply sends nothing. Check the result with `eas env:list --environment development`.
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

## 6. Web, domain and links

- The web page deploys from GitHub through Vercel (team `federicosciuca-gmailcoms-projects`, project `winarc`, root `apps/web`). Linking needs the Vercel GitHub app installed once at https://github.com/apps/vercel with access to `FedericoTs/winarc`; after that every push to `main` deploys and the production URL is `winarc.vercel.app` until the domain attaches.
- Analytics needs a `WinArc` project of its own in PostHog (Settings → Projects → New project, region US). Its public token then goes into `apps/mobile/src/lib/analytics.ts` as the default next to the Supabase values, and the dashboards for the questions in `docs/product/06-analytics.md` get built against it.

- Buy `winarc.app` first, then the defensive ones (`.team`, `.fit`, `.co`). Founder's call.
- Point the web app at the domain and check `winarc://` plus `https://winarc.app/join/WIN-XXXX` open the join screen.

## 7. Go / no-go on 30 September

- CI green on `main`: domain, database and web jobs.
- One full ritual completed on a production build by two accounts in one squad, including a vouch.
- `select count(*) from public.push_tokens;` is at least the number of test devices.
- The three cron jobs have run at least once: `select * from cron.job_run_details order by start_time desc limit 10;`.

## 8. Rehearsal week

Due marks open only inside the season's dates, so before 1 October nothing on a device can exercise the deadline, the miss, the sick day or the Sunday ledger. The app reads the season from the database (ADR 0011), so a rehearsal needs no code and no rebuild.

The free tier allows two active projects, so the rehearsal runs on the production project *before any real contract exists*, and the reset script wipes it:

- Around 8 September, in the SQL editor, run `supabase/rehearsal/season.sql`. Season one becomes a two-week arc starting tomorrow, locking after two days, with two Sunday ledgers inside it.
- Sign a test contract with a second account, and live the ritual for real: proofs, a vouch, a sick day, the nudge at 20:00, the ledger on Sunday.
- By 23 September run `supabase/rehearsal/reset.sql` there. It restores 1 October and deletes every squad, contract, mark, proof and ledger row, keeping accounts. Only then invite the founding squads to sign. Never run it after a real contract exists.
