/**
 * verify-proof
 *
 * Called by the app right after a dual-cam capture is uploaded. Downloads the
 * two images, runs the shared verifier, stores the verification row, and
 * updates the proof and the day mark. Never charges anything: an unclear
 * proof becomes an ask with retake, vouch and appeal as the next steps.
 *
 * Body: { "proof_id": "<uuid>" }
 */
import { decodeBase64, encodeBase64 } from '@std/encoding/base64';
import { SPORTS, askCopy, customSport, workoutMatches } from '@winarc/domain';
import { verifyProof, type ProofImage } from '@winarc/verifier';
import { adminClient, json, userClient } from '../_shared/supabase.ts';

declare const Deno: { serve(handler: (req: Request) => Promise<Response> | Response): void };

type LineRow = { key: string; name: string; verification: 'health_photo' | 'photo' | 'health' | 'attest' | 'artifact' };
type ProofRow = {
  id: string;
  profile_id: string;
  squad_id: string;
  contract_line_id: string;
  local_date: string;
  rear_path: string | null;
  front_path: string | null;
  health_workout: { type: string; minutes: number } | null;
  status: string;
  tier: string | null;
  contract_lines: LineRow | LineRow[] | null;
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const authorization = req.headers.get('authorization') ?? '';
  const body = (await req.json().catch(() => ({}))) as { proof_id?: string };
  if (!body.proof_id) return json({ error: 'proof_id required' }, 400);

  const asUser = userClient(authorization);
  const { data: auth } = await asUser.auth.getUser();
  if (!auth.user) return json({ error: 'not signed in' }, 401);

  const admin = adminClient();
  const { data: proof, error } = await admin
    .from('proofs')
    .select('id, profile_id, squad_id, contract_line_id, local_date, rear_path, front_path, health_workout, status, tier, contract_lines(key, name, verification)')
    .eq('id', body.proof_id)
    .single<ProofRow>();
  if (error || !proof) return json({ error: 'proof not found' }, 404);
  if (proof.profile_id !== auth.user.id) return json({ error: 'not your proof' }, 403);
  if (proof.status === 'verified' || proof.status === 'vouched') {
    return json({ status: proof.status, tier: proof.tier });
  }
  if (!proof.rear_path || !proof.front_path) return json({ error: 'both images are required' }, 400);

  const line = Array.isArray(proof.contract_lines) ? proof.contract_lines[0] : proof.contract_lines;
  if (!line) return json({ error: 'contract line missing' }, 500);
  const sport = SPORTS[line.key] ?? customSport(line.name.replace(/ sessions$/, ''), line.key);
  const workout = proof.health_workout;
  const healthMatched = !!workout && workoutMatches(sport, workout.type, workout.minutes);

  const [rear, front] = await Promise.all([download(admin, proof.rear_path), download(admin, proof.front_path)]);
  const report = await verifyProof({ rear, front }, sport, { healthMatched, verification: line.verification });

  await admin.from('verifications').insert({
    proof_id: proof.id,
    model: report.model,
    rubric_version: report.rubricVersion,
    result: report.result ?? { parse_error: report.parseError ?? null },
    decision: report.outcome,
    input_tokens: report.usage.input,
    output_tokens: report.usage.output,
    cache_read_tokens: report.usage.cacheRead,
    latency_ms: report.latencyMs,
    refused: report.refused,
  });

  if (report.outcome.status === 'verified') {
    await admin.from('proofs').update({ status: 'verified', tier: report.outcome.tier, ask_reason: null }).eq('id', proof.id);
    await admin
      .from('day_marks')
      .update({ mark: 'V', proof_id: proof.id })
      .match({ contract_line_id: proof.contract_line_id, local_date: proof.local_date });
    return json({ status: 'verified', tier: report.outcome.tier });
  }

  await admin.from('proofs').update({ status: 'ask', ask_reason: report.outcome.reason }).eq('id', proof.id);
  return json({ status: 'ask', reason: report.outcome.reason, copy: askCopy(report.outcome.reason) });
});

async function download(admin: ReturnType<typeof adminClient>, path: string): Promise<ProofImage> {
  const { data, error } = await admin.storage.from('proofs').download(path);
  if (error || !data) throw new Error(`Could not read ${path}: ${error?.message ?? 'no data'}`);
  const bytes = new Uint8Array(await data.arrayBuffer());
  const mediaType = path.endsWith('.png') ? 'image/png' : path.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
  return { base64: encodeBase64(bytes), mediaType };
}

// Keep decodeBase64 referenced so the import map entry is exercised by type checks.
void decodeBase64;
