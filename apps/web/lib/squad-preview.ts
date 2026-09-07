/**
 * The public squad preview behind every share card. Calls the security-definer
 * RPC over PostgREST with the anon key; returns null without env, on a bad
 * code, or on any failure, and the page renders the code alone.
 */
export interface SquadPreview {
  id: string;
  name: string;
  size: number;
  stake_cents: number;
  pot_rule: string;
  currency: 'EUR' | 'USD';
  member_count: number;
  spots_left: number;
  locks_on: string;
  locked: boolean;
}

export async function squadPreview(code: string): Promise<SquadPreview | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    const res = await fetch(`${url}/rest/v1/rpc/squad_preview`, {
      method: 'POST',
      headers: { apikey: key, 'content-type': 'application/json' },
      body: JSON.stringify({ p_code: code }),
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as SquadPreview[];
    return Array.isArray(rows) && rows[0] ? rows[0] : null;
  } catch {
    return null;
  }
}
