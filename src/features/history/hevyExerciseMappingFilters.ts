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
      exercise.deletedAt === 0 &&
      exercise.measurementType === row.source.measurementType &&
      normalizeSearch(exercise.name).includes(needle) &&
      (muscle === undefined || exercise.primaryMuscle === muscle) &&
      (equipment === undefined || exercise.equipment === equipment),
  );
  const compatibleById = new Map(
    compatible.map((exercise) => [exercise.id, exercise]),
  );
  const reviewSuggestions =
    row.review.status === 'confirmed'
      ? []
      : row.review.suggestions;
  const prioritized: Exercise[] = [];
  const prioritizedIds = new Set<string>();
  for (const suggestion of reviewSuggestions) {
    const current = compatibleById.get(suggestion.exercise.id);
    if (
      current !== undefined &&
      !prioritizedIds.has(current.id)
    ) {
      prioritized.push(current);
      prioritizedIds.add(current.id);
    }
  }

  return [
    ...prioritized,
    ...rankHevyExerciseCandidates(
      row.source.sourceTitle,
      compatible.filter(
        (exercise) => !prioritizedIds.has(exercise.id),
      ),
    ),
  ];
}
