import { t } from '@/i18n/fr';

/**
 * "9 exercices · 22 séries" — what a routine costs, in one line.
 *
 * Shared by the list and the editor so the two can never disagree about how a
 * routine is measured, and so the editor does not need a second reading in its
 * header competing with the routine's own name.
 */
export function routineSummaryLine(exerciseCount: number, setCount: number): string {
  if (exerciseCount === 0) return t('routines.empty');

  const exercises =
    exerciseCount === 1
      ? t('routines.exerciseCountOne')
      : t('routines.exerciseCount', { count: exerciseCount });

  const sets =
    setCount === 1 ? t('routines.setCountOne') : t('routines.setCount', { count: setCount });

  return `${exercises} · ${sets}`;
}
