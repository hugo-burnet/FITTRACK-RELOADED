import type { ProgramPhase } from '@/data/types';
import { loadIndexSteps, type ProgramRecipeId } from '@/lib/programs';
import { t, type TranslationKey } from '@/i18n/fr';

// The suggestion table lives in `lib/programs` so recipes can read it without
// a feature importing another feature. Re-exported here for the editor.
export { LOAD_INDEX_PRESETS, SUGGESTED_LOAD_INDEX } from '@/lib/programs';

export const RECIPE_LABEL_KEYS: Record<ProgramRecipeId, TranslationKey> = {
  hypertrophy: 'program.recipe.hypertrophy',
  strength: 'program.recipe.strength',
  return: 'program.recipe.return',
};

export const PHASE_LABEL_KEYS: Record<ProgramPhase, TranslationKey> = {
  construction: 'program.phase.construction',
  progression: 'program.phase.progression',
  overload: 'program.phase.overload',
  deload: 'program.phase.deload',
  return: 'program.phase.return',
  test: 'program.phase.test',
};



export function phaseLabel(phase: ProgramPhase): string {
  return t(PHASE_LABEL_KEYS[phase]);
}

/** Shared grammar: `05 — 60 % · Décharge` (wizard, fiche, semaines suivantes). */
export function weekLine(week: {
  weekIndex: number;
  loadIndex: number;
  phase: ProgramPhase;
}): string {
  return t('program.weekLine', {
    number: String(week.weekIndex + 1).padStart(2, '0'),
    level: week.loadIndex,
    phase: phaseLabel(week.phase),
  });
}

/** Home card grammar: `Semaine 3 · Progression`. */
export function weekPhaseReading(week: {
  weekIndex: number;
  phase: ProgramPhase;
}): string {
  return t('program.weekPhaseReading', {
    number: week.weekIndex + 1,
    phase: phaseLabel(week.phase),
  });
}

/**
 * Ce que le niveau de la semaine fait aux charges, en une phrase.
 *
 * Il n'y a plus de semaine muette : même le niveau neutre a quelque chose à
 * dire — que rien ne bouge — et c'est justement la ligne qui manquait quand le
 * nombre ne servait à rien. Une décharge parle de sa recette, pas de son
 * niveau : c'est elle qui décide, pas lui.
 */
export function loadRuleReading(week: { loadIndex: number; phase: ProgramPhase }): string {
  if (week.phase === 'deload') return t('program.loadRule.deload');

  const steps = loadIndexSteps(week.loadIndex);
  if (steps === 0) return t('program.loadRule.neutral');

  const count = Math.abs(steps);
  if (steps > 0) {
    return count === 1 ? t('program.loadRule.up') : t('program.loadRule.upMany', { count });
  }
  return count === 1 ? t('program.loadRule.down') : t('program.loadRule.downMany', { count });
}
