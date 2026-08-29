import { lazyRoute } from '@/app/lazyRoute';

/**
 * L'écran des paliers, chargé à la demande.
 *
 * Différé pour la raison de §12.2 : **la séance en direct ne paie pas le
 * JavaScript de ce qu'elle n'ouvre pas.** On consulte ses paliers assis dans le
 * canapé, jamais entre deux séries.
 */
export const MilestonesRoute = lazyRoute(
  () => import('./MilestonesScreen'),
  'MilestonesScreen',
);
