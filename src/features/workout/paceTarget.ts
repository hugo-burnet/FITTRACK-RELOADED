import type { WorkoutSet } from '@/data/types';

/**
 * Which set the metronome would pace, and at what beat.
 *
 * **The next working set, never a warm-up.** A warm-up is where you find the
 * groove of the day; being clicked at through it is exactly the wrong help.
 *
 * **Performed reps, never the prescription.** The pale target in an empty
 * field is context, not an instruction to the metronome. The pace only owns a
 * set once the lifter has typed the number they are about to perform.
 *
 * **The tempo comes in, it is not computed here.** It is the exercise's own
 * choice (or the preference behind it) — cf. `lib/tempo`.
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

export interface PaceExerciseLine {
  rowId: string;
  sets: readonly WorkoutSet[];
  /** The exercise's own tempo, already resolved against the preference. */
  repSeconds: number;
}

export interface FollowingExercisePace {
  rowId: string;
  preparation: Exclude<PacePreparation, { kind: 'done' }>;
}

/**
 * Reads the next working row as a small state machine. Keeping "empty" apart
 * from "finished" lets the workout screen ask for the missing input without
 * pretending there is no next set.
 */
export function prepareNextPace(
  sets: readonly WorkoutSet[],
  repSeconds: number,
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

  return {
    kind: 'ready',
    target: { setId: target.id, reps: target.reps, repSeconds },
  };
}

export function nextPaceTarget(
  sets: readonly WorkoutSet[],
  repSeconds: number,
): PaceTarget | null {
  const preparation = prepareNextPace(sets, repSeconds);
  return preparation.kind === 'ready' ? preparation.target : null;
}

/**
 * Hands a finished exercise to the first following exercise that still has a
 * working set. The list order is the workout order visible on screen.
 */
export function prepareFollowingExercisePace(
  lines: readonly PaceExerciseLine[],
  currentRowId: string,
): FollowingExercisePace | null {
  const currentIndex = lines.findIndex((line) => line.rowId === currentRowId);
  if (currentIndex < 0) return null;

  for (const line of lines.slice(currentIndex + 1)) {
    const preparation = prepareNextPace(line.sets, line.repSeconds);
    if (preparation.kind !== 'done') return { rowId: line.rowId, preparation };
  }
  return null;
}
