import { create } from 'zustand';
import type { ContractInput, PotRule, VerificationMethod } from '@winarc/domain';

/**
 * Onboarding state until the contract is signed. After that the database is
 * the source of truth and screens query it.
 */
export interface OnboardingState {
  sports: string[];
  customSports: { key: string; name: string }[];
  perWeek: Record<string, number>;
  days: Record<string, number[]>;
  weighIn: boolean;
  habits: string[];
  customHabits: { key: string; name: string; verification: VerificationMethod }[];
  squad: {
    id: string | null;
    code: string | null;
    name: string;
    size: number;
    stakeCents: number;
    potRule: PotRule;
    currency: 'EUR' | 'USD';
    role: 'founder' | 'member' | null;
  };
  toggleSport(key: string): void;
  addCustomSport(key: string, name: string): void;
  setPerWeek(key: string, n: number): void;
  setDays(key: string, days: number[]): void;
  setWeighIn(on: boolean): void;
  toggleHabit(key: string): void;
  addCustomHabit(key: string, name: string, verification: VerificationMethod): void;
  setSquad(patch: Partial<OnboardingState['squad']>): void;
  contractInput(): ContractInput;
  reset(): void;
}

const initial = {
  sports: ['GYM'],
  customSports: [],
  perWeek: {},
  days: {},
  weighIn: true,
  habits: [],
  customHabits: [],
  squad: {
    id: null,
    code: null,
    name: '',
    size: 5,
    stakeCents: 1000,
    potRule: 'pot' as PotRule,
    currency: 'EUR' as const,
    role: null,
  },
};

export const useOnboarding = create<OnboardingState>((set, get) => ({
  ...initial,
  toggleSport: (key) =>
    set((s) => {
      if (s.sports.includes(key)) return s.sports.length > 1 ? { sports: s.sports.filter((k) => k !== key) } : s;
      return s.sports.length < 3 ? { sports: [...s.sports, key] } : s;
    }),
  addCustomSport: (key, name) =>
    set((s) => ({
      customSports: [...s.customSports.filter((c) => c.key !== key), { key, name }],
      sports: s.sports.includes(key) || s.sports.length >= 3 ? s.sports : [...s.sports, key],
    })),
  setPerWeek: (key, n) => set((s) => ({ perWeek: { ...s.perWeek, [key]: n }, days: omit(s.days, key) })),
  setDays: (key, days) => set((s) => ({ days: { ...s.days, [key]: days } })),
  setWeighIn: (on) => set({ weighIn: on }),
  toggleHabit: (key) =>
    set((s) => {
      if (s.habits.includes(key)) return { habits: s.habits.filter((k) => k !== key) };
      return s.habits.length < 2 ? { habits: [...s.habits, key] } : s;
    }),
  addCustomHabit: (key, name, verification) =>
    set((s) => ({
      customHabits: [...s.customHabits.filter((c) => c.key !== key), { key, name, verification }],
      habits: s.habits.includes(key) || s.habits.length >= 2 ? s.habits : [...s.habits, key],
    })),
  setSquad: (patch) => set((s) => ({ squad: { ...s.squad, ...patch } })),
  contractInput: () => {
    const s = get();
    return {
      sports: s.sports,
      customSports: s.customSports,
      perWeek: s.perWeek,
      days: s.days,
      weighIn: s.weighIn,
      habits: s.habits,
      customHabits: s.customHabits,
    };
  },
  reset: () => set({ ...initial }),
}));

function omit<T extends Record<string, unknown>>(obj: T, key: string): T {
  const copy = { ...obj };
  delete copy[key];
  return copy;
}
