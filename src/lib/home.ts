/**
 * Quelle routine lancer aujourd'hui — la seule décision que l'accueil prend.
 *
 * La règle est volontairement bête et lisible : **la routine active réalisée le
 * moins récemment**, une routine jamais faite passant devant toutes les autres.
 * Pas de modèle de récupération musculaire : il demanderait des données que
 * l'app n'a pas (sommeil, courbatures, ce que tu as prévu de faire demain) et
 * une suggestion qu'on ne peut pas expliquer en une phrase est une suggestion
 * qu'on ignore.
 *
 * Fonction pure et pas une requête : c'est ici que vivent les cas tordus — une
 * séance libre, un import Hevy sans routine derrière, une routine supprimée dont
 * les séances restent dans l'historique — et ils se testent sans base.
 */

/** Une routine candidate, dans l'ordre où l'utilisateur l'a rangée. */
export interface SuggestionCandidate {
  routineId: string;
  /** `Routine.order` — la départage quand les dates ne suffisent pas. */
  order: number;
}

/** Une séance terminée, réduite à ce que la suggestion en lit. */
export interface SuggestionWorkout {
  /** `''` pour une séance libre ou un import sans routine d'origine. */
  routineId: string;
  startedAt: number;
}

export interface SuggestedPick {
  routineId: string;
  /** `null` quand la routine n'a jamais été réalisée. */
  lastPerformedAt: number | null;
}

/**
 * Date de la dernière réalisation de chaque routine **connue**.
 *
 * Le filtre sur `known` est ce qui empêche une routine supprimée de revenir par
 * la porte de l'historique : ses séances existent encore, elle non.
 */
function lastPerformedByRoutine(
  workouts: readonly SuggestionWorkout[],
  known: ReadonlySet<string>,
): Map<string, number> {
  const lastPerformed = new Map<string, number>();

  for (const workout of workouts) {
    if (workout.routineId === '' || !known.has(workout.routineId)) continue;
    const current = lastPerformed.get(workout.routineId);
    if (current === undefined || workout.startedAt > current) {
      lastPerformed.set(workout.routineId, workout.startedAt);
    }
  }

  return lastPerformed;
}

/**
 * La routine à proposer, ou `null` s'il n'y en a aucune.
 *
 * L'ordre de parcours est figé (`order` puis `routineId`) avant la comparaison :
 * à égalité de date — deux routines jamais faites, ou deux séances le même
 * jour — c'est toujours la même qui sort, quel que soit l'ordre dans lequel la
 * base a rendu les lignes.
 */
export function pickSuggestedRoutine(
  candidates: readonly SuggestionCandidate[],
  completedWorkouts: readonly SuggestionWorkout[],
): SuggestedPick | null {
  if (candidates.length === 0) return null;

  const lastPerformed = lastPerformedByRoutine(
    completedWorkouts,
    new Set(candidates.map((candidate) => candidate.routineId)),
  );

  const ranked = [...candidates].sort(
    (left, right) =>
      left.order - right.order || left.routineId.localeCompare(right.routineId),
  );

  let best: SuggestedPick | undefined;

  for (const candidate of ranked) {
    const lastPerformedAt = lastPerformed.get(candidate.routineId) ?? null;

    if (best === undefined) {
      best = { routineId: candidate.routineId, lastPerformedAt };
      continue;
    }
    // Rien ne bat une routine jamais réalisée, et la première rencontrée garde
    // la place : l'ordre de la liste tranche.
    if (best.lastPerformedAt === null) continue;
    if (lastPerformedAt === null || lastPerformedAt < best.lastPerformedAt) {
      best = { routineId: candidate.routineId, lastPerformedAt };
    }
  }

  return best ?? null;
}
