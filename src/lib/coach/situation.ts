import { evaluatePerformance, pickSignals } from './evaluate';
import type { CoachEvaluateOptions, CoachExerciseLine, CoachSignalCode } from './types';

/**
 * Where an exercise stands after a session, in one word — what the card shows.
 *
 * The engine speaks in nine signal codes, but two of them are not situations of
 * their own: `range_completed` is the old name of `range_ceiling_reached` (kept
 * so journal rows still typecheck), and `long_rest` only exists next to an
 * `intra_session_drop`, which it qualifies. Reading them as situations would
 * give a caller two states it can never tell apart from the one beside them —
 * `long_rest` can never even be the card shown, its severity sits under the
 * drop's. That leaves seven situations, plus the one where there is nothing to say.
 *
 * There is no « regression » among them: a clear decline reads as `plateau`
 * (the rule asks for no progress, not for no decline), and a floor missed twice
 * reads as `floor_missed`.
 */
export type CoachSituation =
  /** First session after a break of `RETURN_GAP_DAYS` or more: consolidate before climbing. */
  | 'returning'
  /** The floor of the range missed twice at the same load: one step back is on the table. */
  | 'floor_missed'
  /** Every set at the top of the range: time to climb, in load or in reps. */
  | 'ceiling_reached'
  /** Same load, at least as many reps, clearly less effort. */
  | 'consolidating'
  /** A benchmark gave the load for the exercise's rep range. */
  | 'calibrated'
  /** The range held without reaching its ceiling. */
  | 'in_range'
  /** No progress on the estimated 1RM across the comparison window. */
  | 'plateau'
  /** Reps fell inside the session — with or without a long rest to go with it. */
  | 'rep_drop'
  /** The engine has nothing to say: no prescription to read, or nothing out of the ordinary. */
  | 'no_signal';

/**
 * Maps one signal code to its situation. Takes the code, not the signal, so the
 * journal (`CoachRecommendation.code`) can use it as well as the engine.
 *
 * The `never` in the default branch makes the switch exhaustive: a new
 * `CoachSignalCode` fails the typecheck here until it is given a situation.
 */
export function situationOfCode(code: CoachSignalCode | undefined): CoachSituation {
  if (code === undefined) return 'no_signal';
  switch (code) {
    case 'returning':
      return 'returning';
    case 'range_missed':
      return 'floor_missed';
    case 'range_ceiling_reached':
    case 'range_completed':
      return 'ceiling_reached';
    case 'consolidating':
      return 'consolidating';
    case 'benchmark_calibrated':
      return 'calibrated';
    case 'range_satisfied':
      return 'in_range';
    case 'plateau':
      return 'plateau';
    case 'intra_session_drop':
    case 'long_rest':
      return 'rep_drop';
    default: {
      const unhandled: never = code;
      return unhandled;
    }
  }
}

/**
 * The situation of one exercise after the session under review.
 *
 * `history` is the earlier sessions of the same exercise, in any order. The
 * situation is the one of the signal the card would keep (`pickSignals`), so the
 * two never disagree.
 *
 * This reads the engine only. In a program week the finish screen goes through
 * `evaluateCoachForWorkout`, which also applies the phase of the week; to get
 * the situation of the card it actually shows, give the code of that final
 * signal to `situationOfCode`.
 */
export function evaluateSituation(
  line: CoachExerciseLine,
  history: readonly CoachExerciseLine[] = [],
  options: CoachEvaluateOptions = {},
): CoachSituation {
  const { signals } = evaluatePerformance(line, history, options);
  return situationOfCode(pickSignals(signals)[0]?.code);
}
