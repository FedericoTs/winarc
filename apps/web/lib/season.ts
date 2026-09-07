import { SEASON_ONE, pickSeason, seasonFromRow, type Season, type SeasonRow } from '@winarc/domain';

/**
 * The season is a database row. The page reads the public seasons table over
 * PostgREST and picks the one for today, mirroring the app; without env or on
 * any failure it renders the compiled fallback so the page never breaks.
 */
export async function getSeason(): Promise<Season> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return SEASON_ONE;
  try {
    const res = await fetch(`${url}/rest/v1/seasons?select=id,starts_on,arc_days,locks_on,finale_on`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      next: { revalidate: 300 },
    });
    if (!res.ok) return SEASON_ONE;
    const rows = (await res.json()) as SeasonRow[];
    return pickSeason(rows.map(seasonFromRow), new Date().toISOString().slice(0, 10)) ?? SEASON_ONE;
  } catch {
    return SEASON_ONE;
  }
}
