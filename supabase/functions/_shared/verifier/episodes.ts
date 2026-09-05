import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import {
  EPISODE_RUBRIC,
  EPISODE_RUBRIC_VERSION,
  EpisodeTitleSchema,
  buildEpisodeInstruction,
  fallbackTitle,
  type EpisodeStats,
  type EpisodeTitle,
} from '@winarc/domain';
import { DEFAULT_MODEL, type VerifyOptions } from './index.ts';

/**
 * Titles one episode from its stats. No images, no names, no weight: the
 * model sees counts and sport names. Any failure falls back to a
 * deterministic title so an episode is always rendered.
 */

export interface EpisodeTitleReport extends EpisodeTitle {
  model: string;
  rubricVersion: string;
  latencyMs: number;
  usage: { input: number; output: number; cacheRead: number };
  fallback: boolean;
  refused: boolean;
}

function envModel(): string | undefined {
  const g = globalThis as { Deno?: { env: { get(k: string): string | undefined } }; process?: { env: Record<string, string | undefined> } };
  return g.Deno?.env.get('VERIFY_MODEL') ?? g.process?.env.VERIFY_MODEL;
}

export async function titleEpisode(stats: EpisodeStats, sports: string[], opts: VerifyOptions = {}): Promise<EpisodeTitleReport> {
  const client = opts.client ?? new Anthropic();
  const model = opts.model ?? envModel() ?? DEFAULT_MODEL;
  const started = Date.now();
  const fallback = fallbackTitle(stats);

  try {
    const response = await client.beta.messages.create({
      model,
      max_tokens: 256,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      thinking: { type: 'adaptive' },
      output_config: { effort: 'low', format: zodOutputFormat(EpisodeTitleSchema) },
      system: [{ type: 'text', text: EPISODE_RUBRIC, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: buildEpisodeInstruction(stats, sports) }],
    });
    const latencyMs = Date.now() - started;
    const usage = {
      input: response.usage.input_tokens,
      output: response.usage.output_tokens,
      cacheRead: response.usage.cache_read_input_tokens ?? 0,
    };
    if (response.stop_reason === 'refusal') {
      return { ...fallback, model: response.model, rubricVersion: EPISODE_RUBRIC_VERSION, latencyMs, usage, fallback: true, refused: true };
    }
    const text = response.content
      .filter((b): b is Extract<(typeof response.content)[number], { type: 'text' }> => b.type === 'text')
      .map((b) => b.text)
      .join('');
    const parsed = EpisodeTitleSchema.safeParse(safeJson(text));
    if (!parsed.success) {
      return { ...fallback, model: response.model, rubricVersion: EPISODE_RUBRIC_VERSION, latencyMs, usage, fallback: true, refused: false };
    }
    return { ...parsed.data, model: response.model, rubricVersion: EPISODE_RUBRIC_VERSION, latencyMs, usage, fallback: false, refused: false };
  } catch {
    return { ...fallback, model, rubricVersion: EPISODE_RUBRIC_VERSION, latencyMs: Date.now() - started, usage: { input: 0, output: 0, cacheRead: 0 }, fallback: true, refused: false };
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
