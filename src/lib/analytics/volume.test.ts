import { describe, expect, it } from 'vitest';
import type {
  Exercise,
  MeasurementType,
  SetType,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '@/data/types';
import type { ExportSource } from '@/lib/export/types';
import { addLocalWeeks, startOfLocalWeek } from '@/lib/history';
import { localOffsetMinutes } from '@/lib/timezone';
import { periodBounds } from './periods';
import {
  weeklyVolumeAverage,
  weeklyVolumeBuckets,
  weeklyVolumeTotal,
  type WeeklyVolumeBucket,
} from './volume';

/** Lundi 27 juillet 2026, 14 h locale — l’instant depuis lequel on lit. */
const now = new Date(2026, 6, 27, 14, 0, 0).getTime();

const week = (year: number, month: number, day: number): number =>
  startOfLocalWeek(new Date(year, month, day, 12).getTime());

let sequence = 0;

const workout = (values: Partial<Workout>): Workout => ({
  id: `w-${++sequence}`,
  createdAt: 0,
  updatedAt: 0,
  deletedAt: 0,
  routineId: '',
  name: 'Upper A',
  status: 'completed',
  startedAt: 1_000,
  endedAt: 2_000,
  durationSeconds: 3_600,
  ...values,
});

const row = (workoutId: string, values: Partial<WorkoutExercise> = {}): WorkoutExercise => ({
  id: `we-${++sequence}`,
  createdAt: 0,
  updatedAt: 0,
  deletedAt: 0,
  workoutId,
  exerciseId: 'ex-1',
  order: 0,
  supersetGroup: 0,
  restSeconds: 120,
  ...values,
});

const exercise = (values: Partial<Exercise> = {}): Exercise => ({
  id: 'ex-1',
  createdAt: 0,
  updatedAt: 0,
  deletedAt: 0,
  name: 'Développé couché',
  primaryMuscle: 'chest',
  secondaryMuscles: [],
  equipment: 'barbell',
  measurementType: 'weight_reps',
  isCustom: 0,
  isUnilateral: 0,
  ...values,
});

const set = (workoutId: string, values: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id: `s-${++sequence}`,
  createdAt: 0,
  updatedAt: 0,
  deletedAt: 0,
  workoutExerciseId: 'we-1',
  exerciseId: 'ex-1',
  workoutId,
  order: 0,
  setType: 'normal',
  side: 'both',
  isCompleted: 1,
  performedAt: 1,
  weight: 80,
  reps: 8,
  ...values,
});

interface SourceValues {
  startedAt: number;
  durationSeconds?: number;
  timezoneOffsetMinutes?: number;
  measurementType?: MeasurementType;
  libraryMeasurementType?: MeasurementType;
  setType?: SetType;
  sets?: Array<Partial<WorkoutSet>>;
}

const source = ({
  startedAt,
  durationSeconds = 3_600,
  timezoneOffsetMinutes,
  measurementType = 'weight_reps',
  libraryMeasurementType = measurementType,
  sets = [{}],
}: SourceValues): ExportSource => {
  const item = workout({
    startedAt,
    endedAt: startedAt + durationSeconds * 1_000,
    durationSeconds,
    ...(timezoneOffsetMinutes === undefined
      ? {}
      : { startedTimezoneOffsetMinutes: timezoneOffsetMinutes }),
  });
  const itemRow = row(item.id, { exerciseMeasurementType: measurementType });

  return {
    workout: item,
    exercises: [
      {
        row: itemRow,
        exercise: exercise({ measurementType: libraryMeasurementType }),
        sets: sets.map((values, index) =>
          set(item.id, {
            workoutExerciseId: itemRow.id,
            order: index,
            ...values,
          }),
        ),
      },
    ],
  };
};

describe('weeklyVolumeBuckets', () => {
  const bounds = periodBounds('4w', now);

  it('additionne le tonnage et la durée de deux séances de la même semaine', () => {
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

    const buckets = weeklyVolumeBuckets([first, second], bounds, true);

    expect(buckets.map((bucket) => bucket.tonnage)).toEqual([0, 0, 1_240, 0]);
    expect(buckets.map((bucket) => bucket.durationSeconds)).toEqual([0, 0, 6_300, 0]);
  });

  it('reprend les règles de tonnage pour assistance, lest et échauffement', () => {
    const at = new Date(2026, 6, 21, 18).getTime();
    const sources = [
      source({
        startedAt: at,
        measurementType: 'assisted_weight_reps',
        sets: [{ weight: 20, reps: 8 }],
      }),
      source({
        startedAt: at,
        measurementType: 'reps_only',
        sets: [{ weight: 10, reps: 8 }],
      }),
      source({
        startedAt: at,
        sets: [
          { setType: 'warmup', weight: 100, reps: 10 },
          { weight: 50, reps: 5 },
        ],
      }),
    ];

    expect(weeklyVolumeBuckets(sources, bounds, true)[2]!.tonnage).toBe(250);
  });

  it('lit le type de mesure de l’instantané, pas celui de la bibliothèque', () => {
    const at = new Date(2026, 6, 21, 18).getTime();
    const item = source({
      startedAt: at,
      measurementType: 'assisted_weight_reps',
      libraryMeasurementType: 'weight_reps',
      sets: [{ weight: 20, reps: 8 }],
    });

    expect(weeklyVolumeBuckets([item], bounds, true)[2]!.tonnage).toBe(0);
  });

  it('prend la durée de la séance, jamais celle des séries', () => {
    const item = source({
      startedAt: new Date(2026, 6, 21, 18).getTime(),
      durationSeconds: 3_600,
      sets: [{ durationSeconds: 45 }],
    });

    expect(weeklyVolumeBuckets([item], bounds, true)[2]!.durationSeconds).toBe(3_600);
  });

  it('ne commence pas avant la première séance mais garde les trous internes', () => {
    const early = source({ startedAt: new Date(2026, 6, 7, 18).getTime() });
    const late = source({ startedAt: new Date(2026, 6, 21, 18).getTime() });

    const buckets = weeklyVolumeBuckets([early, late], bounds);

    expect(buckets.map((bucket) => bucket.weekStart)).toEqual([
      week(2026, 6, 6),
      week(2026, 6, 13),
      week(2026, 6, 20),
      week(2026, 6, 27),
    ]);
    expect(buckets[1]).toMatchObject({ tonnage: 0, durationSeconds: 0 });
  });

  it('garde toute la fenêtre quand l’historique la précède, même sans séance', () => {
    const buckets = weeklyVolumeBuckets([], bounds, true);

    expect(buckets).toHaveLength(4);
    expect(buckets.every((bucket) => bucket.tonnage === 0)).toBe(true);
  });

  it('garde le dimanche soir dans la semaine de son offset historique', () => {
    const parisSunday = Date.UTC(2026, 6, 26, 21, 30);
    const buckets = weeklyVolumeBuckets(
      [source({ startedAt: parisSunday, timezoneOffsetMinutes: 120 })],
      bounds,
      true,
    );

    expect(buckets[2]!.tonnage).toBeGreaterThan(0);
    expect(buckets[3]!.tonnage).toBe(0);
  });

  it('traverse un changement d’heure sans décaler les semaines', () => {
    const october = new Date(2026, 9, 27, 14).getTime();
    const octoberBounds = periodBounds('4w', october);
    const item = source({
      startedAt: new Date(2026, 9, 25, 10).getTime(),
      timezoneOffsetMinutes: localOffsetMinutes(new Date(2026, 9, 25, 10).getTime()),
    });

    const buckets = weeklyVolumeBuckets([item], octoberBounds, true);

    expect(buckets).toHaveLength(4);
    expect(buckets[3]!.weekStart).toBe(addLocalWeeks(buckets[0]!.weekStart, 3));
    expect(buckets.every((bucket) => new Date(bucket.weekStart).getHours() === 0)).toBe(true);
  });

  it('part de la plus ancienne séance pour la période Tout', () => {
    const old = source({ startedAt: new Date(2026, 6, 8, 10).getTime() });
    const buckets = weeklyVolumeBuckets([old], periodBounds('all', now));

    expect(buckets[0]!.weekStart).toBe(week(2026, 6, 6));
    expect(buckets.at(-1)!.weekStart).toBe(week(2026, 6, 27));
  });

  it('rend vide sur Tout sans historique', () => {
    expect(weeklyVolumeBuckets([], periodBounds('all', now))).toEqual([]);
  });
});

describe('weekly volume summaries', () => {
  const buckets: WeeklyVolumeBucket[] = [
    { weekStart: 1, tonnage: 1_000, durationSeconds: 3_600 },
    { weekStart: 2, tonnage: 0, durationSeconds: 0 },
    { weekStart: 3, tonnage: 2_000, durationSeconds: 7_200 },
  ];

  it('inclut les semaines à zéro dans la moyenne', () => {
    expect(weeklyVolumeTotal(buckets, 'tonnage')).toBe(3_000);
    expect(weeklyVolumeAverage(buckets, 'tonnage')).toBe(1_000);
    expect(weeklyVolumeAverage(buckets, 'duration')).toBe(3_600);
  });

  it('rend zéro sans semaine plutôt que NaN', () => {
    expect(weeklyVolumeTotal([], 'duration')).toBe(0);
    expect(weeklyVolumeAverage([], 'duration')).toBe(0);
  });
});
