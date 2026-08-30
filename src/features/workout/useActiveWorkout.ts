import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getActiveWorkout, getWorkoutDetail } from '@/data/repositories/workouts';
import type { WorkoutDetail } from '@/data/repositories/workouts';
import { getAvailablePlateWeightsKg, getDefaultRepSeconds } from '@/data/repositories/settings';
import { listPendingRecommendations } from '@/data/repositories/coachRecommendations';
import { listRecordsForWorkout } from '@/data/repositories/personalRecords';
import { useHoldTimer } from '@/stores/holdTimer';
import { useRestTimer } from '@/stores/restTimer';
import { useWorkoutAnnouncements } from './useWorkoutAnnouncements';

/** Le nom et les notes en cours de frappe, avant leur aller-retour dans Dexie. */
export interface WorkoutDraft {
  id: string;
  name: string;
  notes: string;
}

export interface ActiveWorkoutData {
  /** `undefined` = en cours de lecture, `null` = aucune séance en cours. */
  active: Awaited<ReturnType<typeof getActiveWorkout>> | null | undefined;
  detail: WorkoutDetail | null | undefined;
  workoutId: string | undefined;
  availablePlateWeightsKg: number[] | undefined;
  defaultRepSeconds: number | undefined;
  recordEntries: Awaited<ReturnType<typeof listRecordsForWorkout>> | undefined;
  pendingCoach: Awaited<ReturnType<typeof listPendingRecommendations>> | undefined;
  /**
   * Le brouillon du nom et des notes, recalé sur la séance dès qu'elle change.
   *
   * Il existe parce que les deux champs écrivent en base à chaque frappe : sans
   * état local, le curseur sauterait à la fin du champ à chaque aller-retour
   * dans Dexie.
   */
  draft: WorkoutDraft | null;
  setDraft: Dispatch<SetStateAction<WorkoutDraft | null>>;
}

/**
 * Tout ce que l'écran de séance lit, et rien de ce qu'il dessine.
 *
 * **Six lectures vivantes, et la distinction qui compte tient dans la
 * première.** `active` vaut `undefined` tant que Dexie n'a pas répondu et `null`
 * quand il n'y a pas de séance en cours : confondre les deux ferait clignoter
 * « aucune séance » le temps d'une requête, sur un écran ouvert au milieu d'un
 * effort. `useLiveQuery` ne sépare pas ces deux cas tout seul — c'est le
 * `?? null` de la requête qui le fait.
 *
 * Le hook porte aussi les deux ménages qui n'ont pas d'autre endroit où vivre :
 * un repos et un chrono dont la série a été supprimée avec sa ligne ne
 * s'arrêteraient jamais seuls, parce que plus rien à l'écran ne les représente.
 */
export function useActiveWorkout(): ActiveWorkoutData {
  // Keep loading (`undefined`) distinct from no active workout (`null`).
  const active = useLiveQuery(async () => (await getActiveWorkout()) ?? null);
  const detail = useLiveQuery(
    async () => (active == null ? null : await getWorkoutDetail(active.id)),
    [active?.id],
  );
  const availablePlateWeightsKg = useLiveQuery(getAvailablePlateWeightsKg);
  const defaultRepSeconds = useLiveQuery(getDefaultRepSeconds);

  const recordEntries = useLiveQuery(
    async () => (active == null ? undefined : listRecordsForWorkout(active.id)),
    [active?.id],
  );

  const pendingCoach = useLiveQuery(async () => {
    if (detail == null) return [] as Awaited<ReturnType<typeof listPendingRecommendations>>;
    const ids = detail.exercises.map((line) => line.row.exerciseId);
    const pending = await listPendingRecommendations(ids);
    return detail.workout.programId === undefined
      ? pending
      : pending.filter((recommendation) => recommendation.nextLoadKg === undefined);
  }, [detail?.workout.id, detail?.exercises.map((line) => line.row.exerciseId).join('|')]);

  const workoutId = detail?.workout.id;
  const openedSets =
    detail?.exercises.reduce(
      (count, line) => count + line.sets.filter((set) => set.isCompleted === 1).length,
      0,
    ) ?? 0;
  const availableSets =
    detail?.exercises.reduce(
      (count, line) => count + line.sets.filter((set) => set.deletedAt === 0).length,
      0,
    ) ?? 0;

  useWorkoutAnnouncements({ workoutId, openedSets, availableSets, recordEntries });

  const restingSetId = useRestTimer((state) => state.setId);
  const stopRest = useRestTimer((state) => state.stop);
  const holdSetId = useHoldTimer((state) => state.setId);
  const stopHold = useHoldTimer((state) => state.stop);

  // Stop rests whose set was deleted with its row or exercise.
  useEffect(() => {
    if (restingSetId === null || detail == null) return;
    const alive = detail.exercises.some((line) => line.sets.some((set) => set.id === restingSetId));
    if (!alive) stopRest(restingSetId);
  }, [restingSetId, detail, stopRest]);

  // Même raison que pour le repos : un chrono qui suit un set supprimé avec sa
  // ligne ou son exercice ne s'arrêterait jamais tout seul.
  useEffect(() => {
    if (holdSetId === null || detail == null) return;
    const alive = detail.exercises.some((line) => line.sets.some((set) => set.id === holdSetId));
    if (!alive) stopHold(holdSetId);
  }, [holdSetId, detail, stopHold]);

  const [draft, setDraft] = useState<WorkoutDraft | null>(null);
  if (detail != null && draft?.id !== detail.workout.id) {
    setDraft({
      id: detail.workout.id,
      name: detail.workout.name,
      notes: detail.workout.notes ?? '',
    });
  }

  return {
    active,
    detail,
    workoutId,
    availablePlateWeightsKg,
    defaultRepSeconds,
    recordEntries,
    pendingCoach,
    draft,
    setDraft,
  };
}
