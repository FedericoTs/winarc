/**
 * Health port. HealthKit on iOS, Health Connect on Android. Both already
 * receive Garmin, Apple Watch, Withings, Oura and Whoop data, which is why
 * they are the verification sources and Strava is personal-only.
 *
 * Until an adapter is wired, the app runs in Silver mode: photo proofs only.
 *
 * To implement:
 *   iOS      @kingstinct/react-native-healthkit  (authorization, workouts, body mass)
 *   Android  react-native-health-connect         (ExerciseSession, Weight)
 * Map workout types with `workoutMatches` from @arc/domain.
 */
export interface WorkoutEvidence {
  /** HKWorkoutActivityType name or Health Connect exercise type. */
  type: string;
  minutes: number;
  start: string;
  end: string;
  source: 'healthkit' | 'health_connect';
}

export interface HealthPort {
  available(): Promise<boolean>;
  requestRead(): Promise<boolean>;
  workoutsBetween(start: Date, end: Date): Promise<WorkoutEvidence[]>;
  latestWeightKg(): Promise<{ kg: number; at: string } | null>;
}

const unavailable: HealthPort = {
  available: async () => false,
  requestRead: async () => false,
  workoutsBetween: async () => [],
  latestWeightKg: async () => null,
};

export const health: HealthPort = unavailable;

/** The strongest workout for a proof window, or null. */
export async function evidenceFor(capturedAt: Date, windowHours = 3): Promise<WorkoutEvidence | null> {
  const start = new Date(capturedAt.getTime() - windowHours * 3_600_000);
  const workouts = await health.workoutsBetween(start, capturedAt);
  return workouts.sort((a, b) => b.minutes - a.minutes)[0] ?? null;
}
