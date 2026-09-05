import {
  WorkoutActivityType,
  getMostRecentQuantitySample,
  isHealthDataAvailableAsync,
  queryWorkoutSamples,
  requestAuthorization,
} from '@kingstinct/react-native-healthkit';
import { minutesBetween, type HealthPort, type WorkoutEvidence } from './port';

/** HealthKit. Workouts of any source count; the catalog decides which types match the sport. */
export const health: HealthPort = {
  available: () => isHealthDataAvailableAsync(),

  requestRead: async () => {
    try {
      return await requestAuthorization({ toRead: ['HKWorkoutTypeIdentifier', 'HKQuantityTypeIdentifierBodyMass'] });
    } catch {
      return false;
    }
  },

  workoutsBetween: async (start, end) => {
    const workouts = await queryWorkoutSamples({ filter: { date: { startDate: start, endDate: end } }, limit: 25, ascending: false });
    const out: WorkoutEvidence[] = [];
    for (const w of workouts) {
      const s = new Date(w.startDate);
      const e = new Date(w.endDate);
      out.push({
        type: WorkoutActivityType[w.workoutActivityType] ?? String(w.workoutActivityType),
        minutes: minutesBetween(s, e),
        start: s.toISOString(),
        end: e.toISOString(),
        source: 'healthkit',
      });
    }
    return out;
  },

  latestWeightKg: async () => {
    const sample = await getMostRecentQuantitySample('HKQuantityTypeIdentifierBodyMass', 'kg');
    if (!sample) return null;
    return { kg: sample.quantity, at: new Date(sample.endDate).toISOString() };
  },
};
