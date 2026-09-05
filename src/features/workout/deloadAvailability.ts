import {
  workoutExerciseIdentityOf,
  type WorkoutExerciseDetail,
} from '@/data/repositories/workouts';
import { isDeloadEligibleMeasurement } from '@/lib/deload';
import { matchPreviousSets } from '@/lib/previousSets';

/**
 * Y a-t-il seulement quelque chose à alléger ?
 *
 * Une charge à réduire, et une série à qui la réduire : sans les deux, la
 * commande n'a pas d'objet. La réponse se lit sur les séries **restantes** —
 * alléger ce qui est déjà soulevé n'a aucun sens — et sur ce qui leur tient
 * lieu de charge, dans l'ordre où l'écran la propose : la valeur saisie, sinon
 * la cible, sinon la référence de la dernière fois.
 *
 * Sorti de `WorkoutScreen`, où il vivait en fonction anonyme appelée sur place
 * au milieu du rendu : deux surfaces le lisent maintenant — le bandeau, qui
 * n'affiche l'état que s'il est vrai, et le menu de séance, qui grise l'entrée
 * quand il n'y a rien à alléger.
 */
export function canDeloadWorkout(exercises: readonly WorkoutExerciseDetail[]): boolean {
  return exercises.some((line) => {
    if (!isDeloadEligibleMeasurement(workoutExerciseIdentityOf(line).measurementType)) return false;
    const previous = matchPreviousSets(line.sets, line.previous);
    return line.sets.some(
      (set, index) =>
        set.isCompleted === 0 &&
        (set.weight ?? set.targetWeight ?? previous[index]?.weight) !== undefined,
    );
  });
}
