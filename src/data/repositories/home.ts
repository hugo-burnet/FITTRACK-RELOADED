import { getRoutineFolderContext, getWeeklyTrainingGoalHistory } from './settings';
import {
  buildWorkoutSummaries,
  listCompletedWorkouts,
  type HistoryWorkoutSummary,
} from './history';
import { getActiveProgramDetail } from './programs';
import { listFolders } from './routineFolders';
import { getRoutineDetail, listRoutineSummaries } from './routines';
import { pickSuggestedRoutine } from '@/lib/home';
import { pickProgramSession } from '@/lib/programs';
import { routineContextValues, type RoutineContextValue } from '@/lib/routineContext';
import type { WeeklyTrainingGoal } from '@/lib/history';
import type { ProgramLoadIndex, ProgramPhase } from '@/data/types';

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
  loadIndex: ProgramLoadIndex;
  phase: ProgramPhase;
}

export type HomeProgramPick =
  | {
      kind: 'session';
      rule: 'today' | 'missed' | 'upcoming';
      programScheduleEntryId: string;
      routineId: string;
      routineName: string | null;
      scheduledAt: number;
      repairUnavailableReason?: 'locked' | null;
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

export type HomeRoutineContextOption =
  | {
      value: 'root';
      label?: never;
      routineCount: number;
    }
  | {
      value: `folder:${string}`;
      label: string;
      routineCount: number;
    };

/** La ligne de la feuille de choix à laquelle appartient une routine. */
function contextValueOf(folderId: string): RoutineContextValue {
  return folderId === '' ? 'root' : `folder:${folderId}`;
}

export interface HomeDashboardData {
  /** Toutes les dates de séances terminées — la matière de `calculateWeeklyRegularity`. */
  completedWorkoutTimestamps: number[];
  weeklyGoalHistory: WeeklyTrainingGoal[];
  /** Compté même quand rien n'est suggérable, pour distinguer les deux vides. */
  routineCount: number;
  routineContext: {
    required: boolean;
    /**
     * Les lignes cochées, dans l'ordre de la bibliothèque et non celui où elles
     * l'ont été ; vide tant que rien de valide n'est choisi.
     */
    selected: RoutineContextValue[];
    options: HomeRoutineContextOption[];
  };
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
            loadIndex: week.loadIndex,
            phase: week.phase,
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
        repairUnavailableReason: completedEntryIds.size > 0 ? 'locked' : null,
      },
    };
  }

  if (picked.kind === 'next_week') {
    const nextWeek = detail.weeks.find((candidate) => candidate.weekIndex === picked.weekIndex);
    return {
      ...base,
      week:
        nextWeek === undefined
          ? null
          : {
              weekIndex: nextWeek.weekIndex,
              loadIndex: nextWeek.loadIndex,
              phase: nextWeek.phase,
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

/**
 * The active block, already ranked. Exported so the Programmes list can show the
 * same hero as home without re-running `pickProgramSession` on its own — two
 * screens ranking the same schedule is two chances to disagree.
 */
export async function getActiveProgramProjection(
  at = Date.now(),
): Promise<HomeProgramProjection | null> {
  return readHomeProgramProjection(at);
}

export async function getHomeDashboard(): Promise<HomeDashboardData> {
  const [folders, context, routines, completed, weeklyGoalHistory, activeProgram] = await Promise.all([
    listFolders(),
    getRoutineFolderContext(),
    listRoutineSummaries(),
    listCompletedWorkouts(),
    getWeeklyTrainingGoalHistory(),
    readHomeProgramProjection(Date.now()),
  ]);

  const rootRoutines = routines.filter(({ routine }) => routine.folderId === '');
  const options: HomeRoutineContextOption[] = [];
  if (folders.length > 0) {
    options.push(
      ...folders.map((folder) => ({
        value: `folder:${folder.id}` as const,
        label: folder.name,
        routineCount: routines.filter(({ routine }) => routine.folderId === folder.id).length,
      })),
    );
    if (rootRoutines.length > 0) {
      options.push({ value: 'root', routineCount: rootRoutines.length });
    }
  }

  // Seul ce qui existe encore, dans l'ordre de la bibliothèque : un dossier
  // supprimé sort de la sélection sans invalider les autres, et ne la remplace
  // jamais par un dossier qu'on n'a pas choisi.
  const selectedValues = routineContextValues(context);
  const validSelected = options
    .map((option) => option.value)
    .filter((value) => selectedValues.includes(value));

  // Un cycle qui traverse deux dossiers se lit dossier après dossier, chacun
  // dans l'ordre de ses routines. `Routine.order` est la place dans la liste
  // entière : seul, il mêlerait les dossiers dans l'ordre où leurs routines ont
  // été créées. Le rang part donc de l'ordre des dossiers.
  const optionRank = new Map(options.map((option, index) => [option.value, index]));
  const rankOf = ({ routine }: (typeof routines)[number]): number =>
    optionRank.get(contextValueOf(routine.folderId)) ?? Number.MAX_SAFE_INTEGER;
  const candidates = (
    folders.length === 0
      ? routines.slice()
      : routines.filter(({ routine }) => validSelected.includes(contextValueOf(routine.folderId)))
  ).sort(
    (left, right) =>
      rankOf(left) - rankOf(right) ||
      left.routine.order - right.routine.order ||
      left.routine.id.localeCompare(right.routine.id),
  );

  const pick = pickSuggestedRoutine(
    candidates.map(({ routine }, position) => ({
      routineId: routine.id,
      name: routine.name,
      order: position,
    })),
    // Le nom voyage avec la séance : les séances importées n'ont pas de
    // `routineId`, c'est par leur titre que `pickSuggestedRoutine` les rattache.
    completed.map(({ routineId, name, startedAt }) => ({ routineId, name, startedAt })),
  );
  const picked =
    pick === null ? undefined : routines.find(({ routine }) => routine.id === pick.routineId);

  return {
    completedWorkoutTimestamps: completed.map((workout) => workout.startedAt),
    weeklyGoalHistory,
    routineCount: routines.length,
    routineContext: {
      required: folders.length > 0 && validSelected.length === 0,
      selected: validSelected,
      options,
    },
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
