import type { ProgramPhase } from '@/data/types';

/**
 * The level a phase suggests when it is chosen explicitly — in the week editor,
 * or as the level of a recipe's phase. Never applied by a migration, a session
 * start, or any recompute: picking a phase proposes a number, it does not lock one.
 *
 * There is deliberately no second scale. A recipe is a sequence of phases, and
 * its levels are read from here.
 */
export const SUGGESTED_LOAD_INDEX: Record<ProgramPhase, number> = {
  construction: 100,
  progression: 105,
  overload: 110,
  deload: 60,
  return: 100,
  test: 110,
};

export const LOAD_INDEX_PRESETS = [60, 90, 100, 105, 110] as const;
