import Dexie from 'dexie';
import { db } from '@/data/db';
import { newEntity, touch } from '@/data/repositories/base';
import { resolveWorkoutExerciseIdentity } from '@/lib/exerciseSnapshot';
import type {
  BodyMeasurement,
  MeasurementType,
  PersonalRecordType,
  Workout,
} from '@/data/types';
import { reconcileRecordsForExercises } from './recordReconciliation';
import { getOneRepMaxFormula } from './settings';

const BODY_WEIGHT_TYPE = 'body_weight';
const BODYWEIGHT_MEASUREMENTS = new Set<MeasurementType>([
  'reps_only',
  'assisted_weight_reps',
]);
const BODYWEIGHT_RECORD_TYPES = new Set<PersonalRecordType>(['max_volume_session']);

export interface BodyWeightReading {
  valueKg: number;
  measuredAt: number;
}

function localDayBounds(timestamp: number): readonly [number, number] {
  const start = new Date(timestamp);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return [start.getTime(), end.getTime()];
}

async function liveBodyWeightRows(): Promise<BodyMeasurement[]> {
  const rows = await db.bodyMeasurements
    .where('[type+measuredAt]')
    .between([BODY_WEIGHT_TYPE, Dexie.minKey], [BODY_WEIGHT_TYPE, Dexie.maxKey])
    .toArray();

  return rows.filter((row) => row.deletedAt === 0);
}

function asReading(row: BodyMeasurement): BodyWeightReading {
  return { valueKg: row.value, measuredAt: row.measuredAt };
}

function assertValidBodyWeight(valueKg: number): void {
  if (!Number.isFinite(valueKg) || valueKg <= 0) {
    throw new RangeError('Body weight must be a finite positive number');
  }
}

interface EffectiveInterval {
  start?: number;
  end?: number;
}

function effectiveIntervalFor(
  rows: readonly BodyMeasurement[],
  measurementId: string,
): EffectiveInterval | undefined {
  const ordered = [...rows].sort(
    (left, right) =>
      left.measuredAt - right.measuredAt ||
      left.createdAt - right.createdAt ||
      left.id.localeCompare(right.id),
  );
  const index = ordered.findIndex((row) => row.id === measurementId);
  if (index < 0) return undefined;

  return {
    ...(index === 0 ? {} : { start: ordered[index]!.measuredAt }),
    ...(ordered[index + 1] === undefined ? {} : { end: ordered[index + 1]!.measuredAt }),
  };
}

function includedWorkout(workout: Workout): boolean {
  return (
    workout.deletedAt === 0 &&
    (workout.status === 'active' || workout.status === 'completed')
  );
}

async function workoutsInInterval(interval: EffectiveInterval): Promise<Workout[]> {
  if (interval.start === undefined && interval.end === undefined) {
    return db.workouts.toArray();
  }
  if (interval.start === undefined) {
    return db.workouts.where('startedAt').below(interval.end!).toArray();
  }
  if (interval.end === undefined) {
    return db.workouts.where('startedAt').aboveOrEqual(interval.start).toArray();
  }
  return db.workouts
    .where('startedAt')
    .between(interval.start, interval.end, true, false)
    .toArray();
}

async function bodyweightExerciseIdsIn(
  intervals: readonly EffectiveInterval[],
): Promise<string[]> {
  const workouts = new Map<string, Workout>();
  for (const interval of intervals) {
    for (const workout of await workoutsInInterval(interval)) {
      if (includedWorkout(workout)) workouts.set(workout.id, workout);
    }
  }
  if (workouts.size === 0) return [];

  const rows = await db.workoutExercises
    .where('workoutId')
    .anyOf([...workouts.keys()])
    .toArray();
  const exercises = await db.exercises.bulkGet([
    ...new Set(rows.map((row) => row.exerciseId)),
  ]);
  const exerciseById = new Map(
    exercises.flatMap((exercise) =>
      exercise === undefined ? [] : [[exercise.id, exercise] as const],
    ),
  );
  return [
    ...new Set(
      rows
        .filter(
          (row) =>
            row.deletedAt === 0 &&
            BODYWEIGHT_MEASUREMENTS.has(
              resolveWorkoutExerciseIdentity(row, exerciseById.get(row.exerciseId))
                .measurementType,
            ),
        )
        .map((row) => row.exerciseId),
    ),
  ];
}

export async function getLatestBodyWeight(): Promise<BodyWeightReading | undefined> {
  const rows = await liveBodyWeightRows();
  let latest: BodyMeasurement | undefined;

  for (const row of rows) {
    if (latest === undefined || row.measuredAt > latest.measuredAt) latest = row;
  }

  return latest === undefined ? undefined : asReading(latest);
}

export async function saveBodyWeight(
  valueKg: number,
  measuredAt = Date.now(),
): Promise<BodyWeightReading> {
  assertValidBodyWeight(valueKg);
  const [dayStart, nextDayStart] = localDayBounds(measuredAt);

  return db.transaction(
    'rw',
    [
      db.settings,
      db.exercises,
      db.workouts,
      db.workoutExercises,
      db.workoutSets,
      db.bodyMeasurements,
      db.personalRecords,
    ],
    async () => {
      const beforeRows = await liveBodyWeightRows();
      const existing = beforeRows.find(
        (row) => row.measuredAt >= dayStart && row.measuredAt < nextDayStart,
      );
      // A correction changes the day's value, not the instant from which that value applies.
      // Moving an 08:00 reading to the 20:00 correction time would retroactively make a 09:00
      // workout fall back to yesterday's weight.
      const next =
        existing === undefined
          ? newEntity<BodyMeasurement>({
              type: BODY_WEIGHT_TYPE,
              value: valueKg,
              unit: 'kg',
              measuredAt,
            })
          : touch(existing, { value: valueKg, unit: 'kg' });
      const afterRows =
        existing === undefined
          ? [...beforeRows, next]
          : beforeRows.map((row) => (row.id === existing.id ? next : row));
      const intervals = [
        ...(existing === undefined
          ? []
          : [effectiveIntervalFor(beforeRows, existing.id)!]),
        effectiveIntervalFor(afterRows, next.id)!,
      ];
      const exerciseIds = await bodyweightExerciseIdsIn(intervals);

      if (existing === undefined) await db.bodyMeasurements.add(next);
      else await db.bodyMeasurements.put(next);
      await reconcileRecordsForExercises(
        exerciseIds,
        await getOneRepMaxFormula(),
        BODYWEIGHT_RECORD_TYPES,
      );
      return asReading(next);
    },
  );
}

export async function resolveBodyWeightsAt(
  timestamps: readonly number[],
): Promise<Map<number, number>> {
  const rows = await liveBodyWeightRows();
  if (rows.length === 0) return new Map();

  rows.sort((left, right) => left.measuredAt - right.measuredAt);
  const resolved = new Map<number, number>();

  for (const timestamp of timestamps) {
    let low = 0;
    let high = rows.length - 1;

    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (rows[middle]!.measuredAt <= timestamp) low = middle;
      else high = middle - 1;
    }

    const index = rows[low]!.measuredAt > timestamp ? 0 : low;
    resolved.set(timestamp, rows[index]!.value);
  }

  return resolved;
}
