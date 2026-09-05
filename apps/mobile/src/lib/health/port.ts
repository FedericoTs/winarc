/**
 * Health port. HealthKit on iOS, Health Connect on Android. Both already
 * receive Garmin, Apple Watch, Withings, Oura and Whoop data, which is why
 * they are the verification sources and Strava is personal-only.
 */
export interface WorkoutEvidence {
  /** HKWorkoutActivityType case name, or a Health Connect EXERCISE_TYPE_* name. */
  type: string;
  minutes: number;
  start: string;
  end: string;
  source: 'healthkit' | 'health_connect';
}

export interface HealthPort {
  available(): Promise<boolean>;
  /** Must run before any read; reading without authorization crashes on iOS. */
  requestRead(): Promise<boolean>;
  workoutsBetween(start: Date, end: Date): Promise<WorkoutEvidence[]>;
  latestWeightKg(): Promise<{ kg: number; at: string } | null>;
}

export const unavailable: HealthPort = {
  available: async () => false,
  requestRead: async () => false,
  workoutsBetween: async () => [],
  latestWeightKg: async () => null,
};

export function minutesBetween(start: Date, end: Date): number {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60_000));
}
