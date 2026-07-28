import type {
  HevyImportData,
  HevySourceExercise,
} from '@/lib/hevyCsv';
import {
  findCanonicalHevyExercise,
  hevyExerciseSourceKey,
  normalizeHevyExerciseTitle,
} from '@/lib/hevyExerciseMatch';
import { selectHevyRoutineSources } from '@/lib/hevyRoutineSelection';
import type {
  HevyExerciseResolution,
  HevyExerciseResolutions,
  HevyImportPreparation,
} from '@/data/repositories/hevyImport';
import { nextHevyImportFolderName } from '@/data/repositories/hevyRoutineImport';

/**
 * Une ligne à associer.
 *
 * **Il n'y a délibérément plus de `suggestion`.** Le brouillon portait le
 * premier candidat du classement de secours, que la feuille affichait en bouton
 * primaire pleine largeur — donc une hypothèse habillée en certitude. Sur un
 * import réel, « Rotation Externe Poulie » s'y présentait comme « Crunch à la
 * poulie haute » et un seul appui gelait quatre séries d'épaules en
 * abdominaux, définitivement (l'instantané du jalon 08A).
 *
 * Ce que l'app croit probable n'a pas disparu pour autant : il **ordonne la
 * liste** de la feuille (`filterHevyMappingExercises`). Le bon candidat reste à
 * un appui, mais c'est un choix pris parmi ses alternatives, pas une réponse
 * qu'on entérine. `resolution` n'est donc jamais posé d'office que par un alias
 * canonique ou un mapping déjà mémorisé — les deux seules sources sûres.
 */
export interface HevyMappingDraftRow {
  source: HevySourceExercise;
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
        hevyExerciseSourceKey(exercise.sourceTitle),
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
        hevyExerciseSourceKey(source.sourceTitle),
      ),
    )
    .map((source): HevyMappingDraftRow => {
      const sourceKey = hevyExerciseSourceKey(source.sourceTitle);
      const legacyName = normalizeHevyExerciseTitle(source.sourceTitle);
      const savedId =
        preparation.savedMappings[sourceKey] ??
        preparation.savedMappings[legacyName] ??
        preparation.savedMappings[`${legacyName}|other`];
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
      const automatic = saved ?? canonical;
      const resolutionSource =
        saved !== undefined
          ? 'saved'
          : canonical !== undefined
            ? 'canonical'
            : undefined;

      return {
        source,
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
  const sourceKey = hevyExerciseSourceKey(sourceTitle);
  return {
    ...draft,
    rows: draft.rows.map((row) =>
      hevyExerciseSourceKey(row.source.sourceTitle) === sourceKey
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
    resolutions[hevyExerciseSourceKey(row.source.sourceTitle)] =
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
