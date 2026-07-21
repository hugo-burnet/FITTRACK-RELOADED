/**
 * The data contract every later lot consumes. Mirrors §4 of
 * `docs/plans/01-ARCHITECTURE.md` — including the entities of later lots, which
 * cost nothing to declare now and would cost a migration later.
 *
 * Two typing rules come straight from IndexedDB (§3) and are not stylistic:
 * an indexed field is never a boolean (`0 | 1`) and never `null` (`0` / `''`).
 * A `null` in an index makes the row vanish from that index: it exists, but no
 * query finds it.
 */

/** Fields carried by every persisted entity. */
export interface Syncable {
  id: string; // crypto.randomUUID()
  createdAt: number; // epoch ms
  updatedAt: number; // epoch ms — touched on every write
  deletedAt: number; // 0 = alive, otherwise epoch ms of the soft delete
}

/**
 * The three catalogue vocabularies are declared as const arrays, not bare
 * unions: the filter chips of Lot 3 need to enumerate them, and the seed test
 * checks every catalogue row against them. One source of truth, so a typo in
 * `exercises.json` fails the suite instead of producing an exercise no filter
 * can ever find.
 */
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

/** Decides which input fields the live workout screen shows. */
export const MEASUREMENT_TYPES = [
  'weight_reps', // bench press: weight + reps
  'reps_only', // bodyweight pull-ups
  'weight_time', // weighted plank
  'time_only', // plank
  'distance_time', // rower, treadmill
  'assisted_weight_reps', // assisted pull-ups (the weight helps)
] as const;

export type MeasurementType = (typeof MEASUREMENT_TYPES)[number];

export type SetType = 'normal' | 'warmup' | 'dropset' | 'failure';

export type Side = 'both' | 'left' | 'right';

export interface Exercise extends Syncable {
  name: string;
  primaryMuscle: MuscleGroup;
  secondaryMuscles: MuscleGroup[]; // not indexed
  equipment: Equipment;
  measurementType: MeasurementType;
  isCustom: 0 | 1; // 1 = created by the user (RF-08)
  isUnilateral: 0 | 1; // audit recommendation M2
  /**
   * Stable catalogue key, absent on user-created exercises. It is the seed's
   * idempotency key: without it a re-run cannot tell "new exercise" from
   * "already there" and duplicates the whole catalogue. Not indexed.
   */
  slug?: string;
  imageUrl?: string;
  instructions?: string;
  userNotes?: string; // RF-09: machine settings, bench height…
  defaultRestSeconds?: number; // RF-27: per-exercise rest
}

export interface RoutineFolder extends Syncable {
  name: string;
  order: number; // RF-12
}

export interface Routine extends Syncable {
  name: string;
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

/** One row = one planned set. Allows a 5x5 at varying loads and planned warm-ups. */
export interface RoutineSet extends Syncable {
  routineExerciseId: string;
  order: number;
  setType: SetType;
  targetReps?: number;
  targetRepsMax?: number; // range 8-12 → targetReps=8, targetRepsMax=12
  targetWeight?: number;
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
}

export interface WorkoutExercise extends Syncable {
  workoutId: string;
  exerciseId: string;
  order: number;
  supersetGroup: number;
  notes?: string;
}

export interface WorkoutSet extends Syncable {
  workoutExerciseId: string;
  exerciseId: string; // DENORMALISED on purpose — cf. architecture §5
  workoutId: string; // DENORMALISED on purpose
  order: number;
  setType: SetType;
  side: Side;
  weight?: number; // always stored in KG (cf. §6)
  reps?: number;
  durationSeconds?: number;
  distanceMeters?: number;
  rpe?: number; // RF-30: 6 to 10 in steps of 0.5
  isCompleted: 0 | 1;
  performedAt: number; // 0 until validated
}

export type PersonalRecordType =
  'max_weight' | 'max_reps' | 'best_1rm' | 'max_volume_set' | 'max_volume_session';

export interface PersonalRecord extends Syncable {
  exerciseId: string;
  type: PersonalRecordType;
  value: number;
  reps?: number; // context: 100 kg × 5 reps
  weight?: number;
  workoutSetId: string;
  achievedAt: number;
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
