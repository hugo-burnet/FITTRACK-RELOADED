import { addLocalWeeks, startOfLocalWeek } from '@/lib/history';
import { resolveExerciseIdentity } from '@/lib/exerciseSnapshot';
import type { ExportSource } from '@/lib/export/types';
import { measurementShape } from '@/lib/measurement';
import { sessionTotals } from '@/lib/volume';
import type { PeriodBounds } from './periods';
import { weekStartOf } from './weeks';

export type WeeklyVolumeMetric = 'tonnage' | 'duration';

export interface WeeklyVolumeBucket {
  weekStart: number;
  tonnage: number;
  durationSeconds: number;
}

function sourceTonnage(source: ExportSource): number {
  return sessionTotals(
    source.exercises.flatMap((entry) => {
      const { measurementType } = resolveExerciseIdentity(entry.row, entry.exercise);
      const weightRole =
        measurementType === undefined ? undefined : measurementShape(measurementType).weightRole;
      return entry.sets.map((set) => ({ set, weightRole }));
    }),
  ).tonnage;
}

export function weeklyVolumeBuckets(
  sources: readonly ExportSource[],
  bounds: PeriodBounds,
  hasEarlierHistory = false,
): WeeklyVolumeBucket[] {
  const totals = new Map<number, { tonnage: number; durationSeconds: number }>();

  for (const source of sources) {
    const { workout } = source;
    if (
      (bounds.from !== undefined && workout.startedAt < bounds.from) ||
      workout.startedAt >= bounds.to
    ) {
      continue;
    }

    const weekStart = weekStartOf(
      workout.startedAt,
      workout.startedTimezoneOffsetMinutes,
    );
    const current = totals.get(weekStart) ?? { tonnage: 0, durationSeconds: 0 };
    current.tonnage += sourceTonnage(source);
    current.durationSeconds += workout.durationSeconds;
    totals.set(weekStart, current);
  }

  const oldest = totals.size === 0 ? undefined : Math.min(...totals.keys());
  const first = bounds.from !== undefined && hasEarlierHistory ? bounds.from : oldest;
  if (first === undefined) return [];

  const buckets: WeeklyVolumeBucket[] = [];
  for (
    let weekStart = startOfLocalWeek(first);
    weekStart < bounds.to;
    weekStart = addLocalWeeks(weekStart, 1)
  ) {
    const value = totals.get(weekStart) ?? { tonnage: 0, durationSeconds: 0 };
    buckets.push({ weekStart, ...value });
  }

  return buckets;
}

export function weeklyVolumeValues(
  buckets: readonly WeeklyVolumeBucket[],
  metric: WeeklyVolumeMetric,
): number[] {
  return buckets.map((bucket) =>
    metric === 'tonnage' ? bucket.tonnage : bucket.durationSeconds,
  );
}

export function weeklyVolumeTotal(
  buckets: readonly WeeklyVolumeBucket[],
  metric: WeeklyVolumeMetric,
): number {
  return weeklyVolumeValues(buckets, metric).reduce((sum, value) => sum + value, 0);
}

export function weeklyVolumeAverage(
  buckets: readonly WeeklyVolumeBucket[],
  metric: WeeklyVolumeMetric,
): number {
  if (buckets.length === 0) return 0;
  return weeklyVolumeTotal(buckets, metric) / buckets.length;
}
