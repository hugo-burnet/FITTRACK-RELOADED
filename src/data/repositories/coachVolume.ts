import { MUSCLE_GROUPS, type MuscleGroup } from '@/data/types';
import { MUSCLE_SCOPE } from '@/lib/analytics/muscles';
import {
  completeWeeks,
  effectiveCeiling,
  volumeLowMuscles,
  volumeOverview,
  type VolumeBounds,
  type VolumeEntry,
  type VolumeLow,
  type VolumeOverview,
} from '@/lib/coach/volume';
import { isWorkingSet } from '@/lib/records';
import { listHistoricalWorkouts } from './historicalWorkouts';
import { getCoachVolumeBounds } from './settings';
import { workoutExerciseIdentityOf, type WorkoutDetail } from './workoutDetail';

/**
 * R6 — ce que l'historique dit du volume de chaque muscle, lu pour les règles de
 * `lib/coach/volume` et pour l'écran « Volume par muscle ». Cf.
 * `docs/design/specs/2026-10-04-coach-v2-design.md`, R6.
 *
 * Aucun écran n'ouvre l'historique lui-même : il passe par ici, comme pour le reste.
 */

/**
 * Les séries de travail de chaque séance terminée, par exercice, sur la fenêtre que les règles
 * lisent : les six semaines complètes avant `now`, et la semaine en cours jusqu'à lui.
 *
 * `excludeWorkoutId` écarte la séance qu'on évalue : à l'écran de fin elle est encore ouverte et se
 * compte par `volumeEntriesOfWorkout` ; une fois terminée, elle serait comptée deux fois.
 */
export async function loadVolumeEntries(
  now: number,
  options: { excludeWorkoutId?: string } = {},
): Promise<VolumeEntry[]> {
  const from = completeWeeks(now)[0]!.start;
  const workouts = await listHistoricalWorkouts({ kind: 'period', from, to: now + 1 });

  return workouts
    .filter((workout) => workout.workoutId !== options.excludeWorkoutId)
    .flatMap((workout) =>
      workout.exercises.map((exercise) => ({
        at: workout.startedAt,
        muscle: exercise.primaryMuscle,
        sets: exercise.sets.filter(isWorkingSet).length,
      })),
    )
    .filter((entry) => entry.sets > 0);
}

/**
 * Les séries **validées** d'une séance lue en direct, par exercice : l'écran de fin évalue une séance
 * que l'historique ne contient pas encore, et une série pas validée n'a pas eu lieu.
 */
export function volumeEntriesOfWorkout(detail: WorkoutDetail): VolumeEntry[] {
  return detail.exercises
    .map((line) => ({
      at: detail.workout.startedAt,
      muscle: workoutExerciseIdentityOf(line).primaryMuscle,
      sets: line.sets.filter((set) => set.isCompleted === 1 && isWorkingSet(set)).length,
    }))
    .filter((entry) => entry.sets > 0);
}

/** Un muscle tel que l'écran le montre : son historique, ses bornes, le plafond qui en résulte. */
export interface MuscleVolumeRow {
  muscle: MuscleGroup;
  overview: VolumeOverview;
  /** Ce que la personne a posé, rien d'autre. */
  bounds: VolumeBounds;
  /** Le plafond que le coach lira : le sien, ou le plus haut volume qu'elle a tenu. */
  ceiling?: number;
  ceilingUserSet: boolean;
}

/** Les seize régions du corps, dans l'ordre du corps, un muscle jamais travaillé compris. */
export async function getVolumeOverview(now = Date.now()): Promise<MuscleVolumeRow[]> {
  const [entries, bounds] = await Promise.all([loadVolumeEntries(now), getCoachVolumeBounds()]);

  return MUSCLE_GROUPS.filter((muscle) => MUSCLE_SCOPE[muscle] === 'region').map((muscle) => {
    const overview = volumeOverview(entries, muscle, now);
    const mine = bounds[muscle] ?? {};
    const ceiling = effectiveCeiling(overview, mine);
    return {
      muscle,
      overview,
      bounds: mine,
      ...(ceiling === undefined ? {} : { ceiling }),
      ceilingUserSet: mine.ceiling !== undefined,
    };
  });
}

/** Les muscles sous le plancher que la personne a posé, deux semaines complètes de suite. */
export async function listVolumeLow(now = Date.now()): Promise<VolumeLow[]> {
  const bounds = await getCoachVolumeBounds();
  // Sans plancher posé, il n'y a rien à lire : on s'épargne la lecture de l'historique.
  if (!Object.values(bounds).some((entry) => entry.floor !== undefined)) return [];

  return volumeLowMuscles(await loadVolumeEntries(now), bounds, now);
}
