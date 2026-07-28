import type { WorkoutSet } from '@/data/types';
import { measurementShape, type TargetField } from '@/lib/measurement';
import { isWorkingSet } from '@/lib/records';
import { isoWithOffset, localDateKey, localOffsetMinutes } from '@/lib/timezone';
import { sessionTotals } from '@/lib/volume';
import type {
  CoachExport,
  ExportExercise,
  ExportOptions,
  ExportScope,
  ExportSet,
  ExportSource,
  ExportWorkout,
} from './types';

/**
 * Rows in, a shareable document out. Pure by construction (architecture §7):
 * nothing here reads Dexie, nothing here writes French.
 *
 * It is also the first consumer of the exercise snapshot (milestone 08A), which
 * is why the fallback rule lives here and is tested without a database: the one
 * thing this layer must guarantee is that exporting a session twice, a rename
 * apart, produces the same document.
 */

/** The snapshot wins, then today's library, then nothing. Field by field. */
function identityOf(entry: ExportSource['exercises'][number]): Omit<ExportExercise, 'sets'> {
  const { row, exercise } = entry;

  return {
    ...(row.exerciseName ?? exercise?.name ? { name: row.exerciseName ?? exercise?.name } : {}),
    ...(row.exerciseMeasurementType ?? exercise?.measurementType
      ? { measurementType: row.exerciseMeasurementType ?? exercise?.measurementType }
      : {}),
    ...(row.exercisePrimaryMuscle ?? exercise?.primaryMuscle
      ? { primaryMuscle: row.exercisePrimaryMuscle ?? exercise?.primaryMuscle }
      : {}),
    ...(row.exerciseEquipment ?? exercise?.equipment
      ? { equipment: row.exerciseEquipment ?? exercise?.equipment }
      : {}),
  };
}

/**
 * Every field, for a row whose measurement type is lost.
 *
 * Same reasoning as `performedReadings` on the history screen: with no shape to
 * filter by, dropping figures would lose data, and guessing a type would invent
 * one. Writing down what is stored does neither.
 */
const ALL_FIELDS: TargetField[] = ['weight', 'reps', 'duration', 'distance'];

function projectSet(set: WorkoutSet, number: number, fields: TargetField[]): ExportSet {
  const has = (field: TargetField): boolean => fields.includes(field);

  return {
    number,
    type: set.setType,
    side: set.side,
    ...(has('weight') && set.weight !== undefined ? { weightKg: set.weight } : {}),
    ...(has('reps') && set.reps !== undefined ? { reps: set.reps } : {}),
    ...(has('duration') && set.durationSeconds !== undefined
      ? { durationSeconds: set.durationSeconds }
      : {}),
    ...(has('distance') && set.distanceMeters !== undefined
      ? { distanceMeters: set.distanceMeters }
      : {}),
    ...(set.rpe === undefined ? {} : { rpe: set.rpe }),
  };
}

function projectExercise(
  entry: ExportSource['exercises'][number],
  options: ExportOptions,
): ExportExercise {
  const identity = identityOf(entry);
  const fields =
    identity.measurementType === undefined
      ? ALL_FIELDS
      : measurementShape(identity.measurementType).fields;

  const kept = options.includeWarmups
    ? entry.sets
    : entry.sets.filter((set) => set.setType !== 'warmup');

  return {
    ...(options.includeIds ? { id: entry.row.exerciseId } : {}),
    ...identity,
    ...(options.includeNotes && entry.row.notes?.trim() ? { notes: entry.row.notes } : {}),
    // Numbered after filtering, not before: a document whose sets run 2, 3, 4
    // asks the reader to work out what happened to the first one.
    sets: kept.map((set, index) => projectSet(set, index + 1, fields)),
  };
}

function projectWorkout(source: ExportSource, options: ExportOptions): ExportWorkout {
  const { workout } = source;
  // A session recorded before the field existed has no offset of its own. The
  // platform's is the best available answer and the only one — cf. the version 2
  // migration, which makes this branch unreachable in practice.
  const offset = workout.startedTimezoneOffsetMinutes ?? localOffsetMinutes(workout.startedAt);

  return {
    ...(options.includeIds ? { id: workout.id } : {}),
    name: workout.name,
    ...(options.includeNotes && workout.notes?.trim() ? { notes: workout.notes } : {}),
    startedAt: isoWithOffset(workout.startedAt, offset),
    localDate: localDateKey(workout.startedAt, offset),
    timezoneOffsetMinutes: offset,
    durationSeconds: workout.durationSeconds,
    // Computed from the rows and not from the projection: `sessionTotals` knows
    // that a weight is only tonnage when it is really the load, and it is the
    // same call the history screen makes. Warm-ups are excluded by the function
    // itself, so `includeWarmups` cannot change these figures.
    totals: sessionTotals(
      source.exercises.flatMap((entry) => {
        const type = identityOf(entry).measurementType;
        const weightRole = type === undefined ? undefined : measurementShape(type).weightRole;
        return entry.sets.map((set) => ({ set, weightRole }));
      }),
    ),
    exercises: source.exercises.map((entry) => projectExercise(entry, options)),
  };
}

export function projectCoachExport(
  scope: ExportScope,
  sources: readonly ExportSource[],
  options: ExportOptions,
  now: number,
): CoachExport {
  const workouts = sources.map((source) => projectWorkout(source, options));

  return {
    format: 'fittrack-coach-export',
    schemaVersion: 1,
    exportedAt: new Date(now).toISOString(),
    scope,
    workoutCount: workouts.length,
    // Counted from the rows, not from the projection: `isWorkingSet` is the
    // app's single rule for what counts, and restating it here is how the export
    // and the screen end up disagreeing.
    workingSetCount: sources.reduce(
      (total, source) =>
        total +
        source.exercises.reduce(
          (perWorkout, entry) => perWorkout + entry.sets.filter(isWorkingSet).length,
          0,
        ),
      0,
    ),
    workouts,
  };
}
