import { lazyRoute } from '@/app/lazyRoute';

/**
 * The analysis screens, loaded on demand.
 *
 * They live here rather than in `router.tsx` for a mechanical reason: a file
 * that exports both components and a non-component (the router itself) loses
 * fast refresh, and the rule that says so was already clean across the repo.
 *
 * The deferral itself is §12.2 of the finishing document: **the live session
 * must not pay the JavaScript of the charts.** Without a charting library the
 * bill is a few kilobytes — the rule is kept for what it prevents tomorrow, on
 * a bundle Vite already warns about.
 *
 * The `lazy` + `Suspense` pair each of these used to spell out now lives in
 * `app/lazyRoute`, which is also what the other features defer through.
 */

export const AnalyticsRoute = lazyRoute(
  () => import('./AnalyticsScreen'),
  'AnalyticsScreen',
);

export const ExerciseAnalyticsRoute = lazyRoute(
  () => import('./ExerciseAnalyticsScreen'),
  'ExerciseAnalyticsScreen',
);

export const WeeklySessionsRoute = lazyRoute(
  () => import('./WeeklySessionsScreen'),
  'WeeklySessionsScreen',
);

export const WeeklyVolumeRoute = lazyRoute(
  () => import('./WeeklyVolumeScreen'),
  'WeeklyVolumeScreen',
);

export const MonthlyReportRoute = lazyRoute(
  () => import('./MonthlyReportScreen'),
  'MonthlyReportScreen',
);

export const MuscleBalanceRoute = lazyRoute(
  () => import('./MuscleBalanceScreen'),
  'MuscleBalanceScreen',
);

export const RecordsRoute = lazyRoute(
  () => import('../records/RecordsScreen'),
  'RecordsScreen',
);
