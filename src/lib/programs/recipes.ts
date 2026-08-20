import type { ProgramPhase } from '@/data/types';
import { SUGGESTED_LOAD_INDEX } from './phaseSuggestions';

export const PROGRAM_RECIPE_IDS = ['hypertrophy', 'strength', 'return'] as const;

export type ProgramRecipeId = (typeof PROGRAM_RECIPE_IDS)[number];

export interface ProgramRecipeWeek {
  weekIndex: number;
  phase: ProgramPhase;
  loadIndex: number;
}

/**
 * A recipe is a four-week phase pattern, repeated then cut to the block length.
 * It lays down a trajectory; the week list corrects it. Nothing is persisted
 * here and no level is invented — every level comes from `SUGGESTED_LOAD_INDEX`.
 */
const PATTERNS: Record<ProgramRecipeId, readonly ProgramPhase[]> = {
  hypertrophy: ['construction', 'progression', 'overload', 'deload'],
  strength: ['construction', 'construction', 'progression', 'test'],
  return: ['return', 'construction', 'progression', 'deload'],
};

export interface ApplyProgramRecipeOptions {
  /** Weeks already on the block; those before `effectiveFromWeekIndex` are kept as-is. */
  existing?: readonly ProgramRecipeWeek[];
  /** First week the recipe is allowed to write. Defaults to 0 (whole block). */
  effectiveFromWeekIndex?: number;
}

function recipeWeek(id: ProgramRecipeId, weekIndex: number): ProgramRecipeWeek {
  const pattern = PATTERNS[id];
  // Anchored to the block, not to the edit: sealing S1–S4 must not shift S5.
  const phase = pattern[weekIndex % pattern.length]!;
  return { weekIndex, phase, loadIndex: SUGGESTED_LOAD_INDEX[phase] };
}

/**
 * Full week list for a block after applying `id`. Weeks before
 * `effectiveFromWeekIndex` keep their existing definition; a sealed week absent
 * from `existing` falls back to the recipe rather than inventing a hole.
 */
export function applyProgramRecipe(
  id: ProgramRecipeId,
  durationWeeks: number,
  options: ApplyProgramRecipeOptions = {},
): ProgramRecipeWeek[] {
  if (!Number.isInteger(durationWeeks) || durationWeeks <= 0) return [];

  const sealedBefore = options.effectiveFromWeekIndex ?? 0;
  const existingByIndex = new Map((options.existing ?? []).map((week) => [week.weekIndex, week]));

  return Array.from({ length: durationWeeks }, (_, weekIndex) => {
    if (weekIndex < sealedBefore) {
      const sealed = existingByIndex.get(weekIndex);
      if (sealed !== undefined) {
        return { weekIndex, phase: sealed.phase, loadIndex: sealed.loadIndex };
      }
    }
    return recipeWeek(id, weekIndex);
  });
}

/**
 * Identifies the recipe already visible in the editable part of a block.
 * Recipe selection is derived from the weeks rather than stored beside them:
 * opening a prefilled draft therefore colours the right button, while the
 * first manual change naturally clears it.
 */
export function matchingProgramRecipe(
  weeks: readonly ProgramRecipeWeek[],
  effectiveFromWeekIndex = 0,
): ProgramRecipeId | null {
  if (weeks.length === 0 || effectiveFromWeekIndex >= weeks.length) return null;

  return (
    PROGRAM_RECIPE_IDS.find((id) => {
      const expected = new Map(
        applyProgramRecipe(id, weeks.length).map((week) => [week.weekIndex, week]),
      );
      return weeks.every((week) => {
        if (week.weekIndex < effectiveFromWeekIndex) return true;
        const recipeWeek = expected.get(week.weekIndex);
        return recipeWeek?.phase === week.phase && recipeWeek.loadIndex === week.loadIndex;
      });
    }) ?? null
  );
}
