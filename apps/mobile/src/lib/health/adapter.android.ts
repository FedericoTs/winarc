import { minutesBetween, unavailable, type HealthPort, type WorkoutEvidence } from './port';

type HealthConnect = typeof import('react-native-health-connect');

/**
 * Health Connect. Garmin, Samsung, Whoop and Oura all write here. The native
 * module exists only in a development or store build: in Expo Go the require
 * throws, the port reports unavailable, and every proof stays photo-only.
 */
function load(): HealthConnect | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-health-connect') as HealthConnect;
  } catch {
    return null;
  }
}

function healthConnect(hc: HealthConnect): HealthPort {
  const typeNames: Record<number, string> = Object.fromEntries(
    Object.entries(hc.ExerciseType).map(([name, value]) => [value as number, `EXERCISE_TYPE_${name}`]),
  );
  return {
    available: async () => {
      try {
        return await hc.initialize();
      } catch {
        return false;
      }
    },

    requestRead: async () => {
      try {
        const granted = await hc.requestPermission([
          { accessType: 'read', recordType: 'ExerciseSession' },
          { accessType: 'read', recordType: 'Weight' },
        ]);
        return granted.some((g) => 'recordType' in g && g.recordType === 'ExerciseSession');
      } catch {
        return false;
      }
    },

    workoutsBetween: async (start, end) => {
      const { records } = await hc.readRecords('ExerciseSession', {
        timeRangeFilter: { operator: 'between', startTime: start.toISOString(), endTime: end.toISOString() },
      });
      const out: WorkoutEvidence[] = [];
      for (const r of records) {
        const s = new Date(r.startTime);
        const e = new Date(r.endTime);
        out.push({
          type: typeNames[r.exerciseType] ?? `EXERCISE_TYPE_${r.exerciseType}`,
          minutes: minutesBetween(s, e),
          start: s.toISOString(),
          end: e.toISOString(),
          source: 'health_connect',
        });
      }
      return out;
    },

    latestWeightKg: async () => {
      const end = new Date();
      const start = new Date(end.getTime() - 30 * 86_400_000);
      const { records } = await hc.readRecords('Weight', {
        timeRangeFilter: { operator: 'between', startTime: start.toISOString(), endTime: end.toISOString() },
      });
      const latest = [...records].sort((a, b) => (a.time < b.time ? 1 : -1))[0];
      if (!latest) return null;
      return { kg: latest.weight.inKilograms, at: new Date(latest.time).toISOString() };
    },
  };
}

const hc = load();
export const health: HealthPort = hc ? healthConnect(hc) : unavailable;
