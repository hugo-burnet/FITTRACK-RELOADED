/**
 * How long one repetition is given, once fatigue is taken into account.
 *
 * A metronome that keeps the same beat from the first warm-up to the last set
 * of the session is a metronome you stop obeying halfway through: the tenth
 * working set of an hour-long session does not move at the speed of the first,
 * and being told otherwise by a click is worse than being told nothing. So the
 * beat *stretches*, on three grounds that all cost you something real:
 *
 * - **sets already done in this exercise** — the local, ordinary fatigue;
 * - **the last working set** — where you are at once the most cooked and the
 *   most likely to grind out a rep that takes twice as long;
 * - **a long session** — after three quarters of an hour, everything is slower.
 *
 * Every term is additive, small, and capped: the tempo is a guide, and a guide
 * that drifts to eight seconds a rep is prescribing a different exercise. Never
 * a factor, always seconds, for the same reason the program level moves in
 * increments — a percentage of a number nobody chose means nothing.
 */

/** Concentric plus eccentric, the beat of a rep with nothing against it yet. */
export const BASE_REP_SECONDS = 3;

/** Past this, the guide stops being one. */
export const MAX_REP_SECONDS = 5;

const PER_SET_BONUS = 0.25;
const PER_SET_BONUS_CAP = 1;
const LAST_SET_BONUS = 0.5;
const LONG_SESSION_BONUS = 0.5;
const LONG_SESSION_MS = 45 * 60 * 1_000;

export interface TempoInput {
  /** Working sets of this exercise already validated. Warm-ups excluded. */
  workingSetsDone: number;
  /** The set about to be done is the exercise's last working set. */
  isLastWorkingSet: boolean;
  /** Time since the session opened. */
  sessionElapsedMs: number;
}

export function repSecondsFor(input: TempoInput): number {
  const fromSets = Math.min(
    PER_SET_BONUS * Math.max(0, input.workingSetsDone),
    PER_SET_BONUS_CAP,
  );
  const fromLast = input.isLastWorkingSet ? LAST_SET_BONUS : 0;
  const fromSession = input.sessionElapsedMs >= LONG_SESSION_MS ? LONG_SESSION_BONUS : 0;

  const total = BASE_REP_SECONDS + fromSets + fromLast + fromSession;

  // Quarter seconds: the ear hears the difference between 3 and 3,25 s across
  // ten reps, and nothing below that is worth carrying around.
  return Math.min(MAX_REP_SECONDS, Math.round(total * 4) / 4);
}
