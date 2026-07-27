import type { Exercise } from '@/data/types';
import type {
  HevyImportData,
  HevySourceExercise,
} from '@/lib/hevyCsv';
import {
  normalizeHevyExerciseTitle,
  rankHevyExerciseCandidates,
} from '@/lib/hevyExerciseMatch';
import type {
  HevyExerciseResolution,
  HevyExerciseResolutions,
  HevyImportPreparation,
} from '@/data/repositories/hevyImport';

export interface HevyMappingDraftRow {
  source: HevySourceExercise;
  suggestion?: Exercise;
  resolution?: HevyExerciseResolution;
  resolutionSource?: 'saved' | 'user';
}

export interface HevyImportDraft {
  importableWorkouts: number;
  skippedWorkouts: number;
  rows: HevyMappingDraftRow[];
}

export function createHevyImportDraft(
  data: HevyImportData,
  preparation: HevyImportPreparation,
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

  const rows = data.sourceExercises
    .filter((source) =>
      activeSourceKeys.has(
        normalizeHevyExerciseTitle(source.sourceTitle),
      ),
    )
    .map((source): HevyMappingDraftRow => {
      const sourceKey = normalizeHevyExerciseTitle(source.sourceTitle);
      const savedId = preparation.savedMappings[sourceKey];
      const saved =
        savedId === undefined ? undefined : exercisesById.get(savedId);
      const suggestion = rankHevyExerciseCandidates(
        source.sourceTitle,
        preparation.exercises,
      )[0];

      return {
        source,
        ...(suggestion === undefined ? {} : { suggestion }),
        ...(saved === undefined
          ? {}
          : {
              resolution: {
                kind: 'existing' as const,
                exerciseId: saved.id,
              },
              resolutionSource: 'saved' as const,
            }),
      };
    });

  return {
    importableWorkouts: importable.length,
    skippedWorkouts: data.workouts.length - importable.length,
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
