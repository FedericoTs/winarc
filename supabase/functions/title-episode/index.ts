/**
 * title-episode
 *
 * Called by the member's device once day 30, 60 or 90 has arrived. Computes
 * the chapter's stats in SQL, asks the model for a title in training-arc
 * language from counts and sport names only, and stores the episode. Any
 * model failure falls back to a deterministic title, so the card always
 * renders. Idempotent: an existing episode is returned as is.
 *
 * Body: { "number": 1 | 2 | 3 }
 */
import { EPISODE_DAYS, type EpisodeStats } from '@winarc/domain';
import { titleEpisode } from '@winarc/verifier';
import { adminClient, json, userClient } from '../_shared/supabase.ts';

type EpisodeRow = { id: string; number: number; title: string; stats: Record<string, unknown>; created_at: string };

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const authorization = req.headers.get('authorization') ?? '';
  const body = (await req.json().catch(() => ({}))) as { number?: number };
  const number = body.number;
  if (number !== 1 && number !== 2 && number !== 3) return json({ error: 'number must be 1, 2 or 3' }, 400);

  const asUser = userClient(authorization);
  const { data: auth } = await asUser.auth.getUser();
  if (!auth.user) return json({ error: 'not signed in' }, 401);
  const me = auth.user.id;
  const admin = adminClient();

  const { data: existing } = await admin.from('episodes').select('id, number, title, stats, created_at').eq('profile_id', me).eq('number', number).maybeSingle<EpisodeRow>();
  if (existing) return json({ episode: existing, fallback: false, existing: true });

  const { data: membership } = await admin.from('squad_members').select('squad_id, season_id').eq('profile_id', me).is('left_at', null).maybeSingle<{ squad_id: string; season_id: string }>();
  if (!membership) return json({ error: 'no home squad' }, 400);

  const { data: today } = await admin.rpc('local_date_for', { p_profile: me });
  const { data: season } = await admin.from('seasons').select('starts_on').eq('id', membership.season_id).single<{ starts_on: string }>();
  if (!season || !today) return json({ error: 'season or local date missing' }, 500);
  const day = Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${season.starts_on}T00:00:00Z`)) / 86_400_000) + 1;
  const unlocksOnDay = EPISODE_DAYS[number - 1] ?? Number.POSITIVE_INFINITY;
  if (day < unlocksOnDay) return json({ error: 'not yet', unlocks_on_day: unlocksOnDay, day }, 409);

  const { data: stats, error: sErr } = await admin.rpc('episode_stats', { p_profile: me, p_number: number });
  if (sErr || !stats) return json({ error: sErr?.message ?? 'no stats' }, 500);

  const { data: lines } = await admin
    .from('contract_lines')
    .select('name, kind, contracts!inner(profile_id, season_id)')
    .eq('kind', 'sport')
    .eq('contracts.profile_id', me)
    .eq('contracts.season_id', membership.season_id);
  const sports = ((lines ?? []) as { name: string }[]).map((l) => l.name.replace(/ sessions$/, ''));

  const report = await titleEpisode(stats as EpisodeStats, sports);
  const { data: episode, error: eErr } = await admin
    .from('episodes')
    .insert({
      profile_id: me,
      squad_id: membership.squad_id,
      number,
      title: report.title,
      stats: { ...(stats as Record<string, unknown>), line: report.line, model: report.model, rubric_version: report.rubricVersion, fallback: report.fallback },
    })
    .select('id, number, title, stats, created_at')
    .single<EpisodeRow>();
  if (eErr || !episode) return json({ error: eErr?.message ?? 'could not save the episode' }, 500);
  return json({ episode, fallback: report.fallback, existing: false });
});
