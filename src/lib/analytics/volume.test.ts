import { describe, expect, it } from 'vitest';
import type { MeasurementType } from '@/data/types';
import type { HistoricalSet } from '@/lib/historyProjection';
import { addLocalWeeks, startOfLocalWeek } from '@/lib/history';
import { localOffsetMinutes } from '@/lib/timezone';
import {
  historicalExercise,
  historicalSet,
  historicalWorkout,
} from '@/test/historicalWorkout';
import { periodBounds } from './periods';
import {
  weeklyVolumeAverage,
  weeklyVolumeBuckets,
  weeklyVolumeTotal,
  type WeeklyVolumeBucket,
} from './volume';

/** Monday 27 July 2026, 14:00 local time. */
const now = new Date(2026, 6, 27, 14, 0, 0).getTime();

const week = (
  year: number,
  month: number,
  day: number,
): number =>
  startOfLocalWeek(new Date(year, month, day, 12).getTime());

interface SourceValues {
  startedAt: number;
  durationSeconds?: number;
  timezoneOffsetMinutes?: number;
  bodyWeightKg?: number;
  bodyweightLoadFactor?: number;
  measurementType?: MeasurementType;
  sets?: Array<Partial<HistoricalSet>>;
}

const source = ({
  startedAt,
  durationSeconds = 3_600,
  timezoneOffsetMinutes,
  bodyWeightKg,
  bodyweightLoadFactor,
  measurementType = 'weight_reps',
  sets = [{}],
}: SourceValues) =>
  historicalWorkout({
    startedAt,
    durationSeconds,
    ...(timezoneOffsetMinutes === undefined
      ? {}
      : { timezoneOffsetMinutes }),
    ...(bodyWeightKg === undefined ? {} : { bodyWeightKg }),
    exercises: [
      historicalExercise({
        measurementType,
        ...(bodyweightLoadFactor === undefined
          ? {}
          : { bodyweightLoadFactor }),
        sets: sets.map((values) => historicalSet(values)),
      }),
    ],
  });

describe('weeklyVolumeBuckets', () => {
  const bounds = periodBounds('4w', now);

  it('adds tonnage and duration for two sessions in one week', () => {
    const first = source({
      startedAt: new Date(2026, 6, 21, 8).getTime(),
      durationSeconds: 3_600,
      sets: [{ weight: 80, reps: 8 }],
    });
    const second = source({
      startedAt: new Date(2026, 6, 23, 18).getTime(),
      durationSeconds: 2_700,
      sets: [{ weight: 60, reps: 10 }],
    });

    const buckets = weeklyVolumeBuckets(
      [first, second],
      bounds,
      true,
    );

    expect(buckets.map((bucket) => bucket.tonnage)).toEqual([
      0,
      0,
      1_240,
      0,
    ]);
    expect(
      buckets.map((bucket) => bucket.durationSeconds),
    ).toEqual([0, 0, 6_300, 0]);
  });

  it('uses tonnage rules for assistance, ballast, and warm-ups', () => {
    const at = new Date(2026, 6, 21, 18).getTime();
    const sources = [
      source({
        startedAt: at,
        bodyWeightKg: 80,
        bodyweightLoadFactor: 1,
        measurementType: 'assisted_weight_reps',
        sets: [{ weight: 20, reps: 8 }],
      }),
      source({
        startedAt: at,
        bodyWeightKg: 80,
        bodyweightLoadFactor: 0.7,
        measurementType: 'reps_only',
        sets: [{ weight: 10, reps: 8 }],
      }),
      source({
        startedAt: at,
        sets: [
          {
            setType: 'warmup',
            weight: 100,
            reps: 10,
          },
          { weight: 50, reps: 5 },
        ],
      }),
    ];

    expect(
      weeklyVolumeBuckets(sources, bounds, true)[2]!.tonnage,
    ).toBe(1_258);
  });

  it('counts an eight-rep push-up set from body weight and its historical factor', () => {
    const pushUps = source({
      startedAt: new Date(2026, 6, 21, 18).getTime(),
      bodyWeightKg: 80,
      bodyweightLoadFactor: 0.7,
      measurementType: 'reps_only',
      sets: [{ weight: undefined, reps: 8 }],
    });

    expect(
      weeklyVolumeBuckets([pushUps], bounds, true)[2]!.tonnage,
    ).toBe(448);
  });

  it('uses session duration, never set duration', () => {
    const item = source({
      startedAt: new Date(2026, 6, 21, 18).getTime(),
      durationSeconds: 3_600,
      sets: [{ durationSeconds: 45 }],
    });

    expect(
      weeklyVolumeBuckets([item], bounds, true)[2]!
        .durationSeconds,
    ).toBe(3_600);
  });

  it('starts at the first session but keeps internal gaps', () => {
    const early = source({
      startedAt: new Date(2026, 6, 7, 18).getTime(),
    });
    const late = source({
      startedAt: new Date(2026, 6, 21, 18).getTime(),
    });

    const buckets = weeklyVolumeBuckets([early, late], bounds);

    expect(buckets.map((bucket) => bucket.weekStart)).toEqual([
      week(2026, 6, 6),
      week(2026, 6, 13),
      week(2026, 6, 20),
      week(2026, 6, 27),
    ]);
    expect(buckets[1]).toMatchObject({
      tonnage: 0,
      durationSeconds: 0,
    });
  });

  it('keeps the whole window when history predates it', () => {
    const buckets = weeklyVolumeBuckets([], bounds, true);

    expect(buckets).toHaveLength(4);
    expect(
      buckets.every((bucket) => bucket.tonnage === 0),
    ).toBe(true);
  });

  it('keeps Sunday evening in its historical offset week', () => {
    const parisSunday = Date.UTC(2026, 6, 26, 21, 30);
    const buckets = weeklyVolumeBuckets(
      [
        source({
          startedAt: parisSunday,
          timezoneOffsetMinutes: 120,
        }),
      ],
      bounds,
      true,
    );

    expect(buckets[2]!.tonnage).toBeGreaterThan(0);
    expect(buckets[3]!.tonnage).toBe(0);
  });

  it('crosses a time change without shifting weeks', () => {
    const october = new Date(2026, 9, 27, 14).getTime();
    const octoberBounds = periodBounds('4w', october);
    const at = new Date(2026, 9, 25, 10).getTime();
    const item = source({
      startedAt: at,
      timezoneOffsetMinutes: localOffsetMinutes(at),
    });

    const buckets = weeklyVolumeBuckets(
      [item],
      octoberBounds,
      true,
    );

    expect(buckets).toHaveLength(4);
    expect(buckets[3]!.weekStart).toBe(
      addLocalWeeks(buckets[0]!.weekStart, 3),
    );
    expect(
      buckets.every(
        (bucket) => new Date(bucket.weekStart).getHours() === 0,
      ),
    ).toBe(true);
  });

  it('starts at the oldest session for all history', () => {
    const old = source({
      startedAt: new Date(2026, 6, 8, 10).getTime(),
    });
    const buckets = weeklyVolumeBuckets(
      [old],
      periodBounds('all', now),
    );

    expect(buckets[0]!.weekStart).toBe(week(2026, 6, 6));
    expect(buckets.at(-1)!.weekStart).toBe(
      week(2026, 6, 27),
    );
  });

  it('returns empty for all history without sessions', () => {
    expect(
      weeklyVolumeBuckets([], periodBounds('all', now)),
    ).toEqual([]);
  });
});

describe('weekly volume summaries', () => {
  const buckets: WeeklyVolumeBucket[] = [
    { weekStart: 1, tonnage: 1_000, durationSeconds: 3_600 },
    { weekStart: 2, tonnage: 0, durationSeconds: 0 },
    { weekStart: 3, tonnage: 2_000, durationSeconds: 7_200 },
  ];

  it('includes zero weeks in the average', () => {
    expect(weeklyVolumeTotal(buckets, 'tonnage')).toBe(3_000);
    expect(weeklyVolumeAverage(buckets, 'tonnage')).toBe(1_000);
    expect(weeklyVolumeAverage(buckets, 'duration')).toBe(3_600);
  });

  it('returns zero without weeks instead of NaN', () => {
    expect(weeklyVolumeTotal([], 'duration')).toBe(0);
    expect(weeklyVolumeAverage([], 'duration')).toBe(0);
  });
});
