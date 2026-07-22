import type { SetType } from '@/data/types';

/**
 * The rest timer's rules, pure by construction (architecture §7): numbers in,
 * numbers out, no React and no Dexie.
 *
 * The bar on screen and the sound at the end both read from here, so they
 * cannot disagree about when a rest starts or how far along it is.
 */

/**
 * What a rest lasts when nothing else says otherwise.
 *
 * The middle of the range Schoenfeld (2016) and Grgic's meta-analyses support
 * for hypertrophy and strength. A **product default, not a prescription**: it
 * is set per exercise (Lot 3) and per routine (Lot 4).
 */
export const DEFAULT_REST_SECONDS = 120;

/**
 * The routine's override, then the exercise's own default, then 120 s.
 *
 * `0` is not "no rest" — it is "use the exercise's own", which is the meaning
 * `RoutineExercise.restSeconds` has carried since Lot 2. This rule already
 * existed inline in `RoutineExerciseCard`; it lives here now rather than being
 * written a third time, and it gains the floor the inline version lacked: it
 * used to resolve to `0`, and a timer of 0 s has no meaning.
 */
export function resolveRestSeconds(
  override: number | undefined,
  exerciseDefault: number | undefined,
): number {
  const candidate = pickPositive(override) ?? pickPositive(exerciseDefault);
  return candidate ?? DEFAULT_REST_SECONDS;
}

function pickPositive(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value) || value <= 0) return undefined;
  return Math.round(value);
}

/** Where the validated set sits in its superset block. */
export interface RestContext {
  /** False only for a set that has another exercise of the same group after it. */
  isLastOfBlock: boolean;
}

/**
 * Whether validating this set starts a rest.
 *
 * Two exclusions, both deliberate:
 *
 * - **Warm-up sets start nothing.** They are sub-maximal and not tiring; timing
 *   them slows the session down for no recovery benefit.
 * - **Nothing fires between two members of a superset.** The minimal rest
 *   between its members is what *defines* a superset — time them apart and they
 *   are simply two exercises. The rest belongs to the end of the round.
 */
export function isRestTriggering(set: { setType: SetType }, context: RestContext): boolean {
  if (set.setType === 'warmup') return false;
  return context.isLastOfBlock;
}

/**
 * How far along the rest is, from 0 to 1.
 *
 * A subtraction on the wall clock, never a counter that decrements. Chrome
 * Android throttles a backgrounded tab's timers to roughly one tick a minute: a
 * counter drifts, this does not, and coming back to the foreground is correct
 * with nothing to catch up.
 */
export function restProgress(startedAt: number, endsAt: number, now: number): number {
  const span = endsAt - startedAt;
  // Not an error worth throwing: a style attribute must never receive NaN.
  if (span <= 0) return 1;
  return clamp01((now - startedAt) / span);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(1, Math.max(0, value));
}

/**
 * A rest duration as the app writes durations — `m:ss`, the format Lot 4 fixed
 * for `1:30 min · 20 kg`. Deliberately not `1'30`: one format per concept.
 */
export function formatRest(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}
