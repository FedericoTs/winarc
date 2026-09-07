import { describe, expect, it } from 'vitest';
import { SEASON_ONE, pickSeason, seasonFromRow, type Season } from '../src';

const S00: Season = { id: 'S00', startsOn: '2026-09-08', arcDays: 14, locksOn: '2026-09-10', finaleOn: '2026-09-22' };

describe('pickSeason', () => {
  it('maps a database row to the domain shape', () => {
    expect(seasonFromRow({ id: 'S01', starts_on: '2026-10-01', arc_days: 90, locks_on: '2026-10-07', finale_on: '2026-12-31' })).toEqual(SEASON_ONE);
  });

  it('is the season whose window contains today, 30 days before the start through the finale', () => {
    expect(pickSeason([SEASON_ONE], '2026-09-01')?.id).toBe('S01');
    expect(pickSeason([SEASON_ONE], '2026-11-15')?.id).toBe('S01');
    expect(pickSeason([SEASON_ONE], '2026-12-31')?.id).toBe('S01');
  });

  it('prefers the latest start when two windows overlap, like season_on in SQL', () => {
    // On 12 Sep both S00 (on) and S01 (pre-season window from 1 Sep) contain the date; the later start wins.
    expect(pickSeason([S00, SEASON_ONE], '2026-09-12')?.id).toBe('S01');
    // With only the rehearsal season present it is the one shown.
    expect(pickSeason([S00], '2026-09-12')?.id).toBe('S00');
  });

  it('falls forward to the next season before any window opens, and to null after the last finale', () => {
    expect(pickSeason([SEASON_ONE], '2026-06-01')?.id).toBe('S01');
    expect(pickSeason([SEASON_ONE], '2027-01-02')).toBeNull();
    expect(pickSeason([], '2026-10-01')).toBeNull();
  });
});
