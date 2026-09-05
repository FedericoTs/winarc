import { createClient, type SupabaseClient } from '@supabase/supabase-js';

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
