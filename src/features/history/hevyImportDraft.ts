import type {
  HevyImportData,
  HevySourceExercise,
} from '@/lib/hevyCsv';
import type { Exercise } from '@/data/types';
import {
  createExternalExerciseIdentityRegistry,
  externalExerciseIdentityKey,
  type ExternalExerciseObservation,
  type ExternalExerciseReviewEntry,
} from '@/lib/externalExerciseIdentity';
import {
  findSuggestedHevyExercise,
  rankHevyExerciseCandidates,
} from '@/lib/hevyExerciseMatch';
import { selectHevyRoutineSources } from '@/lib/hevyRoutineSelection';
import type {
  HevyExerciseResolution,
  HevyExerciseResolutions,
  HevyImportPreparation,
} from '@/data/repositories/hevyImport';
import { nextHevyImportFolderName } from '@/data/repositories/hevyRoutineImport';

export interface HevyMappingDraftRow {
  source: HevySourceExercise;
  review: ExternalExerciseReviewEntry;
  resolution?: HevyExerciseResolution;
  resolutionSource?: 'binding' | 'user';
}

export interface HevyImportDraft {
  importableWorkouts: number;
  skippedWorkouts: number;
  importedAt: number;
  routineFolderName?: string;
  routineNames: string[];
  rows: HevyMappingDraftRow[];
}

function buildObservations(
  data: HevyImportData,
  importable: HevyImportData['workouts'],
): ExternalExerciseObservation[] {
  const sourcesByIdentityKey = new Map(
    data.sourceExercises.map((source) => [
      externalExerciseIdentityKey(source.sourceTitle),
      source,
    ]),
  );
  const sessionsByIdentityKey = new Map<
    string,
    ExternalExerciseObservation['examples']
  >();

  for (const workout of importable) {
    const setsByIdentityKey = new Map<
      string,
      ExternalExerciseObservation['examples'][number]['sets']
    >();
    for (const exercise of workout.exercises) {
      const identityKey = externalExerciseIdentityKey(
        exercise.sourceTitle,
      );
      setsByIdentityKey.set(identityKey, [
        ...(setsByIdentityKey.get(identityKey) ?? []),
        ...exercise.sets.map((set) => ({
          ...(set.weight === undefined ? {} : { weight: set.weight }),
          ...(set.reps === undefined ? {} : { reps: set.reps }),
          ...(set.durationSeconds === undefined
            ? {}
            : { durationSeconds: set.durationSeconds }),
          ...(set.distanceMeters === undefined
            ? {}
            : { distanceMeters: set.distanceMeters }),
        })),
      ]);
    }

    for (const [identityKey, sets] of setsByIdentityKey) {
      sessionsByIdentityKey.set(identityKey, [
        ...(sessionsByIdentityKey.get(identityKey) ?? []),
        {
          workoutName: workout.title,
          startedAt: workout.startedAt,
          sets,
        },
      ]);
    }
  }

  return [...sessionsByIdentityKey].flatMap(
    ([identityKey, sessions]) => {
      const source = sourcesByIdentityKey.get(identityKey);
      if (source === undefined) return [];
      const newestFirst = [...sessions].sort(
        (left, right) => right.startedAt - left.startedAt,
      );
      return [
        {
          source: 'hevy_csv',
          sourceTitle: source.sourceTitle,
          measurementType: source.measurementType,
          equipmentHint: source.equipment,
          sessionCount: sessions.length,
          setCount: sessions.reduce(
            (total, session) => total + session.sets.length,
            0,
          ),
          examples: newestFirst.slice(0, 3),
        },
      ];
    },
  );
}

function suggestionMap(
  observations: readonly ExternalExerciseObservation[],
  preparation: HevyImportPreparation,
): ReadonlyMap<string, readonly Exercise[]> {
  const suggestions = new Map<string, Exercise[]>();
  for (const observation of observations) {
    const compatible = preparation.exercises.filter(
      (exercise) =>
        exercise.deletedAt === 0 &&
        exercise.measurementType === observation.measurementType,
    );
    const suggested = findSuggestedHevyExercise(
      observation.sourceTitle,
      observation.measurementType,
      compatible,
    );
    const ranked = rankHevyExerciseCandidates(
      observation.sourceTitle,
      compatible,
    );
    suggestions.set(observationKey(observation), [
      ...(suggested === undefined ? [] : [suggested]),
      ...ranked.filter((exercise) => exercise.id !== suggested?.id),
    ]);
  }
  return suggestions;
}

function observationKey(
  observation: ExternalExerciseObservation,
): string {
  return externalExerciseIdentityKey(observation.sourceTitle);
}

export function createHevyImportDraft(
  data: HevyImportData,
  preparation: HevyImportPreparation,
  importedAt = Date.now(),
): HevyImportDraft {
  const duplicateKeys = new Set(preparation.existingImportKeys);
  const importable = data.workouts.filter(
    (workout) => !duplicateKeys.has(workout.importKey),
  );
  const observations = buildObservations(data, importable);
  const registry = createExternalExerciseIdentityRegistry(
    preparation.exercises,
    preparation.confirmedBindings,
    suggestionMap(observations, preparation),
  );
  const reviews = registry.review(observations);
  const sourcesByIdentityKey = new Map(
    data.sourceExercises.map((source) => [
      externalExerciseIdentityKey(source.sourceTitle),
      source,
    ]),
  );
  const routineSources = selectHevyRoutineSources(importable);
  const routineFolderName =
    routineSources.length === 0
      ? undefined
      : nextHevyImportFolderName(
          importedAt,
          preparation.aliveRoutineFolderNames ?? [],
        );

  const rows = reviews.flatMap((review): HevyMappingDraftRow[] => {
    const source = sourcesByIdentityKey.get(review.identityKey);
    if (source === undefined) return [];
    if (review.status !== 'confirmed') {
      return [{ source, review }];
    }
    return [
      {
        source,
        review,
        resolution: {
          kind: 'existing',
          exerciseId: review.exercise.id,
        },
        resolutionSource: 'binding',
      },
    ];
  });

  return {
    importableWorkouts: importable.length,
    skippedWorkouts: data.workouts.length - importable.length,
    importedAt,
    ...(routineFolderName === undefined
      ? {}
      : { routineFolderName }),
    routineNames: routineSources.map((routine) => routine.name),
    rows,
  };
}

export function setHevyImportResolution(
  draft: HevyImportDraft,
  sourceTitle: string,
  resolution: HevyExerciseResolution,
): HevyImportDraft {
  const identityKey = externalExerciseIdentityKey(sourceTitle);
  return {
    ...draft,
    rows: draft.rows.map((row) =>
      row.review.identityKey === identityKey
        ? { ...row, resolution, resolutionSource: 'user' }
        : row,
    ),
  };
}

export function unresolvedHevySources(
  draft: HevyImportDraft,
): HevySourceExercise[] {
  return draft.rows
    .filter(
      (row) => {
        const userResolved =
          row.resolution !== undefined &&
          row.resolutionSource === 'user';
        const bindingResolved =
          row.resolution !== undefined &&
          row.resolutionSource === 'binding' &&
          row.review.status === 'confirmed';
        return !userResolved && !bindingResolved;
      },
    )
    .map((row) => row.source);
}

export function resolutionsFromHevyDraft(
  draft: HevyImportDraft,
): HevyExerciseResolutions {
  const resolutions: HevyExerciseResolutions = {};
  for (const row of draft.rows) {
    if (row.resolution === undefined) {
      throw new Error(
        `Unresolved Hevy exercise: ${row.source.sourceTitle}`,
      );
    }
    resolutions[row.review.identityKey] = row.resolution;
  }
  return resolutions;
}

export function customResolutionFor(
  source: HevySourceExercise,
): HevyExerciseResolution {
  return {
    kind: 'custom',
    exercise: {
      name: source.sourceTitle,
      primaryMuscle: 'other',
      secondaryMuscles: [],
      equipment: source.equipment,
      measurementType: source.measurementType,
      isUnilateral: 0,
    },
  };
}
