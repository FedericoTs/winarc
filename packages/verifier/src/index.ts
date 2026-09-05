import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import {
  RUBRIC,
  RUBRIC_VERSION,
  VerificationResultSchema,
  buildUserInstruction,
  decide,
  type DecisionContext,
  type Outcome,
  type Sport,
  type VerificationResult,
} from '@arc/domain';

/**
 * Verifies one dual-cam proof. Runs unchanged in the Deno edge function and in
 * the Node eval runner so the two can never drift.
 *
 * A refusal or a parse failure is never a rejection: the member gets an ask
 * and nothing is charged.
 */

export type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/webp';

export interface ProofImage {
  base64: string;
  mediaType: ImageMediaType;
}

export interface ProofImages {
  rear: ProofImage;
  front: ProofImage;
}

export interface VerifyOptions {
  model?: string;
  client?: Anthropic;
}

export interface VerifyReport {
  result: VerificationResult | null;
  outcome: Outcome;
  model: string;
  rubricVersion: string;
  latencyMs: number;
  usage: { input: number; output: number; cacheRead: number };
  refused: boolean;
  parseError?: string;
}

export const DEFAULT_MODEL = 'claude-opus-5';

function envModel(): string | undefined {
  const g = globalThis as { Deno?: { env: { get(k: string): string | undefined } }; process?: { env: Record<string, string | undefined> } };
  return g.Deno?.env.get('VERIFY_MODEL') ?? g.process?.env.VERIFY_MODEL;
}

export async function verifyProof(
  images: ProofImages,
  sport: Pick<Sport, 'name' | 'word' | 'scene'>,
  ctx: DecisionContext,
  opts: VerifyOptions = {},
): Promise<VerifyReport> {
  const client = opts.client ?? new Anthropic();
  const model = opts.model ?? envModel() ?? DEFAULT_MODEL;
  const started = Date.now();

  const response = await client.beta.messages.create({
    model,
    max_tokens: 1024,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    thinking: { type: 'adaptive' },
    output_config: { effort: 'low', format: zodOutputFormat(VerificationResultSchema) },
    system: [{ type: 'text', text: RUBRIC, cache_control: { type: 'ephemeral' } }],
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'REAR image, the place:' },
          { type: 'image', source: { type: 'base64', media_type: images.rear.mediaType, data: images.rear.base64 } },
          { type: 'text', text: 'FRONT image, the member:' },
          { type: 'image', source: { type: 'base64', media_type: images.front.mediaType, data: images.front.base64 } },
          { type: 'text', text: buildUserInstruction(sport) },
        ],
      },
    ],
  });

  const latencyMs = Date.now() - started;
  const usage = {
    input: response.usage.input_tokens,
    output: response.usage.output_tokens,
    cacheRead: response.usage.cache_read_input_tokens ?? 0,
  };

  if (response.stop_reason === 'refusal') {
    return {
      result: null,
      outcome: { status: 'ask', reason: 'low_confidence' },
      model: response.model,
      rubricVersion: RUBRIC_VERSION,
      latencyMs,
      usage,
      refused: true,
    };
  }

  const text = response.content
    .filter((b): b is Extract<(typeof response.content)[number], { type: 'text' }> => b.type === 'text')
    .map((b) => b.text)
    .join('');

  const parsed = VerificationResultSchema.safeParse(safeJson(text));
  if (!parsed.success) {
    return {
      result: null,
      outcome: { status: 'ask', reason: 'low_confidence' },
      model: response.model,
      rubricVersion: RUBRIC_VERSION,
      latencyMs,
      usage,
      refused: false,
      parseError: parsed.error.message,
    };
  }

  return {
    result: parsed.data,
    outcome: decide(parsed.data, ctx),
    model: response.model,
    rubricVersion: RUBRIC_VERSION,
    latencyMs,
    usage,
    refused: false,
  };
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
