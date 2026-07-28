import { normalizeSearch } from '@/data/repositories/exercises';
import type { Equipment, Exercise, MuscleGroup } from '@/data/types';
import { rankHevyExerciseCandidates } from '@/lib/hevyExerciseMatch';
import type { HevyMappingDraftRow } from './hevyImportDraft';

/**
 * Les candidats compatibles, **du plus vraisemblable au moins**.
 *
 * C'est la place que le classement de secours aurait toujours dû occuper. En
 * tête d'une liste, il dit « voilà l'ordre le plus probable » et l'utilisateur
 * voit les alternatives autour ; promu en bouton primaire, il disait « c'est
 * celui-là » — et sur un titre que le catalogue ne couvrait pas, il se trompait
 * en gelant le passé. Rien n'est écarté : l'ordre change, jamais le contenu.
 */
export function filterHevyMappingExercises(
  exercises: readonly Exercise[],
  row: HevyMappingDraftRow | null,
  search: string,
  muscle?: MuscleGroup,
  equipment?: Equipment,
): Exercise[] {
  if (row === null) return [];
  const needle = normalizeSearch(search);
  const compatible = exercises.filter(
    (exercise) =>
      exercise.measurementType === row.source.measurementType &&
      normalizeSearch(exercise.name).includes(needle) &&
      (muscle === undefined || exercise.primaryMuscle === muscle) &&
      (equipment === undefined || exercise.equipment === equipment),
  );

  return rankHevyExerciseCandidates(row.source.sourceTitle, compatible);
}
