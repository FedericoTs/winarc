import { z } from 'zod';
import type { Sport, VerificationMethod } from './sports.ts';

/**
 * Proof verification. The model looks at the dual-cam capture and returns a
 * structured result; `decide` turns it into an outcome the app can act on.
 *
 * The app never "rejects" a person. Below the confidence floor it asks:
 * retake first, vouch second, appeal third. Nothing is charged on an ask.
 *
 * Tiers: Gold is Health evidence plus photo, Silver is photo only, Bronze is
 * vouched by two squadmates. All three count as a hit on the board.
 */

export const VerificationResultSchema = z.object({
  verdict: z.enum(['verified', 'unsure', 'rejected']),
  /** 0..1, how well the rear scene matches the declared sport. */
  sport_match: z.number().min(0).max(1),
  person_present: z.boolean(),
  /** A photo of a screen, a print, or an obviously old image. */
  recapture_suspected: z.boolean(),
  confidence: z.number().min(0).max(1),
  reasons: z.array(z.string().max(120)).max(5),
});

export type VerificationResult = z.infer<typeof VerificationResultSchema>;

export type Tier = 'GOLD' | 'SILVER' | 'BRONZE';

export type AskReason = 'unclear' | 'no_person' | 'recapture' | 'low_confidence';

export type Outcome =
  | { status: 'verified'; tier: 'GOLD' | 'SILVER' }
  | { status: 'ask'; reason: AskReason };

export const THRESHOLDS = {
  /** Model confidence needed to stamp without a human. */
  verify: 0.75,
  /** Minimum scene match for the declared sport. */
  sportMatch: 0.6,
  /** Recapture suspicion at or above this confidence triggers a retake ask. */
  recapture: 0.7,
  /** Eval gates: ship only when both hold on the labeled set. */
  evalFalseAcceptMax: 0.05,
  evalFalseRejectMax: 0.1,
} as const;

export interface DecisionContext {
  /** A wearable workout of a matching type and length landed inside the proof window. */
  healthMatched: boolean;
  verification: VerificationMethod;
}

export function decide(result: VerificationResult, ctx: DecisionContext): Outcome {
  if (result.recapture_suspected && result.confidence >= THRESHOLDS.recapture) {
    return { status: 'ask', reason: 'recapture' };
  }
  if (!result.person_present) return { status: 'ask', reason: 'no_person' };
  const clear = result.sport_match >= THRESHOLDS.sportMatch;
  if (result.verdict === 'verified' && result.confidence >= THRESHOLDS.verify && clear) {
    const gold = ctx.healthMatched && ctx.verification !== 'photo';
    return { status: 'verified', tier: gold ? 'GOLD' : 'SILVER' };
  }
  if (result.verdict === 'rejected' || !clear) return { status: 'ask', reason: 'unclear' };
  return { status: 'ask', reason: 'low_confidence' };
}

export const VOUCHERS_REQUIRED = 2;

export function vouchStatus(
  vouches: number,
): { status: 'verified'; tier: 'BRONZE' } | { status: 'pending'; needed: number } {
  if (vouches >= VOUCHERS_REQUIRED) return { status: 'verified', tier: 'BRONZE' };
  return { status: 'pending', needed: VOUCHERS_REQUIRED - vouches };
}

/** Copy the app shows on an ask. Never accuses. */
export function askCopy(reason: AskReason): { title: string; body: string } {
  const title = "We couldn't verify this one";
  switch (reason) {
    case 'recapture':
      return { title, body: 'This looks like a photo of a screen or an older picture. Nothing is charged. Retake it live, or ask your squad.' };
    case 'no_person':
      return { title, body: "We couldn't see you in the front camera. Nothing is charged. Retake with your face in frame, or ask your squad." };
    case 'unclear':
      return { title, body: "The scene doesn't clearly show the sport. Nothing is charged. Retake with the place in view, or ask your squad." };
    default:
      return { title, body: "We're not sure enough to stamp it. Nothing is charged. Retake, or ask your squad to vouch." };
  }
}

/** Bump when the rubric text changes; stored with every verification row. */
export const RUBRIC_VERSION = '2026-09-05.1';

/**
 * The system rubric. Stable text with no timestamps or ids so it can be
 * prompt-cached. The sport-specific part is short and goes in the user turn.
 */
export const RUBRIC = `You verify training proofs for a squad accountability app. Each proof is two photos taken one second apart by the app's own camera: the REAR image shows the place, the FRONT image shows the member.

Decide whether the rear image plausibly shows the declared sport being done now, and whether a real person is present in the front image. Be lenient about lighting, framing, mess and phone quality. Be strict about recaptures: a photo of a screen, a printed picture, a stock image, or an image with moiré, bezels, screen glare, a visible photo border or a mismatched second frame.

Never judge body shape, appearance, clothing, fitness level, age or gender. Reasons must describe the scene, never the person.

Return: verdict (verified, unsure, rejected), sport_match from 0 to 1 for the declared sport, person_present, recapture_suspected, confidence from 0 to 1 in your verdict, and up to five short reasons.`;

export function buildUserInstruction(sport: Pick<Sport, 'name' | 'word' | 'scene'>): string {
  return `Declared sport: ${sport.word} (${sport.name.toLowerCase()}). Typical scene: ${SCENE_HINTS[sport.scene]}. Assess the two images.`;
}

const SCENE_HINTS: Record<Sport['scene'], string> = {
  gym: 'weights, racks, machines, mats, a studio or a home setup',
  road: 'a road, track, trail, treadmill or bike, outdoors or indoors',
  water: 'a pool, open water, a rowing machine or a boat',
  wall: 'a climbing wall, holds, ropes, a boulder or rock',
  court: 'a court or pitch with lines, nets, goals or hoops',
  snow: 'slopes, trails, mountains, snow or hiking terrain',
  hyrox: 'sleds, rowers, ski ergs, wall balls, a functional fitness floor',
  custom: 'whatever the named activity usually looks like',
};
