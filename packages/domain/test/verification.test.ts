import { describe, it, expect } from 'vitest';
import {
  RUBRIC,
  VerificationResultSchema,
  askCopy,
  buildUserInstruction,
  decide,
  vouchStatus,
} from '../src/verification';
import { SPORTS } from '../src/sports';

const base = {
  verdict: 'verified' as const,
  sport_match: 0.9,
  person_present: true,
  recapture_suspected: false,
  confidence: 0.9,
  reasons: ['rack and plates visible'],
};
const ctx = { healthMatched: false, verification: 'health_photo' as const };

describe('verification decisions', () => {
  it('parses model output strictly', () => {
    expect(VerificationResultSchema.parse(base)).toEqual(base);
    expect(() => VerificationResultSchema.parse({ ...base, confidence: 1.2 })).toThrow();
    expect(() => VerificationResultSchema.parse({ ...base, verdict: 'maybe' })).toThrow();
  });

  it('stamps gold with matching health data and silver without', () => {
    expect(decide(base, { healthMatched: true, verification: 'health_photo' })).toEqual({ status: 'verified', tier: 'GOLD' });
    expect(decide(base, ctx)).toEqual({ status: 'verified', tier: 'SILVER' });
    expect(decide(base, { healthMatched: true, verification: 'photo' })).toEqual({ status: 'verified', tier: 'SILVER' });
  });

  it('asks instead of rejecting', () => {
    expect(decide({ ...base, recapture_suspected: true }, ctx)).toEqual({ status: 'ask', reason: 'recapture' });
    expect(decide({ ...base, recapture_suspected: true, confidence: 0.5 }, ctx)).toEqual({ status: 'ask', reason: 'low_confidence' });
    expect(decide({ ...base, person_present: false }, ctx)).toEqual({ status: 'ask', reason: 'no_person' });
    expect(decide({ ...base, verdict: 'rejected' }, ctx)).toEqual({ status: 'ask', reason: 'unclear' });
    expect(decide({ ...base, sport_match: 0.3 }, ctx)).toEqual({ status: 'ask', reason: 'unclear' });
    expect(decide({ ...base, verdict: 'unsure' }, ctx)).toEqual({ status: 'ask', reason: 'low_confidence' });
    expect(decide({ ...base, confidence: 0.7 }, ctx)).toEqual({ status: 'ask', reason: 'low_confidence' });
  });

  it('needs two squadmates for a bronze', () => {
    expect(vouchStatus(1)).toEqual({ status: 'pending', needed: 1 });
    expect(vouchStatus(2)).toEqual({ status: 'verified', tier: 'BRONZE' });
  });

  it('never accuses and never charges on an ask', () => {
    for (const reason of ['unclear', 'no_person', 'recapture', 'low_confidence'] as const) {
      const copy = askCopy(reason);
      expect(copy.body).toMatch(/Nothing is charged/);
      expect(copy.body).not.toMatch(/fake|cheat|lie|fraud/i);
    }
  });

  it('keeps the rubric cacheable and the sport in the user turn', () => {
    expect(RUBRIC).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(RUBRIC).toMatch(/Never judge body shape/);
    expect(buildUserInstruction(SPORTS.GYM!)).toMatch(/Declared sport: Gym/);
  });
});
