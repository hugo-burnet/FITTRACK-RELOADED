import { lazyRoute } from '@/app/lazyRoute';

/**
 * Ce qui se trouve derrière l'onglet Exercices, chargé à la demande.
 *
 * `ExercisesScreen` reste chargé d'avance : c'est un onglet de la barre du bas,
 * donc une pression depuis n'importe où. Ces deux-là sont un cran plus loin —
 * on ouvre la fiche d'un exercice pour la lire, on ouvre le formulaire pour en
 * créer un, et ni l'un ni l'autre n'arrive entre deux séries.
 *
 * C'est la règle que `history/` et `settings/` appliquent déjà : l'onglet est
 * chargé d'avance, la profondeur ne l'est pas. Ces 853 lignes voyageaient dans
 * le chunk d'entrée, devant le premier écran.
 */

export const ExerciseDetailRoute = lazyRoute(
  () => import('./ExerciseDetailScreen'),
  'ExerciseDetailScreen',
);

export const ExerciseFormRoute = lazyRoute(
  () => import('./ExerciseFormScreen'),
  'ExerciseFormScreen',
);
