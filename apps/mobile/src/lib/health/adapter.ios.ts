import { minutesBetween, unavailable, type HealthPort, type WorkoutEvidence } from './port';

type HealthKit = typeof import('@kingstinct/react-native-healthkit');

/**
 * HealthKit. Workouts of any source count; the catalog decides which types
 * match the sport. The native module exists only in a development or store
 * build: in Expo Go the require throws, the port reports unavailable, and
 * every proof stays photo-only.
 */
function load(): HealthKit | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@kingstinct/react-native-healthkit') as HealthKit;
  } catch {
    return null;
  }
}

function healthKit(hk: HealthKit): HealthPort {
  return {
    available: async () => {
      try {
        return await hk.isHealthDataAvailableAsync();
      } catch {
        return false;
      }
    },

    requestRead: async () => {
      try {
        return await hk.requestAuthorization({ toRead: ['HKWorkoutTypeIdentifier', 'HKQuantityTypeIdentifierBodyMass'] });
      } catch {
        return false;
      }
    },

    workoutsBetween: async (start, end) => {
      const workouts = await hk.queryWorkoutSamples({ filter: { date: { startDate: start, endDate: end } }, limit: 25, ascending: false });
      const out: WorkoutEvidence[] = [];
      for (const w of workouts) {
        const s = new Date(w.startDate);
        const e = new Date(w.endDate);
        out.push({
          type: hk.WorkoutActivityType[w.workoutActivityType] ?? String(w.workoutActivityType),
          minutes: minutesBetween(s, e),
          start: s.toISOString(),
          end: e.toISOString(),
          source: 'healthkit',
        });
      }
      return out;
    },

    latestWeightKg: async () => {
      const sample = await hk.getMostRecentQuantitySample('HKQuantityTypeIdentifierBodyMass', 'kg');
      if (!sample) return null;
      return { kg: sample.quantity, at: new Date(sample.endDate).toISOString() };
    },
  };
}

const hk = load();
export const health: HealthPort = hk ? healthKit(hk) : unavailable;
