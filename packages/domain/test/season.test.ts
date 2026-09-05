import { describe, it, expect } from 'vitest';
import {
  SEASON_ONE,
  addDays,
  dayOfSeason,
  endsOn,
  episodeAtDay,
  fortnightOfSeason,
  isLocked,
  localISODate,
  phaseOn,
  settlementDays,
  weekOfSeason,
} from '../src/season';

describe('season one calendar', () => {
  it('starts 1 Oct and runs 90 days to 29 Dec', () => {
    expect(dayOfSeason('2026-10-01')).toBe(1);
    expect(dayOfSeason('2026-10-12')).toBe(12);
    expect(dayOfSeason('2026-12-29')).toBe(90);
    expect(endsOn()).toBe('2026-12-29');
    expect(SEASON_ONE.finaleOn).toBe('2026-12-31');
  });

  it('weeks end on Sundays and week one is short', () => {
    expect(weekOfSeason('2026-09-30')).toBe(0);
    expect(weekOfSeason('2026-10-01')).toBe(1);
    expect(weekOfSeason('2026-10-04')).toBe(1);
    expect(weekOfSeason('2026-10-05')).toBe(2);
    expect(weekOfSeason('2026-10-11')).toBe(2);
    expect(weekOfSeason('2026-10-12')).toBe(3);
    expect(fortnightOfSeason('2026-10-12')).toBe(2);
  });

  it('settles every Sunday and on the finale', () => {
    const days = settlementDays();
    expect(days[0]).toBe('2026-10-04');
    expect(days[12]).toBe('2026-12-27');
    expect(days.at(-1)).toBe('2026-12-31');
    expect(days).toHaveLength(14);
  });

  it('knows its phases and the lock date', () => {
    expect(phaseOn('2026-09-05')).toBe('upcoming');
    expect(phaseOn('2026-10-01')).toBe('live');
    expect(phaseOn('2026-12-29')).toBe('live');
    expect(phaseOn('2026-12-30')).toBe('finale');
    expect(phaseOn('2026-12-31')).toBe('finale');
    expect(phaseOn('2027-01-01')).toBe('ended');
    expect(isLocked('2026-10-06')).toBe(false);
    expect(isLocked('2026-10-07')).toBe(true);
  });

  it('places episodes at days 30, 60 and 90', () => {
    expect(episodeAtDay(30)).toBe(1);
    expect(episodeAtDay(60)).toBe(2);
    expect(episodeAtDay(90)).toBe(3);
    expect(episodeAtDay(31)).toBeNull();
  });

  it('derives the local date from the member timezone', () => {
    const at = new Date('2026-10-01T22:30:00Z');
    expect(localISODate(at, 'Europe/Rome')).toBe('2026-10-02');
    expect(localISODate(at, 'America/Chicago')).toBe('2026-10-01');
  });

  it('adds days across month ends', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-10-01', 89)).toBe('2026-12-29');
  });
});
