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

import { normalizeRoutineName } from './routineName';

/** Une routine candidate, dans l'ordre où l'utilisateur l'a rangée. */
export interface SuggestionCandidate {
  routineId: string;
  /** Son nom — le rattrapage quand la séance n'a pas gardé de `routineId`. */
  name: string;
  /** `Routine.order` — la départage quand les dates ne suffisent pas. */
  order: number;
}

/** Une séance terminée, réduite à ce que la suggestion en lit. */
export interface SuggestionWorkout {
  /** `''` pour une séance libre ou un import sans routine d'origine. */
  routineId: string;
  /** Le titre de la séance — le seul lien restant quand `routineId` ne dit rien. */
  name: string;
  startedAt: number;
}

export interface SuggestedPick {
  routineId: string;
  /** `null` quand la routine n'a jamais été réalisée. */
  lastPerformedAt: number | null;
}

/**
 * Les routines candidates indexées par nom, pour rattacher les séances qui n'ont
 * pas de `routineId`.
 *
 * Un nom porté par deux routines vaut `null` : on ne devine pas laquelle a été
 * faite, et un tirage au sort qui change d'un chargement à l'autre serait pire
 * que de ne rien rattacher.
 */
function candidatesByName(
  candidates: readonly SuggestionCandidate[],
): Map<string, string | null> {
  const byName = new Map<string, string | null>();

  for (const candidate of candidates) {
    const key = normalizeRoutineName(candidate.name);
    if (key === '') continue;
    byName.set(key, byName.has(key) ? null : candidate.routineId);
  }

  return byName;
}

/**
 * La routine à laquelle une séance compte, ou `null` si aucune.
 *
 * `routineId` d'abord, le nom ensuite. Le rattrapage par le nom n'est pas un
 * confort : l'import Hevy écrit ses séances **sans** `routineId` tout en
 * fabriquant les routines à partir de ces mêmes séances groupées par titre.
 * Sans lui, une bibliothèque importée reste « jamais réalisée » pour toujours,
 * et l'accueil propose sa routine dans un ordre qui n'a aucun sens.
 *
 * Rattacher au nom **d'une routine existante** ne fait pas revenir une routine
 * supprimée : elle n'est pas candidate, donc elle n'est proposable par aucun
 * chemin.
 */
function attributedRoutineId(
  workout: SuggestionWorkout,
  known: ReadonlySet<string>,
  byName: ReadonlyMap<string, string | null>,
): string | null {
  if (known.has(workout.routineId)) return workout.routineId;
  return byName.get(normalizeRoutineName(workout.name)) ?? null;
}

/** Date de la dernière réalisation de chaque routine **connue**. */
function lastPerformedByRoutine(
  workouts: readonly SuggestionWorkout[],
  candidates: readonly SuggestionCandidate[],
): Map<string, number> {
  const known = new Set(candidates.map((candidate) => candidate.routineId));
  const byName = candidatesByName(candidates);
  const lastPerformed = new Map<string, number>();

  for (const workout of workouts) {
    const routineId = attributedRoutineId(workout, known, byName);
    if (routineId === null) continue;
    const current = lastPerformed.get(routineId);
    if (current === undefined || workout.startedAt > current) {
      lastPerformed.set(routineId, workout.startedAt);
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

  const lastPerformed = lastPerformedByRoutine(completedWorkouts, candidates);

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
