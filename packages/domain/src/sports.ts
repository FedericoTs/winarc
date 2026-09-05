/**
 * Sport catalog. Verification is sport-agnostic; identity is sport-specific.
 * Each preset maps to the wearable workout types that can turn a photo proof
 * into a Gold proof. Custom sports verify by photo and by Health when the
 * watch logs them under any workout type.
 *
 * `healthKit` names are HKWorkoutActivityType cases; `healthConnect` names are
 * ExerciseSessionRecord exercise types. Verify both lists against the SDK
 * constants when wiring the connectors.
 */

export type VerificationMethod = 'health_photo' | 'photo' | 'health' | 'attest' | 'artifact';

export type Scene = 'gym' | 'road' | 'water' | 'wall' | 'court' | 'snow' | 'hyrox' | 'custom';

export interface Sport {
  key: string;
  /** Line name on the contract, plural. */
  name: string;
  /** Short word for HUDs and stamps. */
  word: string;
  sessionsPerWeek: number;
  verification: VerificationMethod;
  scene: Scene;
  healthKit: string[];
  healthConnect: string[];
  /** A logged workout shorter than this does not count as Health evidence. */
  minMinutes: number;
  custom?: boolean;
}

const HP: VerificationMethod = 'health_photo';

export const SPORTS: Record<string, Sport> = {
  GYM: { key: 'GYM', name: 'Gym sessions', word: 'Gym', sessionsPerWeek: 4, verification: HP, scene: 'gym', healthKit: ['traditionalStrengthTraining', 'functionalStrengthTraining'], healthConnect: ['EXERCISE_TYPE_STRENGTH_TRAINING'], minMinutes: 25 },
  RUN: { key: 'RUN', name: 'Runs', word: 'Run', sessionsPerWeek: 3, verification: HP, scene: 'road', healthKit: ['running'], healthConnect: ['EXERCISE_TYPE_RUNNING', 'EXERCISE_TYPE_RUNNING_TREADMILL'], minMinutes: 20 },
  HYROX: { key: 'HYROX', name: 'Hyrox sessions', word: 'Hyrox', sessionsPerWeek: 3, verification: HP, scene: 'hyrox', healthKit: ['mixedCardio', 'functionalStrengthTraining', 'crossTraining'], healthConnect: ['EXERCISE_TYPE_HIGH_INTENSITY_INTERVAL_TRAINING', 'EXERCISE_TYPE_STRENGTH_TRAINING'], minMinutes: 30 },
  CROSSFIT: { key: 'CROSSFIT', name: 'WODs', word: 'WOD', sessionsPerWeek: 4, verification: HP, scene: 'hyrox', healthKit: ['crossTraining', 'functionalStrengthTraining', 'highIntensityIntervalTraining'], healthConnect: ['EXERCISE_TYPE_HIGH_INTENSITY_INTERVAL_TRAINING', 'EXERCISE_TYPE_STRENGTH_TRAINING'], minMinutes: 25 },
  CALISTHENICS: { key: 'CALISTHENICS', name: 'Calisthenics sessions', word: 'Calisthenics', sessionsPerWeek: 3, verification: HP, scene: 'gym', healthKit: ['functionalStrengthTraining', 'coreTraining'], healthConnect: ['EXERCISE_TYPE_CALISTHENICS'], minMinutes: 20 },
  CLIMB: { key: 'CLIMB', name: 'Climbing sessions', word: 'Climb', sessionsPerWeek: 2, verification: HP, scene: 'wall', healthKit: ['climbing'], healthConnect: ['EXERCISE_TYPE_ROCK_CLIMBING'], minMinutes: 30 },
  SWIM: { key: 'SWIM', name: 'Swims', word: 'Swim', sessionsPerWeek: 2, verification: HP, scene: 'water', healthKit: ['swimming'], healthConnect: ['EXERCISE_TYPE_SWIMMING_POOL', 'EXERCISE_TYPE_SWIMMING_OPEN_WATER'], minMinutes: 20 },
  RIDE: { key: 'RIDE', name: 'Rides', word: 'Ride', sessionsPerWeek: 2, verification: HP, scene: 'road', healthKit: ['cycling'], healthConnect: ['EXERCISE_TYPE_BIKING', 'EXERCISE_TYPE_BIKING_STATIONARY'], minMinutes: 30 },
  TRI: { key: 'TRI', name: 'Tri sessions', word: 'Tri', sessionsPerWeek: 5, verification: HP, scene: 'water', healthKit: ['swimming', 'cycling', 'running'], healthConnect: ['EXERCISE_TYPE_SWIMMING_POOL', 'EXERCISE_TYPE_BIKING', 'EXERCISE_TYPE_RUNNING'], minMinutes: 30 },
  ROWING: { key: 'ROWING', name: 'Rows', word: 'Row', sessionsPerWeek: 3, verification: HP, scene: 'water', healthKit: ['rowing'], healthConnect: ['EXERCISE_TYPE_ROWING', 'EXERCISE_TYPE_ROWING_MACHINE'], minMinutes: 20 },
  HIIT: { key: 'HIIT', name: 'HIIT sessions', word: 'HIIT', sessionsPerWeek: 3, verification: HP, scene: 'gym', healthKit: ['highIntensityIntervalTraining'], healthConnect: ['EXERCISE_TYPE_HIGH_INTENSITY_INTERVAL_TRAINING'], minMinutes: 15 },
  YOGA: { key: 'YOGA', name: 'Yoga', word: 'Yoga', sessionsPerWeek: 3, verification: 'photo', scene: 'gym', healthKit: ['yoga'], healthConnect: ['EXERCISE_TYPE_YOGA'], minMinutes: 20 },
  PILATES: { key: 'PILATES', name: 'Pilates', word: 'Pilates', sessionsPerWeek: 2, verification: 'photo', scene: 'gym', healthKit: ['pilates'], healthConnect: ['EXERCISE_TYPE_PILATES'], minMinutes: 20 },
  MMA: { key: 'MMA', name: 'Fight training', word: 'Training', sessionsPerWeek: 3, verification: 'photo', scene: 'gym', healthKit: ['martialArts'], healthConnect: ['EXERCISE_TYPE_MARTIAL_ARTS'], minMinutes: 30 },
  BOXING: { key: 'BOXING', name: 'Boxing sessions', word: 'Boxing', sessionsPerWeek: 3, verification: HP, scene: 'gym', healthKit: ['boxing'], healthConnect: ['EXERCISE_TYPE_BOXING'], minMinutes: 30 },
  PADEL: { key: 'PADEL', name: 'Padel matches', word: 'Padel', sessionsPerWeek: 2, verification: 'photo', scene: 'court', healthKit: ['tennis', 'racquetball', 'squash'], healthConnect: ['EXERCISE_TYPE_TENNIS', 'EXERCISE_TYPE_RACQUETBALL', 'EXERCISE_TYPE_SQUASH'], minMinutes: 40 },
  TENNIS: { key: 'TENNIS', name: 'Tennis sessions', word: 'Tennis', sessionsPerWeek: 2, verification: HP, scene: 'court', healthKit: ['tennis'], healthConnect: ['EXERCISE_TYPE_TENNIS'], minMinutes: 40 },
  FOOTBALL: { key: 'FOOTBALL', name: 'Football sessions', word: 'Football', sessionsPerWeek: 2, verification: HP, scene: 'court', healthKit: ['soccer'], healthConnect: ['EXERCISE_TYPE_SOCCER'], minMinutes: 45 },
  BASKETBALL: { key: 'BASKETBALL', name: 'Basketball runs', word: 'Basketball', sessionsPerWeek: 2, verification: HP, scene: 'court', healthKit: ['basketball'], healthConnect: ['EXERCISE_TYPE_BASKETBALL'], minMinutes: 40 },
  SKI: { key: 'SKI', name: 'Ski days', word: 'Ski', sessionsPerWeek: 1, verification: HP, scene: 'snow', healthKit: ['downhillSkiing', 'crossCountrySkiing', 'snowboarding'], healthConnect: ['EXERCISE_TYPE_SKIING', 'EXERCISE_TYPE_SNOWBOARDING'], minMinutes: 60 },
  HIKE: { key: 'HIKE', name: 'Hikes', word: 'Hike', sessionsPerWeek: 1, verification: HP, scene: 'snow', healthKit: ['hiking'], healthConnect: ['EXERCISE_TYPE_HIKING'], minMinutes: 45 },
  WALK: { key: 'WALK', name: '10k steps', word: 'Walk', sessionsPerWeek: 7, verification: 'health', scene: 'road', healthKit: ['walking'], healthConnect: ['EXERCISE_TYPE_WALKING'], minMinutes: 0 },
};

export const SPORT_KEYS: readonly string[] = Object.keys(SPORTS);

export const CUSTOM_PREFIX = 'C_';

export function isCustomSportKey(key: string): boolean {
  return key.startsWith(CUSTOM_PREFIX);
}

export function customSportKey(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .toUpperCase()
    .slice(0, 24);
  return `${CUSTOM_PREFIX}${slug || 'SPORT'}`;
}

/** A member-named sport. Photo by default; Health counts under any workout type. */
export function customSport(name: string, key = customSportKey(name)): Sport {
  const clean = name.trim().slice(0, 22);
  if (!clean) throw new Error('Custom sport needs a name');
  return {
    key,
    name: `${clean} sessions`,
    word: clean,
    sessionsPerWeek: 3,
    verification: 'health_photo',
    scene: 'custom',
    healthKit: ['*'],
    healthConnect: ['*'],
    minMinutes: 20,
    custom: true,
  };
}

/** True when a logged workout type counts as evidence for the sport. */
export function workoutMatches(sport: Sport, workoutType: string, minutes: number): boolean {
  if (minutes < sport.minMinutes) return false;
  if (sport.healthKit.includes('*') || sport.healthConnect.includes('*')) return true;
  return sport.healthKit.includes(workoutType) || sport.healthConnect.includes(workoutType);
}
