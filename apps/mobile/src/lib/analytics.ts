import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import type { AskReason, Tier } from '@winarc/domain';

/**
 * Product analytics, PostHog over plain fetch so the app carries no SDK.
 * Without a key every call is a no-op. Events carry outcomes and counts,
 * never a body weight, an image, a name, an email or anything from Strava;
 * the list lives in docs/product/06-analytics.md and is the contract.
 */

const KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY ?? '';
const HOST = (process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com').replace(/\/$/, '');
const ANON_STORE_KEY = 'winarc.anon_id';
const SEASON = 'S01';

export type ShareResult = 'shared' | 'dismissed' | 'failed';
export type PushState = 'registered' | 'denied' | 'unavailable';
export type WeighSource = 'healthkit' | 'health_connect' | 'manual';

export type AnalyticsEvent =
  | { name: 'signed_in'; method: 'apple' | 'email' }
  | { name: 'squad_founded'; size: number; stake_cents: number; currency: string }
  | { name: 'squad_joined'; size: number; stake_cents: number }
  | { name: 'contract_signed'; lines: number; sessions_per_week: number; weigh_in: boolean; stake_cents: number }
  | { name: 'poster_shared'; result: ShareResult }
  | { name: 'proof_captured'; sport: string; health_evidence: boolean }
  | { name: 'proof_stamped'; sport: string; tier: Tier; latency_ms: number }
  | { name: 'proof_asked'; sport: string; reason: AskReason }
  | { name: 'proof_card_shared'; result: ShareResult }
  | { name: 'vouch_requested' }
  | { name: 'vouched' }
  | { name: 'sick_day_used'; ok: boolean }
  | { name: 'weigh_in_logged'; source: WeighSource; readings: number }
  | { name: 'push_registered'; state: PushState; asked: boolean }
  | { name: 'episode_created'; number: 1 | 2 | 3; fallback: boolean }
  | { name: 'episode_shared'; number: 1 | 2 | 3; result: ShareResult }
  | { name: 'habit_attested'; verification: 'attest' | 'photo' | 'artifact' };

let userId: string | null = null;
let anonId: string | null = null;

async function getAnonId(): Promise<string> {
  if (anonId) return anonId;
  try {
    const stored = await SecureStore.getItemAsync(ANON_STORE_KEY);
    if (stored) return (anonId = stored);
    const fresh = Crypto.randomUUID();
    await SecureStore.setItemAsync(ANON_STORE_KEY, fresh);
    return (anonId = fresh);
  } catch {
    return (anonId = anonId ?? Crypto.randomUUID());
  }
}

async function send(event: string, properties: Record<string, unknown>): Promise<void> {
  if (!KEY) return;
  try {
    const distinctId = userId ?? (await getAnonId());
    await fetch(`${HOST}/capture/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        api_key: KEY,
        event,
        distinct_id: distinctId,
        timestamp: new Date().toISOString(),
        properties: {
          ...properties,
          $lib: 'winarc-mobile',
          app_version: Constants.expoConfig?.version ?? 'dev',
          platform: Platform.OS,
          season: SEASON,
        },
      }),
    });
  } catch {
    // Analytics never surfaces to the member.
  }
}

/** Fire and forget. Safe to call from any handler; never throws, never awaits the network in the UI. */
export function track(event: AnalyticsEvent): void {
  const { name, ...properties } = event;
  void send(name, properties);
}

/** Ties the anonymous install to the signed-in account once. Idempotent. */
export function identify(id: string): void {
  if (userId === id) return;
  const previous = userId;
  userId = id;
  if (previous) return;
  void (async () => {
    const anon = await getAnonId();
    await send('$identify', { $anon_distinct_id: anon });
  })();
}

export function resetIdentity(): void {
  userId = null;
}
