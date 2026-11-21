import { useLiveQuery } from 'dexie-react-hooks';
import { liveExerciseIds } from '@/data/repositories/exercises';

/**
 * « Cet exercice a-t-il encore une page ? » — pour les écrans qui lisent des
 * exercices dans l'historique ou les records, dont le nom survit à la suppression
 * (suppression douce) alors que `/exercises/:id` répond « Cet exercice n'existe
 * plus ». Une seule lecture des ids vivants, pas une requête par ligne.
 *
 * Tant que la lecture n'a pas répondu, tout est lien : un lien qui s'éteint une
 * fois sur mille vaut mieux qu'une liste dont les lignes clignotent.
 */
export function useExerciseLinks(): (exerciseId: string) => boolean {
  const live = useLiveQuery(() => liveExerciseIds(), []);
  return (exerciseId) => live === undefined || live.has(exerciseId);
}
