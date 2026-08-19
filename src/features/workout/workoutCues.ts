import type { CueId } from '@/audio/cues';
import type { WorkoutSet } from '@/data/types';

/**
 * Which announcement a validated set deserves.
 *
 * The tone is the same for all three — a set went into the database — but the
 * sentence is not, and the difference is the whole point of having a voice:
 * "dernière série" said one set early is worth something, "série validée" said
 * thirty times is worth nothing.
 *
 * **Warm-ups do not count.** Neither as the set being announced nor in what is
 * left to do: telling someone their last set is coming when three working sets
 * remain behind two warm-ups is worse than saying nothing.
 *
 * Called *before* the write lands, so the set being validated is still open in
 * the list it is counted out of.
 */
export function setValidationCue(sets: readonly WorkoutSet[], setId: string): CueId {
  const remaining = sets.filter(
    (set) =>
      set.id !== setId && set.deletedAt === 0 && set.setType !== 'warmup' && set.isCompleted === 0,
  ).length;

  const validated = sets.find((set) => set.id === setId);
  if (validated?.setType === 'warmup') return 'set-validated';

  if (remaining === 0) return 'exercise-cleared';
  if (remaining === 1) return 'last-set-ahead';
  return 'set-validated';
}

/**
 * The opening line, once per workout and never over a session already under
 * way — reopening the screen between two sets is not a new beginning.
 *
 * The memory is module-level and dies with the page: a workout resumed after a
 * crash gets greeted again, which is the right answer for the one case where
 * the app has just been unable to say anything at all.
 */
const greeted = new Set<string>();

export function claimWorkoutGreeting(workoutId: string, completedSets: number): boolean {
  if (completedSets > 0 || greeted.has(workoutId)) return false;
  greeted.add(workoutId);
  return true;
}

/** Only for the tests: the set is a module singleton by design. */
export function forgetWorkoutGreetings(): void {
  greeted.clear();
}
