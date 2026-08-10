import type {
  Equipment,
  Exercise,
  MeasurementType,
  MuscleGroup,
  WorkoutExercise,
} from '@/data/types';

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
  | 'exerciseName'
  | 'exerciseMeasurementType'
  | 'exercisePrimaryMuscle'
  | 'exerciseEquipment'
  | 'exerciseBodyweightLoadFactor'
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
    ...(exercise.bodyweightLoadFactor === undefined
      ? {}
      : { exerciseBodyweightLoadFactor: exercise.bodyweightLoadFactor }),
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
    ...(row.exerciseBodyweightLoadFactor === undefined
      ? {}
      : { exerciseBodyweightLoadFactor: row.exerciseBodyweightLoadFactor }),
  };
}

/**
 * What an archived row *was*, as every reader of history must see it.
 *
 * Named without the `exercise` prefix the stored fields carry: this is no longer
 * a snapshot but the answer, wherever it came from.
 */
export interface ExerciseIdentity {
  name?: string;
  measurementType?: MeasurementType;
  primaryMuscle?: MuscleGroup;
  equipment?: Equipment;
  bodyweightLoadFactor?: number;
}

/** A live workout must always have a grid shape, even for a truly missing exercise. */
export interface WorkoutExerciseIdentity extends ExerciseIdentity {
  measurementType: MeasurementType;
}

/**
 * The snapshot wins, then today's library, then nothing. **Field by field.**
 *
 * The one rule every screen and every export reads a past session through, so
 * that they cannot answer differently — which is exactly what happened while the
 * export read the snapshot and the history screen read the library: after a
 * rename, the same session had two names in the same screen.
 *
 * Field by field rather than "snapshot or library, whole": the four fields were
 * added together but a row can carry a partial snapshot, and dropping to the
 * library for all four because one is missing would lose the three that are not.
 *
 * Absent keys rather than `undefined` ones: nothing is invented here. Naming the
 * gap in French belongs to the caller — `t('history.deletedExercise')` on a
 * screen, `t('export.unknownExercise')` in a document.
 */
export function resolveExerciseIdentity(
  row: WorkoutExercise,
  exercise: Exercise | undefined,
): ExerciseIdentity {
  const name = row.exerciseName ?? exercise?.name;
  const measurementType = row.exerciseMeasurementType ?? exercise?.measurementType;
  const primaryMuscle = row.exercisePrimaryMuscle ?? exercise?.primaryMuscle;
  const equipment = row.exerciseEquipment ?? exercise?.equipment;
  const bodyweightLoadFactor =
    row.exerciseBodyweightLoadFactor ?? exercise?.bodyweightLoadFactor;

  return {
    ...(name === undefined ? {} : { name }),
    ...(measurementType === undefined ? {} : { measurementType }),
    ...(primaryMuscle === undefined ? {} : { primaryMuscle }),
    ...(equipment === undefined ? {} : { equipment }),
    ...(bodyweightLoadFactor === undefined ? {} : { bodyweightLoadFactor }),
  };
}

/**
 * The historical identity used by every live-workout consumer.
 *
 * A row snapshot wins field by field, including over a soft-deleted library
 * row. The library row remains valid metadata for pre-snapshot workout rows.
 * Only a row absent from both sources takes the legacy `weight_reps` grid.
 */
export function resolveWorkoutExerciseIdentity(
  row: WorkoutExercise,
  exercise: Exercise | undefined,
): WorkoutExerciseIdentity {
  const identity = resolveExerciseIdentity(row, exercise);
  return {
    ...identity,
    measurementType: identity.measurementType ?? 'weight_reps',
  };
}
