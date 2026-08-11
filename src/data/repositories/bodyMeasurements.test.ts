import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/data/db';
import { newEntity } from '@/data/repositories/base';
import type {
  BodyMeasurement,
  Exercise,
  MeasurementType,
  PersonalRecord,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '@/data/types';
import { resetDb } from '@/test/resetDb';
import { rebuildAllRecords } from './personalRecords';
import {
  getLatestBodyWeight,
  resolveBodyWeightsAt,
  saveBodyWeight,
} from './bodyMeasurements';

const at = (day: number, hour = 12): number => new Date(2026, 7, day, hour).getTime();

const bodyWeight = (value: number, measuredAt: number, deletedAt = 0): BodyMeasurement => ({
  ...newEntity<BodyMeasurement>({
    type: 'body_weight',
    value,
    unit: 'kg',
    measuredAt,
  }),
  deletedAt,
});

const movement = (
  id: string,
  measurementType: MeasurementType,
  bodyweightLoadFactor?: number,
): Exercise => ({
  ...newEntity<Exercise>({
    name: id,
    primaryMuscle: 'lats',
    secondaryMuscles: [],
    equipment: measurementType === 'weight_reps' ? 'barbell' : 'bodyweight',
    measurementType,
    isCustom: 1,
    isUnilateral: 0,
    ...(bodyweightLoadFactor === undefined ? {} : { bodyweightLoadFactor }),
  }),
  id,
});

interface SessionSeed {
  id: string;
  exercise: Exercise;
  startedAt: number;
  reps: number;
  weight?: number;
  snapshotMeasurementType?: MeasurementType;
}

function sessionEntities(seed: SessionSeed): {
  workout: Workout;
  row: WorkoutExercise;
  set: WorkoutSet;
} {
  const snapshotMeasurementType =
    seed.snapshotMeasurementType ?? seed.exercise.measurementType;
  const workout = {
    ...newEntity<Workout>({
      routineId: '',
      name: seed.id,
      status: 'completed',
      startedAt: seed.startedAt,
      endedAt: seed.startedAt + 3_600_000,
      durationSeconds: 3600,
    }),
    id: `workout-${seed.id}`,
  };
  const row = {
    ...newEntity<WorkoutExercise>({
      workoutId: workout.id,
      exerciseId: seed.exercise.id,
      order: 0,
      supersetGroup: 0,
      restSeconds: 120,
      exerciseName: seed.exercise.name,
      exerciseMeasurementType: snapshotMeasurementType,
      exercisePrimaryMuscle: seed.exercise.primaryMuscle,
      exerciseEquipment: seed.exercise.equipment,
      ...(seed.exercise.bodyweightLoadFactor === undefined ||
        snapshotMeasurementType === 'weight_reps'
        ? {}
        : { exerciseBodyweightLoadFactor: seed.exercise.bodyweightLoadFactor }),
    }),
    id: `row-${seed.id}`,
  };
  const set = {
    ...newEntity<WorkoutSet>({
      workoutExerciseId: row.id,
      exerciseId: seed.exercise.id,
      workoutId: workout.id,
      order: 0,
      setType: 'normal',
      side: 'both',
      reps: seed.reps,
      ...(seed.weight === undefined ? {} : { weight: seed.weight }),
      isCompleted: 1,
      performedAt: seed.startedAt + 60_000,
    }),
    id: `set-${seed.id}`,
  };
  return { workout, row, set };
}

async function seedHistory(exercises: Exercise[], sessions: SessionSeed[]): Promise<void> {
  const entities = sessions.map(sessionEntities);
  await db.transaction(
    'rw',
    db.exercises,
    db.workouts,
    db.workoutExercises,
    db.workoutSets,
    async () => {
      await db.exercises.bulkAdd(exercises);
      await db.workouts.bulkAdd(entities.map(({ workout }) => workout));
      await db.workoutExercises.bulkAdd(entities.map(({ row }) => row));
      await db.workoutSets.bulkAdd(entities.map(({ set }) => set));
    },
  );
}

async function liveRecords(): Promise<PersonalRecord[]> {
  return (await db.personalRecords.toArray()).filter((record) => record.deletedAt === 0);
}

function sessionRecord(
  records: readonly PersonalRecord[],
  workoutId: string,
): PersonalRecord {
  return records.find(
    (record) => record.workoutId === workoutId && record.type === 'max_volume_session',
  )!;
}

describe('body weight measurements', () => {
  beforeEach(resetDb);

  it('saves the first reading as a live kilogram body measurement', async () => {
    const reading = await saveBodyWeight(82.4, at(3));

    expect(reading).toEqual({ valueKg: 82.4, measuredAt: at(3) });
    expect(await db.bodyMeasurements.toArray()).toMatchObject([
      { type: 'body_weight', value: 82.4, unit: 'kg', measuredAt: at(3), deletedAt: 0 },
    ]);
  });

  it('replaces the measurement from the same local day without adding a row', async () => {
    await saveBodyWeight(82.4, at(3, 8));
    const replacement = await saveBodyWeight(81.9, at(3, 20));

    const rows = await db.bodyMeasurements.toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ value: 81.9, measuredAt: at(3, 8) });
    expect(replacement).toEqual({ valueKg: 81.9, measuredAt: at(3, 8) });
  });

  it('keeps a corrected daily weight effective from its original measurement time', async () => {
    await saveBodyWeight(83, at(2, 20));
    await saveBodyWeight(80, at(3, 8));
    await saveBodyWeight(81, at(3, 20));

    expect(await resolveBodyWeightsAt([at(3, 9)])).toEqual(new Map([[at(3, 9), 81]]));
  });

  it('inserts an independent measurement for another local day', async () => {
    await saveBodyWeight(82.4, at(3));
    await saveBodyWeight(81.9, at(4));

    expect(await db.bodyMeasurements.count()).toBe(2);
  });

  it('reads the latest live body-weight measurement', async () => {
    await saveBodyWeight(82.4, at(3));
    await saveBodyWeight(81.9, at(5));

    expect(await getLatestBodyWeight()).toEqual({ valueKg: 81.9, measuredAt: at(5) });
  });

  it('resolves each timestamp from the latest prior weight or the earliest fallback', async () => {
    await saveBodyWeight(82.4, at(3));
    await saveBodyWeight(81.8, at(7));

    expect(await resolveBodyWeightsAt([at(1), at(5), at(9)])).toEqual(
      new Map([
        [at(1), 82.4],
        [at(5), 82.4],
        [at(9), 81.8],
      ]),
    );
  });

  it('resolves an unordered batch independently for every timestamp', async () => {
    await saveBodyWeight(82.4, at(3));
    await saveBodyWeight(81.8, at(7));

    expect(await resolveBodyWeightsAt([at(9), at(1), at(5)])).toEqual(
      new Map([
        [at(9), 81.8],
        [at(1), 82.4],
        [at(5), 82.4],
      ]),
    );
  });

  it('ignores deleted rows on reads and resolution', async () => {
    await db.bodyMeasurements.bulkAdd([
      bodyWeight(90, at(1), at(2)),
      bodyWeight(82.4, at(3)),
    ]);

    expect(await getLatestBodyWeight()).toEqual({ valueKg: 82.4, measuredAt: at(3) });
    expect(await resolveBodyWeightsAt([at(1)])).toEqual(new Map([[at(1), 82.4]]));
  });

  it('reconciles only bodyweight session records in the corrected [M2, M3) interval', async () => {
    const pullUp = movement('pull-up', 'reps_only', 1);
    const assisted = movement('assisted', 'assisted_weight_reps', 1);
    const bench = movement('bench', 'reps_only', 1);
    await seedHistory(
      [pullUp, assisted, bench],
      [
        { id: 'pull-before', exercise: pullUp, startedAt: at(4), reps: 1 },
        { id: 'pull-affected', exercise: pullUp, startedAt: at(6), reps: 2 },
        { id: 'pull-after', exercise: pullUp, startedAt: at(9), reps: 3 },
        { id: 'assist-affected', exercise: assisted, startedAt: at(7), reps: 2, weight: 10 },
        {
          id: 'bench-affected',
          exercise: bench,
          startedAt: at(6),
          reps: 2,
          weight: 20,
          snapshotMeasurementType: 'weight_reps',
        },
      ],
    );
    await db.bodyMeasurements.bulkAdd([
      bodyWeight(80, at(2, 8)),
      bodyWeight(90, at(5, 8)),
      bodyWeight(100, at(8, 8)),
    ]);
    await rebuildAllRecords();
    const canonical = await liveRecords();
    const benchSession = sessionRecord(canonical, 'workout-bench-affected');
    await db.personalRecords.update(benchSession.id, { value: 999 });
    const before = await liveRecords();
    const stableBefore = new Map(
      before
        .filter(
          (record) =>
            record.type !== 'max_volume_session' ||
            !['workout-pull-affected', 'workout-assist-affected'].includes(record.workoutId),
        )
        .map((record) => [record.id, record]),
    );
    const pullAffectedId = sessionRecord(before, 'workout-pull-affected').id;
    const assistAffectedId = sessionRecord(before, 'workout-assist-affected').id;

    const corrected = await saveBodyWeight(95, at(5, 20));

    const after = await liveRecords();
    expect(corrected).toEqual({ valueKg: 95, measuredAt: at(5, 8) });
    expect((await db.bodyMeasurements.toArray()).filter((row) => row.deletedAt === 0))
      .toHaveLength(3);
    expect(sessionRecord(after, 'workout-pull-affected')).toMatchObject({
      id: pullAffectedId,
      value: 190,
    });
    expect(sessionRecord(after, 'workout-assist-affected')).toMatchObject({
      id: assistAffectedId,
      value: 170,
    });
    expect(
      new Map(
        after
          .filter((record) => stableBefore.has(record.id))
          .map((record) => [record.id, record]),
      ),
    ).toEqual(stableBefore);
  });

  it('inserts a measurement that splits the former interval at inclusive and exclusive bounds', async () => {
    const pullUp = movement('pull-up', 'reps_only', 1);
    await seedHistory(
      [pullUp],
      [
        { id: 'at-new', exercise: pullUp, startedAt: at(5), reps: 1 },
        { id: 'at-next', exercise: pullUp, startedAt: at(8), reps: 1 },
      ],
    );
    await db.bodyMeasurements.bulkAdd([
      bodyWeight(80, at(2)),
      bodyWeight(100, at(8)),
    ]);
    await rebuildAllRecords();
    const before = await liveRecords();
    const atNewId = sessionRecord(before, 'workout-at-new').id;
    const atNext = sessionRecord(before, 'workout-at-next');

    await saveBodyWeight(90, at(5));

    const after = await liveRecords();
    expect(sessionRecord(after, 'workout-at-new')).toMatchObject({ id: atNewId, value: 90 });
    expect(sessionRecord(after, 'workout-at-next')).toEqual(atNext);
    expect(await db.bodyMeasurements.count()).toBe(3);
  });

  it('reconciles workouts before the first measurement through the earliest fallback', async () => {
    const pullUp = movement('pull-up', 'reps_only', 1);
    await seedHistory(
      [pullUp],
      [{ id: 'before-first', exercise: pullUp, startedAt: at(3), reps: 2 }],
    );
    await db.bodyMeasurements.bulkAdd([
      bodyWeight(80, at(5, 8)),
      bodyWeight(90, at(8, 8)),
    ]);
    await rebuildAllRecords();
    const original = sessionRecord(await liveRecords(), 'workout-before-first');

    await saveBodyWeight(85, at(5, 20));

    expect(sessionRecord(await liveRecords(), 'workout-before-first')).toMatchObject({
      id: original.id,
      value: 170,
    });
  });

  it('rolls back the measurement correction when record reconciliation fails', async () => {
    const pullUp = movement('pull-up', 'reps_only', 1);
    await seedHistory(
      [pullUp],
      [{ id: 'affected', exercise: pullUp, startedAt: at(6), reps: 2 }],
    );
    await db.bodyMeasurements.bulkAdd([
      bodyWeight(80, at(5)),
      bodyWeight(90, at(8)),
    ]);
    await rebuildAllRecords();
    const measurementsBefore = await db.bodyMeasurements.toArray();
    const recordsBefore = await db.personalRecords.toArray();
    const fail = vi
      .spyOn(db.personalRecords, 'bulkPut')
      .mockRejectedValueOnce(new Error('record reconciliation failed'));

    try {
      await expect(saveBodyWeight(85, at(5, 20)))
        .rejects.toThrow('record reconciliation failed');
    } finally {
      fail.mockRestore();
    }

    expect(await db.bodyMeasurements.toArray()).toEqual(measurementsBefore);
    expect(await db.personalRecords.toArray()).toEqual(recordsBefore);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid body weight %s',
    async (valueKg) => {
      await expect(saveBodyWeight(valueKg, at(3))).rejects.toThrow(RangeError);
      expect(await db.bodyMeasurements.count()).toBe(0);
    },
  );
});
