import type { Exercise } from '@/data/types';
import type {
  HevyImportData,
  HevySourceExercise,
} from '@/lib/hevyCsv';
import {
  findCanonicalHevyExercise,
  normalizeHevyExerciseTitle,
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
  suggestion?: Exercise;
  resolution?: HevyExerciseResolution;
  resolutionSource?: 'saved' | 'canonical' | 'user';
}

export interface HevyImportDraft {
  importableWorkouts: number;
  skippedWorkouts: number;
  importedAt: number;
  routineFolderName?: string;
  routineNames: string[];
  rows: HevyMappingDraftRow[];
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
  const activeSourceKeys = new Set(
    importable.flatMap((workout) =>
      workout.exercises.map((exercise) =>
        normalizeHevyExerciseTitle(exercise.sourceTitle),
      ),
    ),
  );
  const exercisesById = new Map(
    preparation.exercises
      .filter((exercise) => exercise.deletedAt === 0)
      .map((exercise) => [exercise.id, exercise]),
  );
  const routineSources = selectHevyRoutineSources(importable);
  const routineFolderName =
    routineSources.length === 0
      ? undefined
      : nextHevyImportFolderName(
          importedAt,
          preparation.aliveRoutineFolderNames ?? [],
        );

  const rows = data.sourceExercises
    .filter((source) =>
      activeSourceKeys.has(
        normalizeHevyExerciseTitle(source.sourceTitle),
      ),
    )
    .map((source): HevyMappingDraftRow => {
      const sourceKey = normalizeHevyExerciseTitle(source.sourceTitle);
      const savedId = preparation.savedMappings[sourceKey];
      const mapped =
        savedId === undefined ? undefined : exercisesById.get(savedId);
      const saved =
        mapped?.measurementType === source.measurementType
          ? mapped
          : undefined;
      const compatibleExercises = preparation.exercises.filter(
        (exercise) =>
          exercise.measurementType === source.measurementType,
      );
      const canonical = findCanonicalHevyExercise(
        source.sourceTitle,
        source.measurementType,
        compatibleExercises,
      );
      const suggestion =
        canonical ??
        rankHevyExerciseCandidates(
          source.sourceTitle,
          compatibleExercises,
        )[0];
      const automatic = saved ?? canonical;
      const resolutionSource =
        saved !== undefined
          ? 'saved'
          : canonical !== undefined
            ? 'canonical'
            : undefined;

      return {
        source,
        ...(suggestion === undefined ? {} : { suggestion }),
        ...(automatic === undefined || resolutionSource === undefined
          ? {}
          : {
              resolution: {
                kind: 'existing' as const,
                exerciseId: automatic.id,
              },
              resolutionSource,
            }),
      };
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
  const sourceKey = normalizeHevyExerciseTitle(sourceTitle);
  return {
    ...draft,
    rows: draft.rows.map((row) =>
      normalizeHevyExerciseTitle(row.source.sourceTitle) === sourceKey
        ? { ...row, resolution, resolutionSource: 'user' }
        : row,
    ),
  };
}

export function unresolvedHevySources(
  draft: HevyImportDraft,
): HevySourceExercise[] {
  return draft.rows
    .filter((row) => row.resolution === undefined)
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
    resolutions[normalizeHevyExerciseTitle(row.source.sourceTitle)] =
      row.resolution;
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
