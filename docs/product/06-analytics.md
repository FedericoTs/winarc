# Analytics

One event per feature moment, sent to PostHog from `apps/mobile/src/lib/analytics.ts`. Without `EXPO_PUBLIC_POSTHOG_KEY` nothing is sent. The distinct id is the account id after sign-in and a per-install anonymous id before it, joined once with an identify call.

## What never goes in an event

A body weight. An image or a storage path. A display name, handle or email. Anything from Strava. Free text typed by a member. If a question needs one of those, the answer is a database query by the founder, not an event.

## Events

| Event | Properties | Fires when |
| --- | --- | --- |
| `signed_in` | method: apple, email | An identity is established |
| `squad_founded` | size, stake_cents, currency | `create_squad` succeeds |
| `squad_joined` | size, stake_cents | `join_squad` succeeds |
| `contract_signed` | lines, sessions_per_week, weigh_in, stake_cents | Contract and lines are written |
| `poster_shared` | result: shared, dismissed, failed | The share sheet closes after signing |
| `proof_captured` | sport, health_evidence | Both images are uploaded |
| `proof_stamped` | sport, tier, latency_ms | The verifier returns a stamp |
| `proof_asked` | sport, reason | The verifier returns an ask |
| `proof_card_shared` | result | The share sheet closes after a stamp |
| `vouch_requested` | | A member asks the squad |
| `vouched` | | A squadmate confirms |
| `sick_day_used` | ok | The sick day RPC returns |
| `weigh_in_logged` | source, readings | A reading is stored; the number never leaves the device except to the owner's own row |
| `push_registered` | state: registered, denied, unavailable; asked | The permission ask after signing |
| `episode_created` | number, fallback | An episode is titled and stored |
| `episode_shared` | number, result | The share sheet closes after an episode card |

Every event also carries `app_version`, `platform`, `season` and `$lib`.

## The questions these answer

- Activation: `signed_in` → `squad_founded` or `squad_joined` → `contract_signed` → first `proof_stamped`, and where the drop is.
- The growth loop: `poster_shared` and `proof_card_shared` rates, then `squad_joined` per code from the database.
- Verification quality: `proof_asked` by reason against `proof_stamped`, p50 and p95 of `latency_ms`, share of Gold.
- Rescue use: `sick_day_used`, `vouch_requested` and `vouched` per squad-week; if vouching climbs, the verifier is asking too often.
- Push: `denied` share tells whether the moment of the ask is right.
