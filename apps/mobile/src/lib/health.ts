export * from './health/port';
export { health } from './health/adapter';
import { health } from './health/adapter';
import type { WorkoutEvidence } from './health/port';

/** The longest workout that ended inside the proof window, or null. */
export async function evidenceFor(capturedAt: Date, windowHours = 3): Promise<WorkoutEvidence | null> {
  if (!(await health.available())) return null;
  const start = new Date(capturedAt.getTime() - windowHours * 3_600_000);
  const workouts = await health.workoutsBetween(start, capturedAt);
  return workouts.sort((a, b) => b.minutes - a.minutes)[0] ?? null;
}
