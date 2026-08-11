import type { OneRepMaxFormula } from '@/lib/oneRepMax';

/** Persisted data contract. Indexed fields use `0 | 1` and sentinels, never null. */

export interface Syncable {
  id: string; // crypto.randomUUID()
  createdAt: number; // epoch ms
  updatedAt: number; // epoch ms — touched on every write
  deletedAt: number; // 0 = alive, otherwise epoch ms of the soft delete
}

/** Enumerable catalogue vocabulary shared by filters and seed validation. */
export const MUSCLE_GROUPS = [
  'chest',
  'lats',
  'upper_back',
  'traps',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'quads',
  'hamstrings',
  'glutes',
  'adductors',
  'calves',
  'abs',
  'lower_back',
  'neck',
  'full_body',
  'cardio',
  'other',
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const EQUIPMENT = [
  'barbell',
  'dumbbell',
  'machine',
  'cable',
  'smith',
  'bodyweight',
  'band',
  'kettlebell',
  'plate',
  'other',
] as const;

export type Equipment = (typeof EQUIPMENT)[number];

export const MEASUREMENT_TYPES = [
  'weight_reps', // bench press: weight + reps
  'reps_only', // bodyweight pull-ups
  'weight_time', // weighted plank
  'time_only', // plank
  'distance_time', // rower, treadmill
  'assisted_weight_reps', // assisted pull-ups (the weight helps)
] as const;

export type MeasurementType = (typeof MEASUREMENT_TYPES)[number];

export const SET_TYPES = ['normal', 'warmup', 'dropset', 'failure'] as const;

export type SetType = (typeof SET_TYPES)[number];

export type Side = 'both' | 'left' | 'right';

export interface Exercise extends Syncable {
  name: string;
  primaryMuscle: MuscleGroup;
  secondaryMuscles: MuscleGroup[]; // not indexed
  equipment: Equipment;
  measurementType: MeasurementType;
  isCustom: 0 | 1; // 1 = created by the user (RF-08)
  isUnilateral: 0 | 1; // audit recommendation M2
  /** Stable seed idempotency key; absent on custom exercises. */
  slug?: string;
  imageUrl?: string;
  instructions?: string;
  userNotes?: string; // RF-09: machine settings, bench height…
  defaultRestSeconds?: number; // RF-27: per-exercise rest
  /**
   * Smallest load jump for this exercise, in kilograms (Lot 18).
   * Not indexed — optional override; absent falls back to the equipment table
   * in `lib/loadIncrement.ts`. Same Dexie pattern as other optional fields:
   * no `.stores()` change is required.
   */
  loadIncrementKg?: number;
  /** Catalogue coefficient for effective bodyweight tonnage, when applicable. */
  bodyweightLoadFactor?: number;
}

export type ExternalExerciseSource = 'hevy_csv';

export interface ExternalExerciseBinding extends Syncable {
  source: ExternalExerciseSource;
  identityKey: string;
  sourceTitle: string;
  exerciseId: string;
  measurementType: MeasurementType;
  equipmentHint?: Equipment;
  verification: 'user';
  confirmedAt: number;
}

export interface RoutineFolder extends Syncable {
  name: string;
  order: number; // RF-12
}

export interface Routine extends Syncable {
  name: string;
  subtitle?: string;
  folderId: string; // '' when at the root
  order: number;
  notes?: string;
  version: number; // audit recommendation M3: versioning
  originRoutineId?: string; // points at v1 when versioned-duplicated
}

export interface RoutineExercise extends Syncable {
  routineId: string;
  exerciseId: string;
  order: number;
  supersetGroup: number; // 0 = no superset, otherwise group number (RF-14)
  restSeconds: number; // 0 = use the exercise default
  notes?: string;
}

export interface RoutineSet extends Syncable {
  routineExerciseId: string;
  order: number;
  setType: SetType;
  targetReps?: number;
  targetRepsMax?: number; // range 8-12 → targetReps=8, targetRepsMax=12
  /** Load, added weight, or assistance as defined by `measurementType`. */
  targetWeight?: number;
  targetDurationSeconds?: number;
  targetDistanceMeters?: number;
  targetRpe?: number;
}

export type WorkoutStatus = 'active' | 'completed' | 'discarded';

export interface Workout extends Syncable {
  routineId: string; // '' for an empty workout (RF-17)
  name: string;
  status: WorkoutStatus; // 'active' = resumed on startup (RF-25)
  startedAt: number;
  endedAt: number; // 0 until finished
  durationSeconds: number; // real time excluding pauses, computed on close
  notes?: string;
  deloadPercent?: number;
  importSource?: 'hevy_csv';
  importKey?: string;

  /** Minutes added to UTC at workout time; preserves the historical civil day. */
  startedTimezoneOffsetMinutes?: number;
}

export interface WorkoutExercise extends Syncable {
  workoutId: string;
  exerciseId: string;
  order: number;
  supersetGroup: number;
  notes?: string;

  /** Resolved once on session entry; always positive and independent of later edits. */
  restSeconds: number;

  /** Immutable exercise snapshot; optional for rows created before snapshots existed. */
  exerciseName?: string;
  exerciseMeasurementType?: MeasurementType;
  exercisePrimaryMuscle?: MuscleGroup;
  /**
   * Added after the four above, so a row may carry them and not this one.
   * Read by the body map only: every *count* in the app stays on the primary
   * muscle, because a count has to be checkable against the session.
   */
  exerciseSecondaryMuscles?: MuscleGroup[];
  exerciseEquipment?: Equipment;
  exerciseBodyweightLoadFactor?: number;
}

export interface WorkoutSet extends Syncable {
  workoutExerciseId: string;
  exerciseId: string; // DENORMALISED on purpose — cf. architecture §5
  workoutId: string; // DENORMALISED on purpose
  order: number;
  setType: SetType;
  side: Side;

  /** Performed values stay empty until explicitly entered or validated. */
  weight?: number; // always stored in KG (cf. §6)
  reps?: number;
  durationSeconds?: number;
  distanceMeters?: number;
  rpe?: number; // RF-30: 6 to 10 in steps of 0.5

  /** Routine targets copied at start so later routine edits cannot rewrite history. */
  targetReps?: number;
  targetRepsMax?: number;
  targetWeight?: number;
  targetDurationSeconds?: number;
  targetDistanceMeters?: number;

  isCompleted: 0 | 1;
  performedAt: number; // 0 until validated
}

export type PersonalRecordType =
  | 'max_weight'
  | 'max_added_weight'
  | 'min_assistance'
  | 'max_reps'
  | 'best_1rm'
  | 'max_volume_set'
  | 'max_volume_session'
  | 'max_duration'
  | 'max_distance';

export interface PersonalRecord extends Syncable {
  exerciseId: string;
  type: PersonalRecordType;
  value: number;
  achievedAt: number;
  workoutId: string;
  reps?: number; // context: 100 kg × 5 reps
  weight?: number;
  workoutSetId?: string;
  durationSeconds?: number;
  distanceMeters?: number;
  formula?: OneRepMaxFormula;
}

export interface BodyMeasurement extends Syncable {
  type: string; // 'body_weight' | 'body_fat' | 'waist' | … | custom field
  value: number;
  unit: string;
  measuredAt: number; // backdated entry allowed (audit recommendation M7)
  notes?: string;
}

export interface ProgressPhoto extends Syncable {
  blobKey: string; // key into the `photoBlobs` table
  thumbnailDataUrl: string; // base64 thumbnail for the grid view
  takenAt: number;
  pose?: string; // 'front' | 'side' | 'back'
  notes?: string;
}

/** M10 settings. Key/value table: adding a setting needs no migration. */
export interface Setting {
  key: string;
  value: unknown;
  updatedAt: number;
}
