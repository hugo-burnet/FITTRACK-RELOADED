import { lazyRoute } from '@/app/lazyRoute';

/**
 * The history screens that are not the history itself.
 *
 * The import is the heaviest thing the app owns outside the session: a CSV
 * reader, a table of Hevy aliases, a matcher and the repository that writes the
 * result. It is used once when you arrive from Hevy, and possibly never again —
 * and it was being downloaded on every cold start, ahead of the first paint.
 *
 * The archived-session editor goes the same way, for the milder version of the
 * same reason: reading the history is a daily gesture, correcting it is not.
 *
 * La fiche d'une séance passée suit, au même titre : `HistoryScreen` est
 * l'onglet et reste chargé d'avance, ouvrir une séance pour la relire est un
 * cran plus loin. Onglet chargé d’avance, profondeur à la demande.
 */

export const HevyImportRoute = lazyRoute(
  () => import('./HevyImportScreen'),
  'HevyImportScreen',
);

export const HistoryEditRoute = lazyRoute(
  () => import('./HistoryEditScreen'),
  'HistoryEditScreen',
);

export const HistoryDetailRoute = lazyRoute(
  () => import('./HistoryDetailScreen'),
  'HistoryDetailScreen',
);
