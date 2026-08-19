import type { WorkoutSet } from '@/data/types';
import { repSecondsFor } from '@/lib/tempo';

/**
 * Which set the metronome would pace, and at what beat.
 *
 * **The next working set, never a warm-up.** A warm-up is where you find the
 * groove of the day; being clicked at through it is exactly the wrong help.
 *
 * **No target reps, no metronome.** The pace counts *down* — "trois, deux,
 * une" — and a countdown needs to know from where. A set with no target is
 * done at your own tempo and the button does not offer itself, which is a
 * better answer than a click that stops mid-set.
 */
export interface PaceTarget {
  setId: string;
  reps: number;
  repSeconds: number;
}

export function nextPaceTarget(
  sets: readonly WorkoutSet[],
  sessionElapsedMs: number,
): PaceTarget | null {
  const working = sets.filter((set) => set.deletedAt === 0 && set.setType !== 'warmup');
  const target = working.find((set) => set.isCompleted === 0);
  if (target?.targetReps === undefined || target.targetReps <= 0) return null;

  const done = working.filter((set) => set.isCompleted === 1).length;
  const remaining = working.filter((set) => set.isCompleted === 0).length;

  return {
    setId: target.id,
    reps: target.targetReps,
    repSeconds: repSecondsFor({
      workingSetsDone: done,
      isLastWorkingSet: remaining === 1,
      sessionElapsedMs,
    }),
  };
}
