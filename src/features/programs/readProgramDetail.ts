import { getProgramDetail } from '@/data/repositories/programs';
import type { ProgramDetail } from '@/data/repositories/programs';
import { listProgramWorkouts } from '@/data/repositories/programHistory';
import { getRoutineDetail } from '@/data/repositories/routines';
import { getActiveWorkout } from '@/data/repositories/workouts';
import type { ProgramWeek } from '@/data/types';
import {
  cycleLength,
  cyclePosition,
  programAdherence,
  programPosition,
  programWeeklyTonnage,
  resolveRevision,
  resolveSchedule,
  shiftLocalDate,
} from '@/lib/programs';
import type { ProgramAdherence, ProgramPosition } from '@/lib/programs';
import { buildPastWeeks } from './pastWeeks';
import type { PastWeek } from './pastWeeks';
import type { ProgramSessionReading } from './ProgramSessionList';

export interface DetailProjection {
  detail: ProgramDetail;
  position: ProgramPosition;
  week: ProgramWeek | null;
  sessions: ProgramSessionReading[];
  activeWorkoutExists: boolean;
  /** A draft is only activable once it has a split to run and a week for each. */
  draftReady: boolean;
  displayWeekIndex: number;
  /** Où en est le cycle du split, quand il dure plus d'une semaine ; `null` sinon. */
  cycle: { length: number; position: number } | null;
  nextWeek: ProgramWeek | undefined;
  adherence: ProgramAdherence;
  /** Tonnage de chaque semaine du programme, de la première à la dernière. */
  weeklyTonnage: number[];
  hasWorkouts: boolean;
  /** Les semaines écoulées, avant celle qu'on lit en grand. */
  pastWeeks: PastWeek[];
}

export type DetailQuery =
  { status: 'ready'; value: DetailProjection } | { status: 'not_found' } | { status: 'error' };

/**
 * Tout ce que lit la fiche d'un programme, en une lecture.
 *
 * Une seule fonction, un seul `useLiveQuery` : la fiche se redessine d'un bloc
 * quand une séance se termine, au lieu que chaque tuile se rafraîchisse de son
 * côté et se contredise un instant.
 */
export async function readProjection(programId: string): Promise<DetailQuery> {
  try {
    const detail = await getProgramDetail(programId);
    if (detail === null) return { status: 'not_found' };

    const { program } = detail;
    const now = Date.now();
    const position = programPosition(program.startsAt, program.durationWeeks, now);
    const weekIndex =
      position.phase === 'active'
        ? position.weekIndex
        : position.phase === 'before'
          ? 0
          : program.durationWeeks - 1;
    const revisions = detail.revisions.map(({ revision }) => revision);
    const allEntries = detail.revisions.flatMap(({ entries: revisionEntries }) => revisionEntries);
    const entries = resolveSchedule(revisions, allEntries, weekIndex);

    // Les routines des semaines écoulées aussi : une séance manquée porte le nom de sa routine.
    const routineIds = new Set(entries.map((entry) => entry.routineId));
    for (let past = 0; past < weekIndex; past += 1) {
      for (const entry of resolveSchedule(revisions, allEntries, past)) {
        routineIds.add(entry.routineId);
      }
    }
    const [programWorkouts, activeWorkout, routineRows] = await Promise.all([
      listProgramWorkouts(program.id),
      getActiveWorkout(),
      Promise.all([...routineIds].map(async (id) => [id, await getRoutineDetail(id)] as const)),
    ]);
    const routineNames = new Map<string, string | null>(
      routineRows.map(([id, routine]) => [id, routine?.routine.name ?? null]),
    );

    const currentDay = position.phase === 'active' ? position.dayOfWeek : 0;
    const displayedWorkouts = programWorkouts.filter((workout) => workout.weekIndex === weekIndex);
    const hasWorkoutInDisplayedWeek =
      displayedWorkouts.length > 0 ||
      (activeWorkout?.programId === program.id && activeWorkout.programWeekIndex === weekIndex);
    const repairUnavailableReason =
      program.status === 'completed' || position.phase === 'after'
        ? ('completed' as const)
        : program.status === 'active' && hasWorkoutInDisplayedWeek
          ? ('locked' as const)
          : null;
    const sessions: ProgramSessionReading[] = entries.map((entry) => {
      // La plus récente : c'est celle que le lien ouvre quand un créneau a été joué deux fois.
      const played = displayedWorkouts.filter((workout) => workout.entryId === entry.id).at(-1);
      return {
        entryId: entry.id,
        routineId: entry.routineId,
        routineName: routineNames.get(entry.routineId) ?? null,
        dayOfWeek: entry.dayOfWeek,
        order: entry.order,
        state:
          played !== undefined
            ? 'completed'
            : currentDay === entry.dayOfWeek
              ? 'today'
              : currentDay > entry.dayOfWeek
                ? 'missed'
                : 'upcoming',
        date:
          played?.startedAt ??
          shiftLocalDate(program.startsAt, weekIndex * 7 + entry.dayOfWeek - 1),
        ...(played === undefined ? {} : { workoutId: played.workoutId }),
        repairUnavailableReason,
      };
    });

    // Le brouillon se juge sur la révision par laquelle le bloc démarrera, quelle
    // que soit la date du jour, et sur **tout** son cycle : une semaine de repos
    // en tête n'en fait pas un bloc sans séance.
    const initialSchedule = resolveRevision(revisions, allEntries, 0)?.entries ?? [];
    const displayed = resolveRevision(revisions, allEntries, weekIndex);
    const cycle =
      displayed !== null && cycleLength(displayed.revision) > 1
        ? {
            length: cycleLength(displayed.revision),
            position: cyclePosition(displayed.revision, weekIndex),
          }
        : null;

    return {
      status: 'ready',
      value: {
        detail,
        position,
        week: detail.weeks.find((candidate) => candidate.weekIndex === weekIndex) ?? null,
        sessions,
        activeWorkoutExists: activeWorkout !== undefined,
        draftReady: initialSchedule.length > 0 && detail.weeks.length === program.durationWeeks,
        displayWeekIndex: weekIndex,
        cycle,
        nextWeek: detail.weeks.find((candidate) => candidate.weekIndex === weekIndex + 1),
        adherence: programAdherence({
          revisions,
          entries: allEntries,
          durationWeeks: program.durationWeeks,
          position,
          done: programWorkouts.flatMap((workout) =>
            workout.entryId === undefined
              ? []
              : [{ weekIndex: workout.weekIndex, entryId: workout.entryId }],
          ),
        }),
        weeklyTonnage: programWeeklyTonnage(program.durationWeeks, programWorkouts),
        hasWorkouts: programWorkouts.length > 0,
        pastWeeks: buildPastWeeks({
          startsAt: program.startsAt,
          weeks: detail.weeks,
          revisions,
          entries: allEntries,
          workouts: programWorkouts,
          routineNames,
          beforeWeekIndex: weekIndex,
        }),
      },
    };
  } catch {
    return { status: 'error' };
  }
}
