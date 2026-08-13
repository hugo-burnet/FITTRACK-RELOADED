import { useLiveQuery } from 'dexie-react-hooks';
import { getProgramDetail } from '@/data/repositories/programs';
import type { ProgramDetail } from '@/data/repositories/programs';
import { listCompletedWorkouts } from '@/data/repositories/history';
import { listRoutineSummaries } from '@/data/repositories/routines';
import type { RoutineSummary } from '@/data/repositories/routines';
import { getActiveWorkout } from '@/data/repositories/workouts';

export type ExistingProgramQuery =
  | { status: 'not_requested' }
  | { status: 'found'; detail: ProgramDetail; programWorkoutWeekIndexes: number[] }
  | { status: 'not_found' }
  | { status: 'error' };

type RoutinesQuery = { status: 'ready'; routines: RoutineSummary[] } | { status: 'error' };

export interface ProgramEditorData {
  existing: ExistingProgramQuery | undefined;
  routines: RoutineSummary[] | undefined;
  routinesReadFailed: boolean;
  /** No split can be composed yet: still reading, read failed, or nothing to pick. */
  splitBlocked: boolean;
}

/**
 * Everything the editor reads. A failed read is a state, not an exception:
 * "couldn't be read" and "doesn't exist" are different sentences on screen, and
 * neither is "loading".
 */
export function useProgramEditorData(routeProgramId: string | undefined): ProgramEditorData {
  const existing = useLiveQuery<ExistingProgramQuery>(
    async () => {
      if (routeProgramId === undefined) return { status: 'not_requested' };
      try {
        const detail = await getProgramDetail(routeProgramId);
        if (detail === null) return { status: 'not_found' };
        const [completedWorkouts, activeWorkout] = await Promise.all([
          listCompletedWorkouts(),
          getActiveWorkout(),
        ]);
        // `getActiveWorkout` renvoie `undefined`, jamais `null`.
        const programWorkoutWeekIndexes = [
          ...completedWorkouts,
          ...(activeWorkout === undefined ? [] : [activeWorkout]),
        ].flatMap((workout) =>
          workout.programId === detail.program.id && workout.programWeekIndex !== undefined
            ? [workout.programWeekIndex]
            : [],
        );
        return { status: 'found', detail, programWorkoutWeekIndexes };
      } catch {
        return { status: 'error' };
      }
    },
    [routeProgramId],
  );

  const routinesQuery = useLiveQuery<RoutinesQuery>(async () => {
    try {
      return { status: 'ready', routines: await listRoutineSummaries() };
    } catch {
      return { status: 'error' };
    }
  });
  const routines = routinesQuery?.status === 'ready' ? routinesQuery.routines : undefined;
  const routinesReadFailed = routinesQuery?.status === 'error';

  return {
    existing,
    routines,
    routinesReadFailed,
    splitBlocked: routinesQuery === undefined || routinesReadFailed || routines?.length === 0,
  };
}
