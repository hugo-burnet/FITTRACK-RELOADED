import { t } from '@/i18n/fr';

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
