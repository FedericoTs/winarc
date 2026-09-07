/**
 * One real verification, end to end, from your machine:
 *
 *   cd evals/verification
 *   ANTHROPIC_API_KEY=... pnpm smoke -- cases/rear.jpg cases/front.jpg GYM [true]
 *
 * Paths resolve from this folder. cases/ is git-ignored, so photos put there
 * never reach the repository. The fourth argument simulates a matching
 * workout, which is what turns Silver into Gold.
 *
 * Prints the model's structured result, the decision the app would make, the
 * tier, tokens and latency. Costs about one cent on claude-opus-5.
 */
import { readFile } from 'node:fs/promises';
import { SPORTS, customSport } from '@winarc/domain';
import { verifyProof, type ImageMediaType } from '@winarc/verifier';

const [rearPath, frontPath, sportKey = 'GYM', health = 'false'] = process.argv.slice(2);
if (!rearPath || !frontPath) {
  console.error('usage: smoke <rear.jpg> <front.jpg> [SPORT] [healthMatched true|false]');
  process.exit(2);
}

function mediaType(p: string): ImageMediaType {
  return p.endsWith('.png') ? 'image/png' : p.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
}

const sport = SPORTS[sportKey] ?? customSport(sportKey);
const [rear, front] = await Promise.all([readFile(rearPath), readFile(frontPath)]);
const report = await verifyProof(
  { rear: { base64: rear.toString('base64'), mediaType: mediaType(rearPath) }, front: { base64: front.toString('base64'), mediaType: mediaType(frontPath) } },
  sport,
  { healthMatched: health === 'true', verification: sport.verification },
);
console.log(JSON.stringify(report, null, 2));
