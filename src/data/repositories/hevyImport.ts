import { db } from '@/data/db';
import type {
  Equipment,
  Exercise,
  ExternalExerciseBinding,
  MeasurementType,
} from '@/data/types';
import type {
  HevyImportData,
  HevyParsedWorkout,
  HevySourceExercise,
} from '@/lib/hevyCsv';
import {
  externalExerciseIdentityKey,
  type ExternalExerciseResolution,
} from '@/lib/externalExerciseIdentity';
import {
  isDormantRoutine,
  selectHevyRoutineSources,
} from '@/lib/hevyRoutineSelection';
import type { NewExercise } from './exercises';
import { listExternalExerciseBindings } from './externalExerciseBindings';
import {
  buildHevyRoutineEntities,
  nextHevyArchiveFolderName,
  nextHevyImportFolderName,
} from './hevyRoutineImport';
import { buildHevyWorkoutEntities } from './hevyWorkoutEntities';

export type HevyExerciseResolution =
  | { kind: 'existing'; exerciseId: string }
  | { kind: 'custom'; exercise: NewExercise };

export interface HevyImportPreparation {
  exercises: Exercise[];
  existingImportKeys: string[];
  confirmedBindings: ExternalExerciseBinding[];
  aliveRoutineFolderNames: string[];
}

export interface HevyImportResult {
  importedWorkouts: number;
  skippedWorkouts: number;
  createdExercises: number;
  importedExercises: number;
  importedSets: number;
  createdRoutines: number;
  routineFolderName?: string;
  /** Le dossier des routines qui dorment, quand l'import en a rangé. */
  archivedRoutineFolderName?: string;
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
  const [exercises, keys, confirmedBindings, folders] = await Promise.all([
    db.exercises.toArray(),
    existingImportKeys(requested),
    listExternalExerciseBindings('hevy_csv'),
    db.routineFolders.where('deletedAt').equals(0).toArray(),
  ]);
  return {
    exercises: exercises.sort((left, right) =>
      left.name.localeCompare(right.name, 'fr'),
    ),
    existingImportKeys: keys,
    confirmedBindings,
    aliveRoutineFolderNames: folders.map((folder) => folder.name),
  };
}

function sourceKeys(workouts: readonly HevyParsedWorkout[]): string[] {
  return [
    ...new Set(
      workouts.flatMap((workout) =>
        workout.exercises.map((exercise) =>
          externalExerciseIdentityKey(exercise.sourceTitle),
        ),
      ),
    ),
  ];
}

interface ResolvedExercises {
  bySourceKey: Map<string, Exercise>;
  created: Exercise[];
  bindings: ExternalExerciseBinding[];
}

function assertAuthoritativeBinding(
  binding: ExternalExerciseBinding,
  sourceKey: string,
  source: HevySourceExercise,
  exercise: Exercise,
): void {
  if (
    binding.source !== 'hevy_csv' ||
    binding.identityKey !== sourceKey ||
    binding.sourceTitle !== source.sourceTitle ||
    binding.exerciseId !== exercise.id ||
    binding.measurementType !== source.measurementType ||
    binding.equipmentHint !== source.equipment ||
    binding.verification !== 'user' ||
    binding.deletedAt !== 0
  ) {
    throw new Error(
      `Invalid authoritative Hevy exercise binding: ${sourceKey}`,
    );
  }
}

async function validateResolution(
  sourceKeysToResolve: readonly string[],
  allowedSourceKeys: readonly string[],
  sourceByIdentityKey: ReadonlyMap<string, HevySourceExercise>,
  resolution: ExternalExerciseResolution,
  importedAt: number,
): Promise<ResolvedExercises> {
  const bySourceKey = new Map<string, Exercise>();
  const allowedKeys = new Set(allowedSourceKeys);
  const createdById = new Map(
    resolution.exercisesToCreate.map((exercise) => [
      exercise.id,
      exercise,
    ]),
  );
  if (createdById.size !== resolution.exercisesToCreate.length) {
    throw new Error('Duplicate authoritative Hevy exercise');
  }
  const referencedCreatedIds = new Set<string>();
  const incomingBindingsByIdentityKey = new Map<
    string,
    ExternalExerciseBinding
  >();
  for (const binding of resolution.bindingsToWrite) {
    if (
      incomingBindingsByIdentityKey.has(binding.identityKey)
    ) {
      throw new Error(
        `Duplicate authoritative Hevy exercise binding: ${binding.identityKey}`,
      );
    }
    incomingBindingsByIdentityKey.set(binding.identityKey, binding);
  }
  const existingBindingsById = new Map(
    (
      await db.externalExerciseBindings.bulkGet(
        resolution.bindingsToWrite.map((binding) => binding.id),
      )
    ).flatMap((binding) =>
      binding === undefined ? [] : [[binding.id, binding] as const],
    ),
  );
  const existingBindingGroups = new Map<
    string,
    ExternalExerciseBinding[]
  >();
  for (const binding of await listExternalExerciseBindings('hevy_csv')) {
    const group = existingBindingGroups.get(binding.identityKey) ?? [];
    group.push(binding);
    existingBindingGroups.set(binding.identityKey, group);
  }
  const bindings: ExternalExerciseBinding[] = [];

  for (const key of resolution.exercisesByIdentityKey.keys()) {
    if (!allowedKeys.has(key)) {
      throw new Error(
        `Unexpected authoritative Hevy exercise resolution: ${key}`,
      );
    }
  }

  for (const sourceKey of sourceKeysToResolve) {
    const source = sourceByIdentityKey.get(sourceKey);
    const resolvedExercise =
      resolution.exercisesByIdentityKey.get(sourceKey);
    if (resolvedExercise === undefined) {
      throw new Error(`Missing Hevy exercise resolution: ${sourceKey}`);
    }
    if (source === undefined) {
      throw new Error(`Missing Hevy exercise source: ${sourceKey}`);
    }

    const created = createdById.get(resolvedExercise.id);
    let exercise: Exercise | undefined;
    if (created !== undefined) {
      if (
        created.deletedAt !== 0 ||
        created.isCustom !== 1 ||
        (await db.exercises.get(created.id)) !== undefined
      ) {
        throw new Error(
          `Hevy exercise target is unavailable: ${sourceKey}`,
        );
      }
      referencedCreatedIds.add(created.id);
      exercise = created;
    } else {
      exercise = await db.exercises.get(resolvedExercise.id);
      if (exercise === undefined || exercise.deletedAt !== 0) {
        throw new Error(
          `Hevy exercise target is unavailable: ${sourceKey}`,
        );
      }
    }
    if (exercise.measurementType !== source.measurementType) {
      throw new Error(
        `Hevy exercise measurement is incompatible: ${sourceKey}`,
      );
    }

    bySourceKey.set(sourceKey, exercise);
    const existingGroup = existingBindingGroups.get(sourceKey) ?? [];
    const incomingBinding =
      incomingBindingsByIdentityKey.get(sourceKey);
    if (incomingBinding !== undefined) {
      const existingWithSameId = existingBindingsById.get(
        incomingBinding.id,
      );
      if (
        existingWithSameId !== undefined &&
        (existingWithSameId.source !== incomingBinding.source ||
          existingWithSameId.identityKey !==
            incomingBinding.identityKey)
      ) {
        throw new Error(
          `Hevy exercise binding id is unavailable: ${incomingBinding.id}`,
        );
      }
      assertAuthoritativeBinding(
        incomingBinding,
        sourceKey,
        source,
        exercise,
      );
    }
    const reusableBindings = existingGroup.filter(
      (binding) =>
        binding.verification === 'user' &&
        binding.exerciseId === exercise.id &&
        binding.measurementType === source.measurementType,
    );
    if (
      incomingBinding === undefined &&
      reusableBindings.length === 0
    ) {
      throw new Error(
        `Missing authoritative Hevy exercise binding: ${sourceKey}`,
      );
    }
    const bindingToKeep =
      incomingBinding ??
      reusableBindings.reduce((latest, binding) =>
        binding.confirmedAt > latest.confirmedAt
          ? binding
          : latest,
      );
    bindings.push(
      ...existingGroup
        .filter((binding) => binding.id !== bindingToKeep.id)
        .map((binding) => ({
          ...binding,
          updatedAt: importedAt,
          deletedAt: importedAt,
        })),
    );
    if (incomingBinding !== undefined) {
      bindings.push(incomingBinding);
    }
  }

  const allowedCreatedIds = new Set(
    [...resolution.exercisesByIdentityKey]
      .filter(([identityKey]) => allowedKeys.has(identityKey))
      .map(([, exercise]) => exercise.id),
  );
  for (const exercise of resolution.exercisesToCreate) {
    if (!allowedCreatedIds.has(exercise.id)) {
      throw new Error(
        `Unexpected authoritative Hevy exercise: ${exercise.id}`,
      );
    }
  }
  for (const key of incomingBindingsByIdentityKey.keys()) {
    if (!allowedKeys.has(key)) {
      throw new Error(
        `Unexpected authoritative Hevy exercise binding: ${key}`,
      );
    }
  }

  return {
    bySourceKey,
    created: resolution.exercisesToCreate.filter((exercise) =>
      referencedCreatedIds.has(exercise.id),
    ),
    bindings,
  };
}

export async function importHevyWorkouts(
  data: HevyImportData,
  resolution: ExternalExerciseResolution,
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
      db.externalExerciseBindings,
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

      const sourceByIdentityKey = new Map(
        data.sourceExercises.map((source) => [
          externalExerciseIdentityKey(source.sourceTitle),
          source,
        ]),
      );
      const resolved = await validateResolution(
        sourceKeys(importable),
        sourceKeys(data.workouts),
        sourceByIdentityKey,
        resolution,
        importedAt,
      );
      const routineSources = selectHevyRoutineSources(importable);
      const [folders, routines] = await Promise.all([
        db.routineFolders
          .where('deletedAt')
          .equals(0)
          .toArray(),
        db.routines.where('deletedAt').equals(0).toArray(),
      ]);
      const folderNames = folders.map((folder) => folder.name);
      // Deux dossiers : ce qui tourne encore, et ce qui dort depuis plus d'un
      // mois. Un historique un peu long ramène toujours des routines qu'on ne
      // fait plus — elles reviennent rangées plutôt que mélangées à celles
      // qu'on ouvre avant chaque séance.
      const active = routineSources.filter(
        (source) => !isDormantRoutine(source, importedAt),
      );
      const dormant = routineSources.filter((source) =>
        isDormantRoutine(source, importedAt),
      );
      const routineFolderName = nextHevyImportFolderName(importedAt, folderNames);
      const archivedFolderName = nextHevyArchiveFolderName(importedAt, [
        ...folderNames,
        routineFolderName,
      ]);
      const routineEntities = buildHevyRoutineEntities(
        active,
        resolved.bySourceKey,
        routineFolderName,
        folders.length,
        routines.length,
      );
      const archivedEntities = buildHevyRoutineEntities(
        dormant,
        resolved.bySourceKey,
        archivedFolderName,
        folders.length + 1,
        routines.length + routineEntities.routines.length,
      );

      /*
       * Chaque séance importée pointe vers la routine reconstruite **à partir
       * d'elle**. Sans ce lien, l'import fabriquait une routine et un historique
       * qui ne se connaissaient pas : l'accueil annonçait « jamais réalisée »
       * sur une routine née de ces séances-là, et l'export CSV ressortait sans
       * routine ce que l'import venait d'en déduire.
       *
       * `buildHevyRoutineEntities` rend ses routines dans l'ordre de ses
       * sources, ce qui permet de les apparier une à une.
       */
      const routineIdByImportKey = new Map<string, string>();
      for (const [sources, built] of [
        [active, routineEntities.routines],
        [dormant, archivedEntities.routines],
      ] as const) {
        sources.forEach((source, index) => {
          const routine = built[index];
          if (routine === undefined) return;
          for (const importKey of source.importKeys) {
            routineIdByImportKey.set(importKey, routine.id);
          }
        });
      }
      const entities = buildHevyWorkoutEntities(
        importable,
        resolved.bySourceKey,
        routineIdByImportKey,
      );

      if (resolved.created.length > 0) {
        await db.exercises.bulkAdd(resolved.created);
      }
      await db.externalExerciseBindings.bulkPut(resolved.bindings);
      await db.workouts.bulkAdd(entities.workouts);
      await db.workoutExercises.bulkAdd(entities.rows);
      await db.workoutSets.bulkAdd(entities.sets);
      // Un dossier vide n'est pas créé : sans routine dormante, l'utilisateur
      // ne doit pas trouver un dossier « Archivé » qui ne contient rien.
      const created = [routineEntities, archivedEntities].filter(
        (group) => group.routines.length > 0,
      );
      await db.routineFolders.bulkAdd(created.map((group) => group.folder));
      await db.routines.bulkAdd(created.flatMap((group) => group.routines));
      await db.routineExercises.bulkAdd(created.flatMap((group) => group.rows));
      await db.routineSets.bulkAdd(created.flatMap((group) => group.sets));

      return {
        importedWorkouts: entities.workouts.length,
        skippedWorkouts: duplicateKeys.size,
        createdExercises: resolved.created.length,
        importedExercises: entities.rows.length,
        importedSets: entities.sets.length,
        createdRoutines:
          routineEntities.routines.length + archivedEntities.routines.length,
        ...(routineEntities.routines.length > 0 ? { routineFolderName } : {}),
        ...(archivedEntities.routines.length > 0
          ? { archivedRoutineFolderName: archivedFolderName }
          : {}),
      };
    },
  );
}

export type { Equipment, MeasurementType };
