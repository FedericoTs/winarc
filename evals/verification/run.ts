/**
 * Verification eval.
 *
 * Reads cases/cases.jsonl, runs each through the shared verifier, and reports
 * false accepts (expected ask, got verified) and false rejects (expected
 * verified, got ask). Exits non-zero when either rate is above the gates in
 * the domain thresholds, so a rubric change cannot ship past it.
 *
 *   ANTHROPIC_API_KEY=... pnpm eval:verification
 *   pnpm eval:verification -- --limit 20 --model claude-opus-5 --concurrency 4
 */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SPORTS, THRESHOLDS, customSport } from '@winarc/domain';
import { verifyProof, type ImageMediaType } from '@winarc/verifier';

const here = path.dirname(fileURLToPath(import.meta.url));

interface Case {
  id: string;
  rear: string;
  front: string;
  sport: string;
  health_matched?: boolean;
  expected: 'verified' | 'ask';
  tags?: string[];
}

interface Row {
  id: string;
  sport: string;
  expected: Case['expected'];
  got: 'verified' | 'ask';
  tier?: string;
  reason?: string;
  confidence?: number;
  latencyMs: number;
  tags: string[];
  error?: string;
}

const args = parseArgs(process.argv.slice(2));
const limit = Number(args.limit ?? Infinity);
const concurrency = Number(args.concurrency ?? 4);
const model = args.model;

async function main() {
  const casesPath = path.join(here, 'cases', 'cases.jsonl');
  const raw = await readFile(casesPath, 'utf8').catch(() => '');
  const cases = raw
    .split('\n')
    .filter((l) => l.trim() && !l.trim().startsWith('#'))
    .map((l) => JSON.parse(l) as Case)
    .slice(0, limit);

  if (cases.length === 0) {
    console.log('No cases yet. Add labeled proofs to evals/verification/cases (see README).');
    return;
  }

  const rows: Row[] = [];
  let next = 0;
  async function worker() {
    while (next < cases.length) {
      const c = cases[next++]!;
      rows.push(await runCase(c));
      process.stdout.write('.');
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, cases.length) }, worker));
  process.stdout.write('\n');

  const errors = rows.filter((r) => r.error);
  const scored = rows.filter((r) => !r.error);
  const shouldVerify = scored.filter((r) => r.expected === 'verified');
  const shouldAsk = scored.filter((r) => r.expected === 'ask');
  const falseReject = shouldVerify.filter((r) => r.got === 'ask').length / Math.max(1, shouldVerify.length);
  const falseAccept = shouldAsk.filter((r) => r.got === 'verified').length / Math.max(1, shouldAsk.length);
  const p50 = percentile(scored.map((r) => r.latencyMs), 0.5);

  console.table(
    rows.map((r) => ({
      id: r.id,
      sport: r.sport,
      expected: r.expected,
      got: r.got,
      tier: r.tier ?? '',
      reason: r.reason ?? '',
      conf: r.confidence?.toFixed(2) ?? '',
      ms: r.latencyMs,
      tags: r.tags.join(','),
      error: r.error ?? '',
    })),
  );

  const summary = {
    cases: rows.length,
    errors: errors.length,
    falseAccept,
    falseReject,
    gates: { falseAcceptMax: THRESHOLDS.evalFalseAcceptMax, falseRejectMax: THRESHOLDS.evalFalseRejectMax },
    latencyP50Ms: p50,
    model: model ?? process.env.VERIFY_MODEL ?? 'claude-opus-5',
    at: new Date().toISOString(),
  };
  console.log(JSON.stringify(summary, null, 2));

  const outDir = path.join(here, 'out');
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, 'report.json'), JSON.stringify({ summary, rows }, null, 2));

  const pass = falseAccept <= THRESHOLDS.evalFalseAcceptMax && falseReject <= THRESHOLDS.evalFalseRejectMax;
  console.log(pass ? 'PASS' : 'FAIL: rubric or thresholds need work before shipping');
  process.exitCode = pass ? 0 : 1;
}

async function runCase(c: Case): Promise<Row> {
  const sport = SPORTS[c.sport] ?? customSport(c.sport);
  const tags = c.tags ?? [];
  try {
    const [rear, front] = await Promise.all([loadImage(c.rear), loadImage(c.front)]);
    const report = await verifyProof(
      { rear, front },
      sport,
      { healthMatched: c.health_matched ?? false, verification: sport.verification },
      model ? { model } : {},
    );
    return {
      id: c.id,
      sport: c.sport,
      expected: c.expected,
      got: report.outcome.status,
      tier: report.outcome.status === 'verified' ? report.outcome.tier : undefined,
      reason: report.outcome.status === 'ask' ? report.outcome.reason : undefined,
      confidence: report.result?.confidence,
      latencyMs: report.latencyMs,
      tags,
      error: report.refused ? 'refused' : report.parseError,
    };
  } catch (e) {
    return { id: c.id, sport: c.sport, expected: c.expected, got: 'ask', latencyMs: 0, tags, error: (e as Error).message };
  }
}

async function loadImage(rel: string): Promise<{ base64: string; mediaType: ImageMediaType }> {
  const file = path.join(here, 'cases', rel);
  const bytes = await readFile(file);
  const mediaType: ImageMediaType = rel.endsWith('.png') ? 'image/png' : rel.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
  return { base64: bytes.toString('base64'), mediaType };
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? 0;
}

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith('--')) out[a.slice(2)] = argv[i + 1] && !argv[i + 1]!.startsWith('--') ? argv[++i]! : 'true';
  }
  return out;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
