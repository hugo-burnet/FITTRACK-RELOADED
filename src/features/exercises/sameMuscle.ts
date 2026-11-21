import type { Exercise, MuscleGroup } from '@/data/types';

/**
 * Les exercices qui travaillent le même muscle principal que celui qu'on remplace,
 * celui-ci exclu, dans l'ordre reçu (déjà alphabétique).
 *
 * Remplacer un exercice, c'est chercher son équivalent : 175 lignes par ordre
 * alphabétique ne le proposent pas.
 */
export function sameMuscleExercises(
  exercises: readonly Exercise[],
  muscle: MuscleGroup | undefined,
  excludeId?: string,
): Exercise[] {
  if (muscle === undefined) return [];
  return exercises.filter((e) => e.primaryMuscle === muscle && e.id !== excludeId);
}
