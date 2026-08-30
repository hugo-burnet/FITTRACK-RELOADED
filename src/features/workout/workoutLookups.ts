import { workoutExerciseIdentityOf } from '@/data/repositories/workouts';
import type { WorkoutExerciseDetail } from '@/data/repositories/workouts';
import type { SetType, WorkoutSet } from '@/data/types';
import { t } from '@/i18n/fr';

/**
 * Retrouver une ligne, une série, un nom — depuis un identifiant qu'une feuille
 * a gardé sous la main.
 *
 * **Toutes rendent une valeur de repli plutôt que de lever.** C'est la règle qui
 * fait exister ce module : les feuilles de l'écran de séance survivent à la
 * ligne qui les a ouvertes. On supprime un exercice, la feuille est encore là
 * le temps de son animation de fermeture, et elle demande le nom d'une ligne qui
 * n'existe plus. Une exception à cet instant précis ferait tomber l'écran de
 * séance en cours — l'écran qu'on tient d'une main, en sueur, entre deux séries.
 *
 * Sorties de `WorkoutScreen` parce qu'elles ne lisent que la liste des
 * exercices : rien ici ne connaît l'état des feuilles, des minuteurs ou du
 * tutoriel, et c'est ce qui les rend testables sans monter un écran.
 */

/** La ligne, ou `null` si elle vient d'être supprimée. */
export function workoutLineOf(
  exercises: readonly WorkoutExerciseDetail[],
  rowId: string,
): WorkoutExerciseDetail | null {
  return exercises.find((line) => line.row.id === rowId) ?? null;
}

/**
 * Le nom affichable de la ligne.
 *
 * L'identité vient de l'instantané de séance, jamais de la bibliothèque
 * d'aujourd'hui : une séance de 2023 se relit avec le nom qu'avait l'exercice ce
 * jour-là. Une ligne disparue prend le libellé « exercice supprimé », qui est
 * une phrase et non un identifiant.
 */
export function workoutExerciseNameOf(
  exercises: readonly WorkoutExerciseDetail[],
  rowId: string,
): string {
  const line = workoutLineOf(exercises, rowId);
  return line === null
    ? t('workout.deletedExercise')
    : (workoutExerciseIdentityOf(line).name ?? t('workout.deletedExercise'));
}

/** La série, où qu'elle soit dans la séance. `undefined` si elle a été supprimée. */
export function workoutSetOf(
  exercises: readonly WorkoutExerciseDetail[],
  setId: string,
): WorkoutSet | undefined {
  for (const line of exercises) {
    const found = line.sets.find((set) => set.id === setId);
    if (found !== undefined) return found;
  }
  return undefined;
}

/**
 * Le type de la série, `normal` par défaut.
 *
 * Le repli n'est pas une commodité : la feuille de type lit cette valeur pour
 * cocher son option courante, et une série disparue ne doit pas laisser la
 * feuille sans sélection du tout.
 */
export function workoutSetTypeOf(
  exercises: readonly WorkoutExerciseDetail[],
  setId: string,
): SetType {
  return workoutSetOf(exercises, setId)?.setType ?? 'normal';
}

/**
 * Les charges distinctes de la ligne, dans l'ordre où elles apparaissent.
 *
 * L'échauffement et les séries dégressives comptent : le calculateur de plaques
 * sert à monter **et** à démonter la barre, donc il doit voir les 40 kg de
 * l'échauffement autant que les 100 kg de la série de travail. Les zéros et les
 * charges absentes sont écartés — une barre à vide n'a pas de plaques à poser.
 */
export function workoutExerciseLoads(line: WorkoutExerciseDetail): number[] {
  const seen = new Set<number>();
  const loads: number[] = [];
  for (const set of line.sets) {
    const weight = set.weight ?? set.targetWeight;
    if (weight !== undefined && weight > 0 && !seen.has(weight)) {
      seen.add(weight);
      loads.push(weight);
    }
  }
  return loads;
}
