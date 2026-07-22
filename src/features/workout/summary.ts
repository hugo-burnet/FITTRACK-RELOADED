import type { WorkoutSet } from '@/data/types';
import { t } from '@/i18n/fr';
import type { EntryColumn, TargetField } from '@/lib/measurement';
import { formatNumber } from '@/ui/numberField';

/** Which field of a stored set each entry column reads from. */
const FIELD_KEY = {
  weight: 'weight',
  reps: 'reps',
  duration: 'durationSeconds',
  distance: 'distanceMeters',
} as const satisfies Record<TargetField, keyof WorkoutSet>;

/**
 * « 102,5 × 8 » — one set in figures, with the units left to the column heads.
 *
 * The same reading the "précédent" cell shows, so a set struck through in the
 * undo strip is written exactly as it was written in the grid a second earlier.
 * A deletion has to be recognisable, not merely announced.
 */
export function setReading(
  set: Pick<WorkoutSet, 'weight' | 'reps' | 'durationSeconds' | 'distanceMeters'>,
  columns: EntryColumn[],
): string {
  return columns
    .map((column) => {
      const value = set[FIELD_KEY[column.field]];
      return value === undefined ? undefined : `${column.prefix ?? ''}${formatNumber(value)}`;
    })
    .filter((part) => part !== undefined)
    .join(' × ');
}

/**
 * « 2 séries sur 7 » — où j'en suis, en un coup d'œil.
 *
 * Le pendant de `features/routines/summary.ts`, au même endroit à l'écran :
 * au-dessus de la liste qu'il compte, jamais dans l'en-tête. C'est la leçon du
 * Lot 4 — sur 375 px, un relevé mis à côté d'un titre choisi par l'utilisateur
 * fait deux textes en concurrence, et ça casse dès que le nom dépasse
 * « Poussée ».
 */
export function workoutProgressLine(done: number, total: number): string {
  if (done === 0) return t('workout.progressNone', { total });
  if (done === 1) return t('workout.progressOne', { total });
  return t('workout.progress', { done, total });
}
