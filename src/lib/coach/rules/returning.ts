import { RETURN_GAP_DAYS, SEVERITY } from '../constants';
import type { CoachExerciseLine, CoachSignal } from '../types';

/** Une reprise après une pause : on consolide avant de monter (spec coach v2, R5). */

export function returningSignal(line: CoachExerciseLine, gapDays: number): CoachSignal {
  return {
    code: 'returning',
    exerciseId: line.exerciseId,
    evidence: [
      { label: 'gap_days', value: gapDays },
      { label: 'threshold_days', value: RETURN_GAP_DAYS },
    ],
    severity: SEVERITY.returning,
  };
}
