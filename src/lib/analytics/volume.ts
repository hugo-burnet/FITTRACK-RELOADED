import type { HistoricalWorkout } from '@/lib/historyProjection';
import { measurementShape } from '@/lib/measurement';
import { sessionTotals } from '@/lib/volume';
import type { PeriodBounds } from './periods';
import { knownWeekStarts, weekStartOf } from './weeks';

export type WeeklyVolumeMetric = 'tonnage' | 'duration';

export interface WeeklyVolumeBucket {
  weekStart: number;
  tonnage: number;
  durationSeconds: number;
}

function sourceTonnage(workout: HistoricalWorkout): number {
  return sessionTotals(
    workout.exercises.flatMap((exercise) => {
      const weightRole =
        exercise.measurementType === undefined
          ? undefined
          : measurementShape(exercise.measurementType).weightRole;
      return exercise.sets.map((set) => ({
        set,
        weightRole,
        bodyweightLoadFactor: exercise.bodyweightLoadFactor,
      }));
    }),
    workout.bodyWeightKg,
  ).tonnage;
}

export function weeklyVolumeBuckets(
  sources: readonly HistoricalWorkout[],
  bounds: PeriodBounds,
  hasEarlierHistory = false,
): WeeklyVolumeBucket[] {
  const totals = new Map<number, { tonnage: number; durationSeconds: number }>();

  for (const source of sources) {
    if (
      (bounds.from !== undefined && source.startedAt < bounds.from) ||
      source.startedAt >= bounds.to
    ) {
      continue;
    }

    const weekStart = weekStartOf(
      source.startedAt,
      source.timezoneOffsetMinutes,
    );
    const current = totals.get(weekStart) ?? { tonnage: 0, durationSeconds: 0 };
    current.tonnage += sourceTonnage(source);
    current.durationSeconds += source.durationSeconds;
    totals.set(weekStart, current);
  }

  return knownWeekStarts(totals.keys(), bounds, hasEarlierHistory).map((weekStart) => {
    const value = totals.get(weekStart) ?? { tonnage: 0, durationSeconds: 0 };
    return { weekStart, ...value };
  });
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
