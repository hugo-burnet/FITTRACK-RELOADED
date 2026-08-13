import type { ProgramPhase } from '@/data/types';
import { t, type TranslationKey } from '@/i18n/fr';

// The suggestion table lives in `lib/programs` so recipes can read it without
// a feature importing another feature. Re-exported here for the editor.
export { LOAD_INDEX_PRESETS, SUGGESTED_LOAD_INDEX } from '@/lib/programs';

export const PHASE_LABEL_KEYS: Record<ProgramPhase, TranslationKey> = {
  construction: 'program.phase.construction',
  progression: 'program.phase.progression',
  overload: 'program.phase.overload',
  deload: 'program.phase.deload',
  return: 'program.phase.return',
  test: 'program.phase.test',
};

const PHASE_INTENTION_KEYS: Partial<Record<ProgramPhase, TranslationKey>> = {
  progression: 'program.intention.progression',
  overload: 'program.intention.overload',
  deload: 'program.intention.deload',
  return: 'program.intention.return',
  test: 'program.intention.test',
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

/** Intention phrase under the week line; Construction stays silent. */
export function phaseIntention(phase: ProgramPhase): string | null {
  const key = PHASE_INTENTION_KEYS[phase];
  return key === undefined ? null : t(key);
}
