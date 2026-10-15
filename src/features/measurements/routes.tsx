import { lazyRoute } from '@/app/lazyRoute';

/**
 * Les écrans des mensurations, chargés à la demande : la séance en direct ne doit pas payer leur
 * JavaScript, cf. `features/analytics/routes.tsx`.
 */

export const MeasurementsRoute = lazyRoute(
  () => import('./MeasurementsScreen'),
  'MeasurementsScreen',
);

export const MeasurementDetailRoute = lazyRoute(
  () => import('./MeasurementDetailScreen'),
  'MeasurementDetailScreen',
);
