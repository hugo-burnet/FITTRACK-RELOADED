import { getWeeklyTrainingGoalHistory } from './settings';
import {
  buildWorkoutSummaries,
  listCompletedWorkouts,
  type HistoryWorkoutSummary,
} from './history';
import { getActiveProgramDetail } from './programs';
import { getRoutineDetail, listRoutineSummaries } from './routines';
import { pickSuggestedRoutine } from '@/lib/home';
import { pickProgramSession } from '@/lib/programs';
import type { WeeklyTrainingGoal } from '@/lib/history';
import type { ProgramPrescriptionKind } from '@/data/types';

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

export interface HomeProgramWeek {
  weekIndex: number;
  prescriptionKind: ProgramPrescriptionKind;
  prescriptionValue: number;
  isDeload: 0 | 1;
}

export type HomeProgramPick =
  | {
      kind: 'session';
      rule: 'today' | 'missed' | 'upcoming';
      programScheduleEntryId: string;
      routineId: string;
      routineName: string | null;
      scheduledAt: number;
    }
  | {
      kind: 'announcement';
      rule: 'starts' | 'next_week';
      startsAt: number;
      weekIndex: number;
    }
  | { kind: 'none' };

/** Ready-to-render program state. Home never re-ranks schedule entries. */
export interface HomeProgramProjection {
  programId: string;
  programName: string;
  startsAt: number;
  durationWeeks: number;
  week: HomeProgramWeek | null;
  pick: HomeProgramPick;
}

export interface HomeDashboardData {
  /** Toutes les dates de séances terminées — la matière de `calculateWeeklyRegularity`. */
  completedWorkoutTimestamps: number[];
  weeklyGoalHistory: WeeklyTrainingGoal[];
  /** Compté même quand rien n'est suggérable, pour distinguer les deux vides. */
  routineCount: number;
  activeProgram: HomeProgramProjection | null;
  suggestedRoutine: SuggestedRoutine | null;
  recentWorkouts: HistoryWorkoutSummary[];
}

/** Trois lignes : au-delà, c'est l'Historique, qui est à un onglet d'ici. */
const RECENT_WORKOUT_COUNT = 3;

function programDayTimestamp(startsAt: number, weekIndex: number, dayOfWeek = 1): number {
  const date = new Date(startsAt);
  date.setDate(date.getDate() + weekIndex * 7 + dayOfWeek - 1);
  return date.getTime();
}

async function readHomeProgramProjection(at: number): Promise<HomeProgramProjection | null> {
    const detail = await getActiveProgramDetail(at);
    if (detail === null || detail.position.phase === 'after') return null;

    const weekIndex = detail.position.phase === 'before' ? 0 : detail.position.weekIndex;
    const week = detail.weeks.find((candidate) => candidate.weekIndex === weekIndex) ?? null;
    const base = {
      programId: detail.program.id,
      programName: detail.program.name,
      startsAt: detail.program.startsAt,
      durationWeeks: detail.program.durationWeeks,
      week:
        week === null
          ? null
          : {
              weekIndex: week.weekIndex,
              prescriptionKind: week.prescriptionKind,
              prescriptionValue: week.prescriptionValue,
              isDeload: week.isDeload,
            },
    };

    if (detail.position.phase === 'before') {
      return {
        ...base,
        pick: {
          kind: 'announcement',
          rule: 'starts',
          startsAt: detail.program.startsAt,
          weekIndex: 0,
        },
      };
    }

    const currentWeekIndex = detail.position.weekIndex;
    const completedEntryIds = new Set(
      detail.completedWorkouts
        .filter((workout) => workout.programWeekIndex === currentWeekIndex)
        .map((workout) => workout.programScheduleEntryId),
    );
    const picked = pickProgramSession(
      detail.resolvedEntries.map((entry) => ({
        entryId: entry.id,
        routineId: entry.routineId,
        weekIndex: currentWeekIndex,
        dayOfWeek: entry.dayOfWeek,
        order: entry.order,
        completed: completedEntryIds.has(entry.id),
      })),
      detail.position,
      detail.program.durationWeeks,
    );

    if ('session' in picked) {
      const routine = await getRoutineDetail(picked.session.routineId);
      return {
        ...base,
        pick: {
          kind: 'session',
          rule: picked.kind,
          programScheduleEntryId: picked.session.entryId,
          routineId: picked.session.routineId,
          routineName: routine?.routine.name ?? null,
          scheduledAt: programDayTimestamp(
            detail.program.startsAt,
            picked.session.weekIndex,
            picked.session.dayOfWeek,
          ),
        },
      };
    }

    if (picked.kind === 'next_week') {
      const nextWeek = detail.weeks.find(
        (candidate) => candidate.weekIndex === picked.weekIndex,
      );
      return {
        ...base,
        week:
          nextWeek === undefined
            ? null
            : {
                weekIndex: nextWeek.weekIndex,
                prescriptionKind: nextWeek.prescriptionKind,
                prescriptionValue: nextWeek.prescriptionValue,
                isDeload: nextWeek.isDeload,
              },
        pick: {
          kind: 'announcement',
          rule: 'next_week',
          startsAt: programDayTimestamp(detail.program.startsAt, picked.weekIndex),
          weekIndex: picked.weekIndex,
        },
      };
    }

    return { ...base, pick: { kind: 'none' } };
}

export async function getHomeDashboard(): Promise<HomeDashboardData> {
  const [completed, routines, weeklyGoalHistory, activeProgram] = await Promise.all([
    listCompletedWorkouts(),
    listRoutineSummaries(),
    getWeeklyTrainingGoalHistory(),
    readHomeProgramProjection(Date.now()),
  ]);

  const pick = pickSuggestedRoutine(
    routines.map(({ routine }) => ({
      routineId: routine.id,
      name: routine.name,
      order: routine.order,
    })),
    // Le nom voyage avec la séance : les séances importées n'ont pas de
    // `routineId`, c'est par leur titre que `pickSuggestedRoutine` les rattache.
    completed.map(({ routineId, name, startedAt }) => ({ routineId, name, startedAt })),
  );
  const picked =
    pick === null
      ? undefined
      : routines.find(({ routine }) => routine.id === pick.routineId);

  return {
    completedWorkoutTimestamps: completed.map((workout) => workout.startedAt),
    weeklyGoalHistory,
    routineCount: routines.length,
    activeProgram,
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
