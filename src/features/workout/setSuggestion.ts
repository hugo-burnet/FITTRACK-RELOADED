import type { SetValues } from '@/data/repositories/workouts';
import type { WorkoutSet } from '@/data/types';
import { isRepRange, type TargetField } from '@/lib/measurement';
import { isWorkingSet } from '@/lib/records';

export const FIELD_KEY = {
  weight: 'weight',
  reps: 'reps',
  duration: 'durationSeconds',
  distance: 'distanceMeters',
} as const satisfies Record<TargetField, keyof SetValues>;

const TARGET_KEY = {
  weight: 'targetWeight',
  reps: 'targetReps',
  duration: 'targetDurationSeconds',
  distance: 'targetDistanceMeters',
} as const satisfies Record<TargetField, keyof WorkoutSet>;

/**
 * La série de la séance en cours dont une série de travail peut reprendre les chiffres en grisé :
 * la série de travail juste au-dessus, **si elle est validée**.
 *
 * Pourquoi : à la première séance (ou sur un exercice neuf) il n'y a pas de « dernière fois », et
 * chaque série se ressaisissait entièrement au clavier (audit v2.19, constat 7). La règle « ne jamais
 * emprunter un autre rang » protégeait la coche, qui enregistre le grisé d'un tap ; elle est levée
 * ici, et seulement ici, parce que la série du dessus est ce qu'on vient *de faire*, sous ses yeux.
 *
 * - Validée seulement : une saisie en cours n'est pas une performance, elle peut encore changer.
 * - Un échauffement ne suggère jamais une série de travail : on le saute pour remonter au travail
 *   (le défaut de `duplicateLastSet`, consigné dans decisions-et-pieges, qui offrait 40 × 5 à 100 × 8).
 * - Un échauffement ne reçoit rien d'ici : sa rampe monte, la série du dessus est toujours fausse.
 */
export function suggestionAbove<T extends Pick<WorkoutSet, 'setType' | 'isCompleted'>>(
  sets: readonly T[],
  index: number,
): T | undefined {
  const set = sets[index];
  if (set === undefined || !isWorkingSet(set)) return undefined;
  for (let rank = index - 1; rank >= 0; rank -= 1) {
    const candidate = sets[rank];
    if (candidate === undefined || !isWorkingSet(candidate)) continue;
    return candidate.isCompleted === 1 ? candidate : undefined;
  }
  return undefined;
}

export type SuggestionSources = {
  /** La série validée juste au-dessus dans la séance en cours (`suggestionAbove`). */
  above?: WorkoutSet;
  /** Le même rang à la séance précédente. */
  previous?: WorkoutSet;
  /** Série à l'échec : les répétitions sont le résultat, jamais une proposition. */
  amrap?: boolean;
};

/**
 * Le chiffre gris d'une case — celui que la coche enregistre si rien n'est tapé.
 *
 * Priorité : la prescription du jour (cible chiffrée de la routine ou du coach), puis la série du
 * dessus, puis la séance précédente, puis rien. Une fourchette n'est pas un chiffre : les
 * répétitions viennent alors de la source suivante.
 *
 * Une seule source pour toute la ligne, jamais une case de l'une et une case de l'autre : une série
 * du dessus au poids du corps ne doit pas reprendre la charge de la dernière fois.
 */
export function suggestedNumber(
  set: WorkoutSet,
  field: TargetField,
  { above, previous, amrap = false }: SuggestionSources,
): number | undefined {
  if (amrap && field === 'reps') return undefined;
  const source = above ?? previous;
  const fromSource = source?.[FIELD_KEY[field]];
  if (field === 'reps' && isRepRange(set)) return fromSource;
  return set[TARGET_KEY[field]] ?? fromSource;
}
