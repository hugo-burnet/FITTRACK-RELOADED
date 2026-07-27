import { db } from '@/data/db';
import type {
  Equipment,
  Exercise,
  MeasurementType,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '@/data/types';
import type { HevyImportData, HevyParsedWorkout } from '@/lib/hevyCsv';
import { normalizeHevyExerciseTitle } from '@/lib/hevyExerciseMatch';
import { resolveRestSeconds } from '@/lib/rest';
import { newEntity } from './base';
import type { NewExercise } from './exercises';
import {
  getHevyExerciseMappings,
  setHevyExerciseMappings,
  type HevyExerciseMappings,
} from './settings';

export type HevyExerciseResolution =
  | { kind: 'existing'; exerciseId: string }
  | { kind: 'custom'; exercise: NewExercise };

export type HevyExerciseResolutions = Record<
  string,
  HevyExerciseResolution
>;

export interface HevyImportPreparation {
  exercises: Exercise[];
  existingImportKeys: string[];
  savedMappings: HevyExerciseMappings;
}

export interface HevyImportResult {
  importedWorkouts: number;
  skippedWorkouts: number;
  createdExercises: number;
  importedExercises: number;
  importedSets: number;
}

async function existingImportKeys(
  requested: ReadonlySet<string>,
): Promise<string[]> {
  if (requested.size === 0) return [];
  const completed = await db.workouts
    .where('status')
    .equals('completed')
    .toArray();
  return completed
    .filter(
      (workout) =>
        workout.deletedAt === 0 &&
        workout.importSource === 'hevy_csv' &&
        workout.importKey !== undefined &&
        requested.has(workout.importKey),
    )
    .map((workout) => workout.importKey!);
}

export async function prepareHevyImport(
  data: HevyImportData,
): Promise<HevyImportPreparation> {
  const requested = new Set(
    data.workouts.map((workout) => workout.importKey),
  );
  const [exercises, keys, savedMappings] = await Promise.all([
    db.exercises.where('deletedAt').equals(0).toArray(),
    existingImportKeys(requested),
    getHevyExerciseMappings(),
  ]);
  return {
    exercises: exercises.sort((left, right) =>
      left.name.localeCompare(right.name, 'fr'),
    ),
    existingImportKeys: keys,
    savedMappings,
  };
}

function sourceKeys(workouts: readonly HevyParsedWorkout[]): string[] {
  return [
    ...new Set(
      workouts.flatMap((workout) =>
        workout.exercises.map((exercise) =>
          normalizeHevyExerciseTitle(exercise.sourceTitle),
        ),
      ),
    ),
  ];
}

interface ResolvedExercises {
  bySourceKey: Map<string, Exercise>;
  created: Exercise[];
  mappings: HevyExerciseMappings;
}

async function resolveExercises(
  sourceKeysToResolve: readonly string[],
  measurementBySourceKey: ReadonlyMap<string, MeasurementType>,
  resolutions: Readonly<HevyExerciseResolutions>,
): Promise<ResolvedExercises> {
  const bySourceKey = new Map<string, Exercise>();
  const created: Exercise[] = [];
  const mappings = await getHevyExerciseMappings();

  for (const sourceKey of sourceKeysToResolve) {
    const resolution = resolutions[sourceKey];
    const measurementType = measurementBySourceKey.get(sourceKey);
    if (resolution === undefined) {
      throw new Error(`Missing Hevy exercise resolution: ${sourceKey}`);
    }
    if (measurementType === undefined) {
      throw new Error(`Missing Hevy exercise source: ${sourceKey}`);
    }

    let exercise: Exercise;
    if (resolution.kind === 'existing') {
      const existing = await db.exercises.get(resolution.exerciseId);
      if (existing === undefined || existing.deletedAt !== 0) {
        throw new Error(`Hevy exercise target is unavailable: ${sourceKey}`);
      }
      exercise = existing;
    } else {
      exercise = newEntity<Exercise>({
        ...resolution.exercise,
        isCustom: 1,
      });
      created.push(exercise);
    }
    if (exercise.measurementType !== measurementType) {
      throw new Error(
        `Hevy exercise measurement is incompatible: ${sourceKey}`,
      );
    }

    bySourceKey.set(sourceKey, exercise);
    mappings[sourceKey] = exercise.id;
  }

  return { bySourceKey, created, mappings };
}

interface ImportEntities {
  workouts: Workout[];
  rows: WorkoutExercise[];
  sets: WorkoutSet[];
}

function buildEntities(
  parsedWorkouts: readonly HevyParsedWorkout[],
  exercises: ReadonlyMap<string, Exercise>,
): ImportEntities {
  const workouts: Workout[] = [];
  const rows: WorkoutExercise[] = [];
  const sets: WorkoutSet[] = [];

  for (const parsed of parsedWorkouts) {
    const workout = newEntity<Workout>({
      routineId: '',
      name: parsed.title,
      status: 'completed',
      startedAt: parsed.startedAt,
      endedAt: parsed.endedAt,
      durationSeconds: parsed.durationSeconds,
      ...(parsed.notes === undefined ? {} : { notes: parsed.notes }),
      importSource: 'hevy_csv',
      importKey: parsed.importKey,
    });
    workouts.push(workout);

    const totalSets = parsed.exercises.reduce(
      (total, exercise) => total + exercise.sets.length,
      0,
    );
    let sequence = 0;
    for (const parsedExercise of parsed.exercises) {
      const sourceKey = normalizeHevyExerciseTitle(
        parsedExercise.sourceTitle,
      );
      const exercise = exercises.get(sourceKey);
      if (exercise === undefined) {
        throw new Error(`Missing resolved Hevy exercise: ${sourceKey}`);
      }
      const row = newEntity<WorkoutExercise>({
        workoutId: workout.id,
        exerciseId: exercise.id,
        order: parsedExercise.order,
        supersetGroup: parsedExercise.supersetGroup,
        ...(parsedExercise.notes === undefined
          ? {}
          : { notes: parsedExercise.notes }),
        restSeconds: resolveRestSeconds(
          undefined,
          exercise.defaultRestSeconds,
        ),
      });
      rows.push(row);

      for (const parsedSet of parsedExercise.sets) {
        sequence += 1;
        const performedAt =
          parsed.startedAt +
          Math.floor(
            ((parsed.endedAt - parsed.startedAt) * sequence) /
              (totalSets + 1),
          );
        sets.push(
          newEntity<WorkoutSet>({
            workoutExerciseId: row.id,
            exerciseId: exercise.id,
            workoutId: workout.id,
            order: parsedSet.order,
            setType: parsedSet.setType,
            side: 'both',
            ...(parsedSet.weight === undefined
              ? {}
              : { weight: parsedSet.weight }),
            ...(parsedSet.reps === undefined
              ? {}
              : { reps: parsedSet.reps }),
            ...(parsedSet.durationSeconds === undefined
              ? {}
              : { durationSeconds: parsedSet.durationSeconds }),
            ...(parsedSet.distanceMeters === undefined
              ? {}
              : { distanceMeters: parsedSet.distanceMeters }),
            ...(parsedSet.rpe === undefined ? {} : { rpe: parsedSet.rpe }),
            isCompleted: 1,
            performedAt,
          }),
        );
      }
    }
  }
  return { workouts, rows, sets };
}

export async function importHevyWorkouts(
  data: HevyImportData,
  resolutions: Readonly<HevyExerciseResolutions>,
): Promise<HevyImportResult> {
  return db.transaction(
    'rw',
    db.exercises,
    db.workouts,
    db.workoutExercises,
    db.workoutSets,
    db.settings,
    async () => {
      const duplicateKeys = new Set(
        await existingImportKeys(
          new Set(data.workouts.map((workout) => workout.importKey)),
        ),
      );
      const importable = data.workouts.filter(
        (workout) => !duplicateKeys.has(workout.importKey),
      );
      if (importable.length === 0) {
        return {
          importedWorkouts: 0,
          skippedWorkouts: data.workouts.length,
          createdExercises: 0,
          importedExercises: 0,
          importedSets: 0,
        };
      }

      const measurementBySourceKey = new Map(
        data.sourceExercises.map((source) => [
          normalizeHevyExerciseTitle(source.sourceTitle),
          source.measurementType,
        ]),
      );
      const resolved = await resolveExercises(
        sourceKeys(importable),
        measurementBySourceKey,
        resolutions,
      );
      const entities = buildEntities(importable, resolved.bySourceKey);

      if (resolved.created.length > 0) {
        await db.exercises.bulkAdd(resolved.created);
      }
      await db.workouts.bulkAdd(entities.workouts);
      await db.workoutExercises.bulkAdd(entities.rows);
      await db.workoutSets.bulkAdd(entities.sets);
      await setHevyExerciseMappings(resolved.mappings);

      return {
        importedWorkouts: entities.workouts.length,
        skippedWorkouts: duplicateKeys.size,
        createdExercises: resolved.created.length,
        importedExercises: entities.rows.length,
        importedSets: entities.sets.length,
      };
    },
  );
}

export type { Equipment, MeasurementType };
