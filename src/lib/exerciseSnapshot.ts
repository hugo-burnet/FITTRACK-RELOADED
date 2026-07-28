import type { Exercise, WorkoutExercise } from '@/data/types';

/**
 * The exercise's identity, frozen onto the session row that used it.
 *
 * Pure by construction (architecture §7): an exercise in, four fields out. It
 * lives here rather than beside its repository because `db.ts` needs it for the
 * version 2 migration, and a repository importing `db` cannot be imported back
 * by `db` itself.
 */

/** The snapshot fields of `WorkoutExercise`, on their own. */
export type ExerciseSnapshot = Pick<
  WorkoutExercise,
  'exerciseName' | 'exerciseMeasurementType' | 'exercisePrimaryMuscle' | 'exerciseEquipment'
>;

/**
 * Spreadable into a `newEntity` payload.
 *
 * An absent exercise yields `{}` rather than placeholder strings: a row with no
 * snapshot falls back to the library, and a row carrying "Exercice inconnu"
 * would have destroyed that fallback by looking like a real answer. Nothing is
 * invented here — the function writes what it was handed, or nothing.
 */
export function snapshotOf(exercise: Exercise | undefined): ExerciseSnapshot {
  if (exercise === undefined) return {};

  return {
    exerciseName: exercise.name,
    exerciseMeasurementType: exercise.measurementType,
    exercisePrimaryMuscle: exercise.primaryMuscle,
    exerciseEquipment: exercise.equipment,
  };
}

/**
 * The snapshot a row already carries, ready to be spread into its replacement.
 *
 * Absent fields are dropped rather than copied as `undefined`: IndexedDB stores
 * the key either way, and a row holding `exerciseName: undefined` reads as
 * "snapshotted, name unknown" instead of "never snapshotted".
 */
export function exerciseSnapshotOfRow(row: WorkoutExercise): ExerciseSnapshot {
  return {
    ...(row.exerciseName === undefined ? {} : { exerciseName: row.exerciseName }),
    ...(row.exerciseMeasurementType === undefined
      ? {}
      : { exerciseMeasurementType: row.exerciseMeasurementType }),
    ...(row.exercisePrimaryMuscle === undefined
      ? {}
      : { exercisePrimaryMuscle: row.exercisePrimaryMuscle }),
    ...(row.exerciseEquipment === undefined ? {} : { exerciseEquipment: row.exerciseEquipment }),
  };
}
