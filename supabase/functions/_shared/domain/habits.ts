import type { VerificationMethod } from './sports';

/**
 * Mind and money lines. Capped at two per contract so the product stays
 * fitness-led. Verification is by photo, self-attestation witnessed by the
 * squad, an artifact screenshot, or Health data.
 */

export type HabitKind = 'mind' | 'money';

export interface Habit {
  key: string;
  name: string;
  kind: HabitKind;
  perWeek: number;
  verification: VerificationMethod;
  custom?: boolean;
}

export const HABITS: Record<string, Habit> = {
  read: { key: 'read', name: 'Read 20 pages', kind: 'mind', perWeek: 7, verification: 'photo' },
  alcohol: { key: 'alcohol', name: 'No alcohol', kind: 'mind', perWeek: 7, verification: 'attest' },
  deep: { key: 'deep', name: 'Deep work 90 min', kind: 'money', perWeek: 5, verification: 'artifact' },
  ship: { key: 'ship', name: 'Ship one thing', kind: 'money', perWeek: 1, verification: 'artifact' },
  meditate: { key: 'meditate', name: 'Meditate 10 min', kind: 'mind', perWeek: 7, verification: 'attest' },
  journal: { key: 'journal', name: 'Journal', kind: 'mind', perWeek: 7, verification: 'photo' },
  sleep: { key: 'sleep', name: 'Sleep by 23:00', kind: 'mind', perWeek: 5, verification: 'health' },
  save: { key: 'save', name: 'Save 50 a week', kind: 'money', perWeek: 1, verification: 'artifact' },
  sugar: { key: 'sugar', name: 'No sugar', kind: 'mind', perWeek: 7, verification: 'attest' },
  cold: { key: 'cold', name: 'Cold shower', kind: 'mind', perWeek: 7, verification: 'attest' },
};

export const HABIT_KEYS: readonly string[] = Object.keys(HABITS);

export const CUSTOM_HABIT_PREFIX = 'X_';

export function customHabitKey(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .toLowerCase()
    .slice(0, 24);
  return `${CUSTOM_HABIT_PREFIX}${slug || 'habit'}`;
}

export function customHabit(
  name: string,
  verification: VerificationMethod,
  kind: HabitKind = 'mind',
  key = customHabitKey(name),
): Habit {
  const clean = name.trim().slice(0, 24);
  if (!clean) throw new Error('Custom habit needs a name');
  return { key, name: clean, kind, perWeek: verification === 'artifact' ? 1 : 7, verification, custom: true };
}
