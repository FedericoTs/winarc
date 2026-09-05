import { ExerciseType, initialize, readRecords, requestPermission } from 'react-native-health-connect';
import { minutesBetween, type HealthPort, type WorkoutEvidence } from './port';

const TYPE_NAMES: Record<number, string> = Object.fromEntries(
  Object.entries(ExerciseType).map(([name, value]) => [value as number, `EXERCISE_TYPE_${name}`]),
);

/** Health Connect. Garmin, Samsung, Whoop and Oura all write here. */
export const health: HealthPort = {
  available: async () => {
    try {
      return await initialize();
    } catch {
      return false;
    }
  },

  requestRead: async () => {
    try {
      const granted = await requestPermission([
        { accessType: 'read', recordType: 'ExerciseSession' },
        { accessType: 'read', recordType: 'Weight' },
      ]);
      return granted.some((g) => 'recordType' in g && g.recordType === 'ExerciseSession');
    } catch {
      return false;
    }
  },

  workoutsBetween: async (start, end) => {
    const { records } = await readRecords('ExerciseSession', {
      timeRangeFilter: { operator: 'between', startTime: start.toISOString(), endTime: end.toISOString() },
    });
    const out: WorkoutEvidence[] = [];
    for (const r of records) {
      const s = new Date(r.startTime);
      const e = new Date(r.endTime);
      out.push({
        type: TYPE_NAMES[r.exerciseType] ?? `EXERCISE_TYPE_${r.exerciseType}`,
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
    const { records } = await readRecords('Weight', {
      timeRangeFilter: { operator: 'between', startTime: start.toISOString(), endTime: end.toISOString() },
    });
    const latest = [...records].sort((a, b) => (a.time < b.time ? 1 : -1))[0];
    if (!latest) return null;
    return { kg: latest.weight.inKilograms, at: new Date(latest.time).toISOString() };
  },
};
