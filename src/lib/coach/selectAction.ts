import type { ProgramPhase } from '@/data/types';
import type { CoachAction, ProgramCoachContext } from './types';

/**
 * Phase-ordered preferences among performance-authorized actions (spec §6).
 * Construction never selects `add_set` even when the engine allows it.
 * Hors bloc (`target === undefined`) uses the construction order.
 */
const RANK: Record<ProgramPhase, readonly CoachAction[]> = {
  construction: ['increase_load', 'increase_reps', 'maintain'],
  progression: ['increase_load', 'increase_reps', 'maintain'],
  overload: ['add_set', 'increase_reps', 'increase_load', 'maintain'],
  deload: ['maintain'],
  return: ['maintain', 'increase_reps', 'increase_load'],
  test: ['increase_load', 'increase_reps', 'maintain'],
};

/**
 * Pick one action from the performance `allowed` set using the **target**
 * week's phase ranking. Does not invent permissions — only ranks.
 */
export function selectProgramAction(
  allowed: readonly CoachAction[],
  target: ProgramCoachContext | undefined,
): CoachAction {
  const phase = target?.phase ?? 'construction';
  const allowedSet = new Set(allowed);
  for (const action of RANK[phase]) {
    if (allowedSet.has(action)) return action;
  }
  return 'maintain';
}
