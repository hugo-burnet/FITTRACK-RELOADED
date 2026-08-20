import type { WorkoutSet } from '@/data/types';
import { repSecondsFor } from '@/lib/tempo';

/**
 * Which set the metronome would pace, and at what beat.
 *
 * **The next working set, never a warm-up.** A warm-up is where you find the
 * groove of the day; being clicked at through it is exactly the wrong help.
 *
 * **Performed reps, never the prescription.** The pale target in an empty
 * field is context, not an instruction to the metronome. The pace only owns a
 * set once the lifter has typed the number they are about to perform.
 */
export interface PaceTarget {
  setId: string;
  reps: number;
  repSeconds: number;
}

export type PacePreparation =
  | { kind: 'ready'; target: PaceTarget }
  | { kind: 'missing-reps'; setId: string }
  | { kind: 'done' };

/**
 * Reads the next working row as a small state machine. Keeping "empty" apart
 * from "finished" lets the workout screen ask for the missing input without
 * pretending there is no next set.
 */
export function prepareNextPace(
  sets: readonly WorkoutSet[],
  sessionElapsedMs: number,
  afterSetId?: string,
): PacePreparation {
  const working = sets.filter((set) => set.deletedAt === 0 && set.setType !== 'warmup');
  const finishedIndex =
    afterSetId === undefined ? -1 : sets.findIndex((set) => set.id === afterSetId);
  const target = working.find(
    (set) =>
      set.isCompleted === 0 &&
      (finishedIndex < 0 || sets.findIndex((candidate) => candidate.id === set.id) > finishedIndex),
  );
  if (target === undefined) return { kind: 'done' };
  if (target.reps === undefined || target.reps <= 0) {
    return { kind: 'missing-reps', setId: target.id };
  }

  const done = working.filter((set) => set.isCompleted === 1).length;
  const remaining = working.filter((set) => set.isCompleted === 0).length;

  return {
    kind: 'ready',
    target: {
      setId: target.id,
      reps: target.reps,
      repSeconds: repSecondsFor({
        workingSetsDone: done,
        isLastWorkingSet: remaining === 1,
        sessionElapsedMs,
      }),
    },
  };
}

export function nextPaceTarget(
  sets: readonly WorkoutSet[],
  sessionElapsedMs: number,
): PaceTarget | null {
  const preparation = prepareNextPace(sets, sessionElapsedMs);
  return preparation.kind === 'ready' ? preparation.target : null;
}
