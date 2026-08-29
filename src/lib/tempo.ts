/**
 * How long one repetition is given — a number the lifter chooses, and nothing
 * else chooses for them.
 *
 * **This used to be automatic, and that was the mistake.** The beat stretched
 * by a quarter of a second per set already done, half a second on the last set,
 * half a second past three quarters of an hour. Every term was defensible and
 * the sum was not: the app decided the tempo of *your* exercise from a model of
 * fatigue it cannot measure, and a metronome you did not choose is a metronome
 * you argue with. A tempo is part of the prescription — 3 s on a bench press,
 * 5 s on a slow squat, 2 s on an explosive pull — and the person under the bar
 * is the only one who knows which.
 *
 * So the number is stored where the exercise is (`WorkoutExercise.repSeconds`),
 * set from the exercise card, and falls back to a single preference when the
 * row carries none. What is left here is the grid it moves on and the floor and
 * ceiling it stays inside.
 */

/** Concentric plus eccentric, the beat of an ordinary rep. */
export const DEFAULT_REP_SECONDS = 3;

/** Below this the click is a rattle rather than a beat. */
export const MIN_REP_SECONDS = 1;

/** Ten seconds a rep is a hold, and a hold has its own timer. */
export const MAX_REP_SECONDS = 10;

/**
 * Quarter seconds: the ear hears the difference between 3 and 3,25 s across ten
 * reps, and nothing below that is worth carrying around.
 */
const REP_SECONDS_STEP = 0.25;

/** The tempos a lifter actually reaches for, one tap away in the picker. */
export const REP_SECONDS_PRESETS = [2, 2.5, 3, 4, 5] as const;

/** Snaps to the quarter-second grid and keeps the value inside its bounds. */
export function clampRepSeconds(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_REP_SECONDS;
  const snapped = Math.round(value / REP_SECONDS_STEP) * REP_SECONDS_STEP;
  return Math.min(MAX_REP_SECONDS, Math.max(MIN_REP_SECONDS, snapped));
}

/** One step of the ± pair. */
export function stepRepSeconds(value: number, steps: number): number {
  return clampRepSeconds(value + steps * REP_SECONDS_STEP);
}

/**
 * A persisted value read back — `undefined` for anything that is not a usable
 * tempo, so the caller falls through to the preference rather than pacing a set
 * at `NaN` seconds a rep.
 */
export function normalizeRepSeconds(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  if (value < MIN_REP_SECONDS || value > MAX_REP_SECONDS) return undefined;
  return clampRepSeconds(value);
}

/**
 * The tempo to beat, from the most specific source that has one: the exercise's
 * own choice, then the preference, then the plain three seconds.
 */
export function resolveRepSeconds(...candidates: readonly (number | undefined)[]): number {
  for (const candidate of candidates) {
    const value = normalizeRepSeconds(candidate);
    if (value !== undefined) return value;
  }
  return DEFAULT_REP_SECONDS;
}
