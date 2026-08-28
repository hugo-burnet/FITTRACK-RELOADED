import { lazyRoute } from '@/app/lazyRoute';

/**
 * Composer une routine, à la demande.
 *
 * `RoutinesScreen` reste chargé d'avance : c'est l'onglet, et c'est de là qu'on
 * lance une séance — le chemin que le Lot 1 protège. Écrire une routine et y
 * choisir des exercices est l'autre métier de cet onglet : on le fait sur le
 * canapé, une fois, pas dans la salle entre deux séries.
 *
 * Même règle que `history/`, `settings/` et `exercises/` : l'onglet d'avance,
 * la profondeur à la demande.
 */

export const RoutineEditorRoute = lazyRoute(
  () => import('./RoutineEditorScreen'),
  'RoutineEditorScreen',
);

export const ExercisePickerRoute = lazyRoute(
  () => import('./ExercisePickerScreen'),
  'ExercisePickerScreen',
);
