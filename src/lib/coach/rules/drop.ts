import { SEVERITY } from '../constants';
import { completedWorkingSets, judgedSets } from '../sets';
import type { CoachExerciseLine, CoachSetInput, CoachSignal } from '../types';

/**
 * Ce qui se passe *dans* une séance : des répétitions qui s'effondrent d'une série à l'autre, et
 * un repos long quand elles s'effondrent. Un repos long seul n'est jamais un constat.
 */

/** Two loads that are the same figure — or two sets that carry no figure. */
function sameLoad(left: number | undefined, right: number | undefined): boolean {
  return left === right;
}

/**
 * The set a later one may be compared with: the first set of the session that
 * carries the **same load** and a rep count.
 *
 * **A heavier bar is not a collapse.** `100 × 10` then `110 × 7` is a pyramid —
 * the load went up and the reps followed it down, which is what going up a
 * load is. Reading the second set against the first turned a deliberate step
 * into « Baisse de reps observée », and a coach that calls a progression a
 * regression is a coach you stop reading. Reps only mean something against
 * reps done at the same weight; a set that opens a new load has nothing behind
 * it to fall from, so it says nothing until a second set at that load answers.
 *
 * Lighter sets never reach here — `progressionSets` already drops them.
 */
function dropReference(
  working: readonly CoachSetInput[],
  index: number,
): CoachSetInput | undefined {
  const set = working[index]!;
  for (let i = 0; i < index; i += 1) {
    const candidate = working[i]!;
    if (candidate.reps === undefined) continue;
    if (sameLoad(candidate.weight, set.weight)) return candidate;
  }
  return undefined;
}

export function intraSessionDropSignal(
  line: CoachExerciseLine,
  dropReps: number,
): CoachSignal | undefined {
  const working = judgedSets(line);
  if (working.length < 2) return undefined;

  let worst: { set: CoachSetInput; reference: CoachSetInput; drop: number } | undefined;
  for (let i = 1; i < working.length; i++) {
    const set = working[i]!;
    const reps = set.reps;
    if (reps === undefined) continue;
    const reference = dropReference(working, i);
    if (reference === undefined) continue;
    const drop = reference.reps! - reps;
    if (drop < dropReps) continue;
    // A set that lands inside its own prescription is not a defect. `12, 12, 12,
    // 10` on an 8–12 range is the range being respected, and calling it a drop
    // is noise the user has to learn to ignore — which is how a coach stops
    // being read at all. Only a set that falls *through the floor* is news.
    if (set.targetReps !== undefined && reps >= set.targetReps) continue;
    if (worst === undefined || drop > worst.drop) {
      worst = { set, reference, drop };
    }
  }
  if (worst === undefined) return undefined;

  return {
    code: 'intra_session_drop',
    exerciseId: line.exerciseId,
    evidence: [
      { label: 'first_reps', value: worst.reference.reps! },
      { label: 'low_reps', value: worst.set.reps! },
      { label: 'drop_reps', value: worst.drop },
    ],
    severity: SEVERITY.intra_session_drop,
  };
}

function restGapsMs(sets: readonly CoachSetInput[]): number[] {
  const working = completedWorkingSets(sets);
  const gaps: number[] = [];
  for (let i = 1; i < working.length; i++) {
    const gap = working[i]!.performedAt - working[i - 1]!.performedAt;
    if (gap > 0) gaps.push(gap);
  }
  return gaps;
}

export function longRestSignal(
  line: CoachExerciseLine,
  drop: CoachSignal | undefined,
  longRestMs: number,
): CoachSignal | undefined {
  // Correlates with rule 2 only — a long rest alone is not a defect.
  if (drop === undefined) return undefined;

  const gaps = restGapsMs(line.sets);
  if (gaps.length === 0) return undefined;
  const maxGap = Math.max(...gaps);
  if (maxGap < longRestMs) return undefined;

  return {
    code: 'long_rest',
    exerciseId: line.exerciseId,
    evidence: [
      { label: 'max_rest_seconds', value: Math.round(maxGap / 1000) },
      { label: 'threshold_seconds', value: Math.round(longRestMs / 1000) },
    ],
    severity: SEVERITY.long_rest,
  };
}
