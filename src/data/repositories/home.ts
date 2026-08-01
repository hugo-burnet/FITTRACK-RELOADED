import { getWeeklyTrainingGoalHistory } from './settings';
import {
  buildWorkoutSummaries,
  listCompletedWorkouts,
  type HistoryWorkoutSummary,
} from './history';
import { listRoutineSummaries } from './routines';
import { pickSuggestedRoutine } from '@/lib/home';
import type { WeeklyTrainingGoal } from '@/lib/history';

/**
 * Tout ce que l'accueil affiche, en une lecture.
 *
 * Une seule fonction et pas quatre requêtes côté écran : les trois blocs lisent
 * la même liste de séances terminées (la régularité ses dates, la suggestion ses
 * `routineId`, le mini-historique ses trois premières lignes), et trois
 * parcours de la même table pour une seule page serait exactement le N+1 que
 * `listRoutineSummaries` documente déjà.
 */

/** Ce que la carte « À lancer » a besoin de dire. */
export interface SuggestedRoutine {
  routineId: string;
  name: string;
  exerciseCount: number;
  setCount: number;
  /** `null` quand la routine n'a jamais été réalisée. */
  lastPerformedAt: number | null;
}

export interface HomeDashboardData {
  /** Toutes les dates de séances terminées — la matière de `calculateWeeklyRegularity`. */
  completedWorkoutTimestamps: number[];
  weeklyGoalHistory: WeeklyTrainingGoal[];
  /** Compté même quand rien n'est suggérable, pour distinguer les deux vides. */
  routineCount: number;
  suggestedRoutine: SuggestedRoutine | null;
  recentWorkouts: HistoryWorkoutSummary[];
}

/** Trois lignes : au-delà, c'est l'Historique, qui est à un onglet d'ici. */
const RECENT_WORKOUT_COUNT = 3;

export async function getHomeDashboard(): Promise<HomeDashboardData> {
  const [completed, routines, weeklyGoalHistory] = await Promise.all([
    listCompletedWorkouts(),
    listRoutineSummaries(),
    getWeeklyTrainingGoalHistory(),
  ]);

  const pick = pickSuggestedRoutine(
    routines.map(({ routine }) => ({ routineId: routine.id, order: routine.order })),
    completed.map(({ routineId, startedAt }) => ({ routineId, startedAt })),
  );
  const picked =
    pick === null
      ? undefined
      : routines.find(({ routine }) => routine.id === pick.routineId);

  return {
    completedWorkoutTimestamps: completed.map((workout) => workout.startedAt),
    weeklyGoalHistory,
    routineCount: routines.length,
    suggestedRoutine:
      pick === null || picked === undefined
        ? null
        : {
          routineId: picked.routine.id,
          name: picked.routine.name,
          exerciseCount: picked.exerciseCount,
          setCount: picked.setCount,
          lastPerformedAt: pick.lastPerformedAt,
        },
    // `slice` avant `buildWorkoutSummaries` : les compteurs d'exercices et de
    // séries ne sont lus que pour les trois lignes affichées, pas pour toute
    // la base.
    recentWorkouts: await buildWorkoutSummaries(completed.slice(0, RECENT_WORKOUT_COUNT)),
  };
}
