import type {
  HistoricalExercise,
  HistoricalSet,
  HistoricalWorkout,
} from '@/lib/historyProjection';
import {
  isTimedMeasurement,
  measurementShape,
  type TargetField,
} from '@/lib/measurement';
import { isWorkingSet } from '@/lib/records';
import {
  isoWithOffset,
  localDateKey,
  localOffsetMinutes,
} from '@/lib/timezone';
import { sessionTotals } from '@/lib/volume';
import type {
  CoachExport,
  ExportExercise,
  ExportOptions,
  ExportScope,
  ExportSet,
  ExportWorkout,
} from './types';

/**
 * Every field, for a row whose measurement type is lost.
 *
 * Same reasoning as `performedReadings` on the history screen: with no shape to
 * filter by, dropping figures would lose data, and guessing a type would invent
 * one. Writing down what is stored does neither.
 */
const ALL_FIELDS: TargetField[] = [
  'weight',
  'reps',
  'duration',
  'distance',
];

function projectSet(
  set: HistoricalSet,
  number: number,
  fields: TargetField[],
): ExportSet {
  const has = (field: TargetField): boolean =>
    fields.includes(field);

  return {
    number,
    type: set.setType,
    side: set.side,
    ...(has('weight') && set.weight !== undefined
      ? { weightKg: set.weight }
      : {}),
    ...(has('reps') && set.reps !== undefined
      ? { reps: set.reps }
      : {}),
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
  exercise: HistoricalExercise,
  options: ExportOptions,
): ExportExercise {
  const fields =
    exercise.measurementType === undefined
      ? ALL_FIELDS
      : measurementShape(exercise.measurementType).fields;
  const kept = options.includeWarmups
    ? exercise.sets
    : exercise.sets.filter(isWorkingSet);

  return {
    ...(options.includeIds
      ? { id: exercise.exerciseId }
      : {}),
    ...(exercise.name === undefined
      ? {}
      : { name: exercise.name }),
    ...(exercise.measurementType === undefined
      ? {}
      : { measurementType: exercise.measurementType }),
    ...(exercise.primaryMuscle === undefined
      ? {}
      : { primaryMuscle: exercise.primaryMuscle }),
    ...(exercise.equipment === undefined
      ? {}
      : { equipment: exercise.equipment }),
    ...(options.includeNotes && exercise.notes?.trim()
      ? { notes: exercise.notes }
      : {}),
    sets: kept.map((set, index) =>
      projectSet(set, index + 1, fields),
    ),
  };
}

function projectWorkout(
  source: HistoricalWorkout,
  options: ExportOptions,
): ExportWorkout {
  const offset =
    source.timezoneOffsetMinutes ??
    localOffsetMinutes(source.startedAt);

  return {
    ...(options.includeIds ? { id: source.workoutId } : {}),
    name: source.name,
    ...(options.includeNotes && source.notes?.trim()
      ? { notes: source.notes }
      : {}),
    startedAt: isoWithOffset(source.startedAt, offset),
    localDate: localDateKey(source.startedAt, offset),
    timezoneOffsetMinutes: offset,
    durationSeconds: source.durationSeconds,
    totals: sessionTotals(
      source.exercises.flatMap((exercise) => {
        const weightRole =
          exercise.measurementType === undefined
            ? undefined
            : measurementShape(
                exercise.measurementType,
              ).weightRole;
        const timed =
          exercise.measurementType === undefined
            ? undefined
            : isTimedMeasurement(exercise.measurementType);
        return exercise.sets.map((set) => ({
          set,
          weightRole,
          bodyweightLoadFactor: exercise.bodyweightLoadFactor,
          timed,
          repSeconds: exercise.repSeconds,
        }));
      }),
      source.bodyWeightKg,
    ),
    exercises: source.exercises.map((exercise) =>
      projectExercise(exercise, options),
    ),
  };
}

export function projectCoachExport(
  scope: ExportScope,
  sources: readonly HistoricalWorkout[],
  options: ExportOptions,
  now: number,
): CoachExport {
  const workouts = sources.map((source) =>
    projectWorkout(source, options),
  );

  return {
    format: 'fittrack-coach-export',
    schemaVersion: 1,
    exportedAt: new Date(now).toISOString(),
    scope,
    workoutCount: workouts.length,
    workingSetCount: sources.reduce(
      (total, source) =>
        total +
        source.exercises.reduce(
          (perWorkout, exercise) =>
            perWorkout +
            exercise.sets.filter(isWorkingSet).length,
          0,
        ),
      0,
    ),
    workouts,
  };
}
