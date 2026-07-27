import { normalizeSearch } from '@/data/repositories/exercises';
import type { Equipment, Exercise, MuscleGroup } from '@/data/types';
import type { HevyMappingDraftRow } from './hevyImportDraft';

export function filterHevyMappingExercises(
  exercises: readonly Exercise[],
  row: HevyMappingDraftRow | null,
  search: string,
  muscle?: MuscleGroup,
  equipment?: Equipment,
): Exercise[] {
  if (row === null) return [];
  const needle = normalizeSearch(search);
  return exercises.filter(
    (exercise) =>
      exercise.measurementType === row.source.measurementType &&
      normalizeSearch(exercise.name).includes(needle) &&
      (muscle === undefined || exercise.primaryMuscle === muscle) &&
      (equipment === undefined || exercise.equipment === equipment),
  );
}
