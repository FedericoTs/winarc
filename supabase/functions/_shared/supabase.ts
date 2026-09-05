import { createClient, type SupabaseClient } from '@supabase/supabase-js';

declare const Deno: { env: { get(key: string): string | undefined } };

function env(key: string): string {
  const v = Deno.env.get(key);
  if (!v) throw new Error(`Missing env ${key}`);
  return v;
}

/** Service-role client. Bypasses row-level security; use only inside functions. */
export function adminClient(): SupabaseClient {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Client acting as the calling member, so row-level security applies. */
export function userClient(authorization: string): SupabaseClient {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** Cron-triggered functions are not called by members; they carry a shared secret. */
export function requireCronSecret(req: Request): Response | null {
  const expected = Deno.env.get('CRON_SECRET');
  const got = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!expected || got !== expected) return json({ error: 'forbidden' }, 403);
  return null;
}

/** Hour of the day, 0 to 23, in a timezone. */
export function localHour(at: Date, timeZone: string): number {
  const h = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', hourCycle: 'h23' }).format(at);
  return Number.parseInt(h, 10);
}
