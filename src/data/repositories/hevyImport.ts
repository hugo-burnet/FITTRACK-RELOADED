import { db } from '@/data/db';
import type {
  Equipment,
  Exercise,
  MeasurementType,
} from '@/data/types';
import type { HevyImportData, HevyParsedWorkout } from '@/lib/hevyCsv';
import { hevyExerciseSourceKey } from '@/lib/hevyExerciseMatch';
import { selectHevyRoutineSources } from '@/lib/hevyRoutineSelection';
import { newEntity } from './base';
import type { NewExercise } from './exercises';
import {
  buildHevyRoutineEntities,
  nextHevyImportFolderName,
} from './hevyRoutineImport';
import { buildHevyWorkoutEntities } from './hevyWorkoutEntities';
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
  aliveRoutineFolderNames?: string[];
}

export interface HevyImportResult {
  importedWorkouts: number;
  skippedWorkouts: number;
  createdExercises: number;
  importedExercises: number;
  importedSets: number;
  createdRoutines: number;
  routineFolderName?: string;
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
  const [exercises, keys, savedMappings, folders] = await Promise.all([
    db.exercises.where('deletedAt').equals(0).toArray(),
    existingImportKeys(requested),
    getHevyExerciseMappings(),
    db.routineFolders.where('deletedAt').equals(0).toArray(),
  ]);
  return {
    exercises: exercises.sort((left, right) =>
      left.name.localeCompare(right.name, 'fr'),
    ),
    existingImportKeys: keys,
    savedMappings,
    aliveRoutineFolderNames: folders.map((folder) => folder.name),
  };
}

function sourceKeys(workouts: readonly HevyParsedWorkout[]): string[] {
  return [
    ...new Set(
      workouts.flatMap((workout) =>
        workout.exercises.map((exercise) =>
          hevyExerciseSourceKey(exercise.sourceTitle),
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

export async function importHevyWorkouts(
  data: HevyImportData,
  resolutions: Readonly<HevyExerciseResolutions>,
  importedAt = Date.now(),
): Promise<HevyImportResult> {
  return db.transaction(
    'rw',
    [
      db.exercises,
      db.workouts,
      db.workoutExercises,
      db.workoutSets,
      db.routineFolders,
      db.routines,
      db.routineExercises,
      db.routineSets,
      db.settings,
    ],
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
          createdRoutines: 0,
        };
      }

      const measurementBySourceKey = new Map(
        data.sourceExercises.map((source) => [
          hevyExerciseSourceKey(source.sourceTitle),
          source.measurementType,
        ]),
      );
      const resolved = await resolveExercises(
        sourceKeys(importable),
        measurementBySourceKey,
        resolutions,
      );
      const entities = buildHevyWorkoutEntities(
        importable,
        resolved.bySourceKey,
      );
      const routineSources = selectHevyRoutineSources(importable);
      const [folders, routines] = await Promise.all([
        db.routineFolders
          .where('deletedAt')
          .equals(0)
          .toArray(),
        db.routines.where('deletedAt').equals(0).toArray(),
      ]);
      const routineFolderName = nextHevyImportFolderName(
        importedAt,
        folders.map((folder) => folder.name),
      );
      const routineEntities = buildHevyRoutineEntities(
        routineSources,
        resolved.bySourceKey,
        routineFolderName,
        folders.length,
        routines.length,
      );

      if (resolved.created.length > 0) {
        await db.exercises.bulkAdd(resolved.created);
      }
      await db.workouts.bulkAdd(entities.workouts);
      await db.workoutExercises.bulkAdd(entities.rows);
      await db.workoutSets.bulkAdd(entities.sets);
      await db.routineFolders.add(routineEntities.folder);
      await db.routines.bulkAdd(routineEntities.routines);
      await db.routineExercises.bulkAdd(routineEntities.rows);
      await db.routineSets.bulkAdd(routineEntities.sets);
      await setHevyExerciseMappings(resolved.mappings);

      return {
        importedWorkouts: entities.workouts.length,
        skippedWorkouts: duplicateKeys.size,
        createdExercises: resolved.created.length,
        importedExercises: entities.rows.length,
        importedSets: entities.sets.length,
        createdRoutines: routineEntities.routines.length,
        routineFolderName,
      };
    },
  );
}

export type { Equipment, MeasurementType };
