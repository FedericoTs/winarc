import { describe, expect, it } from 'vitest';
import { EpisodeTitleSchema, buildEpisodeInstruction, episodeStats, episodeWindow, episodesUnlocked, fallbackTitle, type EpisodeMark } from '../src';

const fixture: EpisodeMark[] = [
  { day: 1, mark: 'V', tier: 'GOLD' },
  { day: 1, mark: 'V', tier: 'SILVER' },
  { day: 2, mark: 'V', tier: 'SILVER' },
  { day: 3, mark: 'X' },
  { day: 3, mark: 'V', tier: 'SILVER' },
  { day: 4, mark: 'S' },
  { day: 5, mark: 'B', tier: 'BRONZE' },
  { day: 6, mark: 'V', tier: 'GOLD' },
  { day: 7, mark: 'R' },
  { day: 8, mark: 'V', tier: 'SILVER' },
  { day: 31, mark: 'V', tier: 'GOLD' }, // next episode, ignored
];

describe('episode windows', () => {
  it('cuts the arc into three chapters of thirty days', () => {
    expect(episodeWindow(1)).toEqual({ fromDay: 1, toDay: 30 });
    expect(episodeWindow(2)).toEqual({ fromDay: 31, toDay: 60 });
    expect(episodeWindow(3)).toEqual({ fromDay: 61, toDay: 90 });
    expect(episodesUnlocked(29)).toEqual([]);
    expect(episodesUnlocked(30)).toEqual([1]);
    expect(episodesUnlocked(90)).toEqual([1, 2, 3]);
  });
});

describe('episode stats', () => {
  it('counts proofs by tier, misses and sick days, and the best clean streak', () => {
    const s = episodeStats(1, fixture);
    expect(s).toMatchObject({ number: 1, from_day: 1, to_day: 30, proofs: 7, gold: 2, silver: 4, bronze: 1, misses: 1, sick_days: 1, due: 8, days_proved: 6 });
    expect(s.hit_rate).toBe(0.875);
    // Days 1 and 2 clean, day 3 has a miss, days 5, 6 and 8 clean (4 and 7 have nothing due).
    expect(s.best_streak).toBe(3);
  });

  it('treats an empty chapter as a hit rate of one and titles it quietly', () => {
    const s = episodeStats(2, fixture.filter((m) => m.day < 31));
    expect(s).toMatchObject({ proofs: 0, due: 0, hit_rate: 1, best_streak: 0 });
    expect(fallbackTitle(s)).toEqual({ title: 'Day one energy', line: 'Days 31 to 60. Nothing due yet.' });
  });

  it('falls back to a deterministic title by band, and the model schema bounds the card', () => {
    const clean = fallbackTitle(episodeStats(1, fixture.filter((m) => m.mark !== 'X')));
    expect(clean.title).toBe('No excuses');
    expect(EpisodeTitleSchema.safeParse(clean).success).toBe(true);
    expect(EpisodeTitleSchema.safeParse({ title: 'x'.repeat(40), line: 'ok' }).success).toBe(false);
    const text = buildEpisodeInstruction(episodeStats(1, fixture), ['Gym sessions', 'Runs']);
    expect(text).toContain('Sports: Gym sessions, Runs.');
    expect(text).toContain('Hit rate: 88%');
    expect(text).not.toMatch(/kg|weight/i);
  });
});
