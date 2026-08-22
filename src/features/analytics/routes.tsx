import { lazy, Suspense } from 'react';

/**
 * The two analysis screens, loaded on demand.
 *
 * They live here rather than in `router.tsx` for a mechanical reason: a file
 * that exports both components and a non-component (the router itself) loses
 * fast refresh, and the rule that says so was already clean across the repo.
 *
 * The deferral itself is §12.2 of the finishing document: **the live session
 * must not pay the JavaScript of the charts.** Without a charting library the
 * bill is a few kilobytes — the rule is kept for what it prevents tomorrow, on
 * a bundle Vite already warns about.
 */

const AnalyticsScreen = lazy(() =>
  import('./AnalyticsScreen').then((module) => ({ default: module.AnalyticsScreen })),
);

const ExerciseAnalyticsScreen = lazy(() =>
  import('./ExerciseAnalyticsScreen').then((module) => ({
    default: module.ExerciseAnalyticsScreen,
  })),
);

const WeeklySessionsScreen = lazy(() =>
  import('./WeeklySessionsScreen').then((module) => ({
    default: module.WeeklySessionsScreen,
  })),
);

const WeeklyVolumeScreen = lazy(() =>
  import('./WeeklyVolumeScreen').then((module) => ({
    default: module.WeeklyVolumeScreen,
  })),
);

const MonthlyReportScreen = lazy(() =>
  import('./MonthlyReportScreen').then((module) => ({
    default: module.MonthlyReportScreen,
  })),
);

const MuscleBalanceScreen = lazy(() =>
  import('./MuscleBalanceScreen').then((module) => ({
    default: module.MuscleBalanceScreen,
  })),
);

const RecordsScreen = lazy(() =>
  import('../records/RecordsScreen').then((module) => ({ default: module.RecordsScreen })),
);

/**
 * An empty frame, not a spinner: the chunk arrives from the cache in a frame or
 * two, and a spinner shown for 30 ms is a flash of anxiety, not information.
 */
export function AnalyticsRoute() {
  return (
    <Suspense fallback={<span />}>
      <AnalyticsScreen />
    </Suspense>
  );
}

export function ExerciseAnalyticsRoute() {
  return (
    <Suspense fallback={<span />}>
      <ExerciseAnalyticsScreen />
    </Suspense>
  );
}

export function WeeklySessionsRoute() {
  return (
    <Suspense fallback={<span />}>
      <WeeklySessionsScreen />
    </Suspense>
  );
}

export function WeeklyVolumeRoute() {
  return (
    <Suspense fallback={<span />}>
      <WeeklyVolumeScreen />
    </Suspense>
  );
}

export function MonthlyReportRoute() {
  return (
    <Suspense fallback={<span />}>
      <MonthlyReportScreen />
    </Suspense>
  );
}

export function MuscleBalanceRoute() {
  return (
    <Suspense fallback={<span />}>
      <MuscleBalanceScreen />
    </Suspense>
  );
}

export function RecordsRoute() {
  return (
    <Suspense fallback={<span />}>
      <RecordsScreen />
    </Suspense>
  );
}
