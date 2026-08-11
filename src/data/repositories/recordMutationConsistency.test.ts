import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/data/db';
import type { Exercise, PersonalRecord } from '@/data/types';
import { projectRecordTimeline, type RecordEventDraft } from '@/lib/records';
import { day, seedWorkout } from '@/test/factories';
import { resetDb } from '@/test/resetDb';
import { newEntity } from './base';
import { deleteArchivedWorkout, getArchivedWorkoutDetail, saveArchivedWorkout } from './history';
import { reconcileRecordsForExercises } from './recordReconciliation';
import { listRecordSourcesForExercises } from './recordSources';
import {
  addWorkoutExercise,
  completeSet,
  deleteWorkout,
  discardWorkout,
  removeWorkoutExercise,
  reorderWorkoutExercises,
  startWorkout,
} from './workouts';

const FORMULA = 'epley' as const;

function exercise(id: string): Exercise {
  return {
    ...newEntity<Exercise>({
      name: id,
      primaryMuscle: 'chest',
      secondaryMuscles: [],
      equipment: 'barbell',
      measurementType: 'weight_reps',
      isCustom: 1,
      isUnilateral: 0,
    }),
    id,
  };
}

function businessKey(
  record: Pick<PersonalRecord, 'exerciseId' | 'type' | 'workoutId' | 'workoutSetId'>,
): string {
  return [record.exerciseId, record.type, record.workoutId, record.workoutSetId ?? ''].join('|');
}

function content(record: PersonalRecord): RecordEventDraft {
  return {
    exerciseId: record.exerciseId,
    type: record.type,
    value: record.value,
    achievedAt: record.achievedAt,
    workoutId: record.workoutId,
    ...(record.workoutSetId === undefined ? {} : { workoutSetId: record.workoutSetId }),
    ...(record.weight === undefined ? {} : { weight: record.weight }),
    ...(record.reps === undefined ? {} : { reps: record.reps }),
    ...(record.durationSeconds === undefined ? {} : { durationSeconds: record.durationSeconds }),
    ...(record.distanceMeters === undefined ? {} : { distanceMeters: record.distanceMeters }),
    ...(record.formula === undefined ? {} : { formula: record.formula }),
  };
}

async function expectExactProjection(exerciseIds: readonly string[]): Promise<void> {
  const expected = projectRecordTimeline(await listRecordSourcesForExercises(exerciseIds), FORMULA);
  const active = (await db.personalRecords.toArray()).filter(
    (record) => record.deletedAt === 0 && exerciseIds.includes(record.exerciseId),
  );
  const byKey = new Map(active.map((record) => [businessKey(record), record]));

  expect(byKey.size).toBe(active.length);
  expect([...byKey.keys()].sort()).toEqual(expected.map(businessKey).sort());
  expect(expected.map((draft) => content(byKey.get(businessKey(draft))!))).toStrictEqual(expected);
}

async function completeActiveSet(exerciseId: string) {
  await db.exercises.put(exercise(exerciseId));
  await seedWorkout({ exerciseId, performedAt: day(1), sets: [[100, 5]] });
  await reconcileRecordsForExercises([exerciseId], FORMULA);
  const workout = await startWorkout('', 'Mutation');
  const row = await addWorkoutExercise(workout.id, exerciseId);
  const set = await db.workoutSets.where('workoutExerciseId').equals(row.id).first();
  await completeSet(set!.id, { weight: 120, reps: 5 });
  return { workout, row };
}

async function snapshotWorkout(workoutId: string) {
  return {
    workout: await db.workouts.get(workoutId),
    rows: (await db.workoutExercises.where('workoutId').equals(workoutId).toArray()).sort(
      (left, right) => left.id.localeCompare(right.id),
    ),
    sets: (await db.workoutSets.where('workoutId').equals(workoutId).toArray()).sort(
      (left, right) => left.id.localeCompare(right.id),
    ),
    records: (await db.personalRecords.toArray()).sort((left, right) =>
      left.id.localeCompare(right.id),
    ),
  };
}

describe('record projection after source mutations', () => {
  beforeEach(resetDb);

  it('reconciles after discarding an active workout', async () => {
    const { workout } = await completeActiveSet('bench');
    const before = (await db.personalRecords.toArray()).filter((record) => record.deletedAt === 0);
    expect(new Set(before.map((record) => record.workoutId)).size).toBe(2);

    await discardWorkout(workout.id);

    await expectExactProjection(['bench']);
    expect((await db.personalRecords.toArray()).some((record) => record.deletedAt === 0)).toBe(
      true,
    );
  });

  it('reconciles after deleting a workout through the live lifecycle', async () => {
    const { workout } = await completeActiveSet('bench');

    await deleteWorkout(workout.id);

    await expectExactProjection(['bench']);
    expect((await db.personalRecords.toArray()).some((record) => record.deletedAt === 0)).toBe(
      true,
    );
  });

  it('reconciles after removing a workout exercise with completed sets', async () => {
    const { row } = await completeActiveSet('bench');

    await removeWorkoutExercise(row.id);

    await expectExactProjection(['bench']);
    expect((await db.personalRecords.toArray()).some((record) => record.deletedAt === 0)).toBe(
      true,
    );
  });

  it('reconciles canonical winners after reordering equal-timestamp occurrences', async () => {
    await db.exercises.put(exercise('bench'));
    const workout = await startWorkout('', 'Ordre canonique');
    const firstRow = await addWorkoutExercise(workout.id, 'bench');
    const secondRow = await addWorkoutExercise(workout.id, 'bench');
    const firstSet = await db.workoutSets.where('workoutExerciseId').equals(firstRow.id).first();
    const secondSet = await db.workoutSets.where('workoutExerciseId').equals(secondRow.id).first();
    const now = vi.spyOn(Date, 'now').mockReturnValue(day(2));
    try {
      await completeSet(firstSet!.id, { weight: 100, reps: 5 });
      await completeSet(secondSet!.id, { weight: 110, reps: 5 });
    } finally {
      now.mockRestore();
    }

    await reorderWorkoutExercises(workout.id, 0, 1);

    await expectExactProjection(['bench']);
  });

  it('rolls back lifecycle sources and records when reconciliation fails', async () => {
    const { workout } = await completeActiveSet('bench');
    const before = await snapshotWorkout(workout.id);
    const failure = vi
      .spyOn(db.personalRecords, 'bulkPut')
      .mockRejectedValueOnce(new Error('injected lifecycle reconciliation failure'));

    try {
      await expect(discardWorkout(workout.id)).rejects.toThrow(
        'injected lifecycle reconciliation failure',
      );
    } finally {
      failure.mockRestore();
    }

    expect(await snapshotWorkout(workout.id)).toStrictEqual(before);
  });

  it('rolls back exercise removal and records when reconciliation fails', async () => {
    const { workout, row } = await completeActiveSet('bench');
    const before = await snapshotWorkout(workout.id);
    const failure = vi
      .spyOn(db.personalRecords, 'bulkPut')
      .mockRejectedValueOnce(new Error('injected exercise reconciliation failure'));

    try {
      await expect(removeWorkoutExercise(row.id)).rejects.toThrow(
        'injected exercise reconciliation failure',
      );
    } finally {
      failure.mockRestore();
    }

    expect(await snapshotWorkout(workout.id)).toStrictEqual(before);
  });

  it('reconciles an archived set value edit', async () => {
    await db.exercises.put(exercise('bench'));
    const incumbent = await seedWorkout({
      exerciseId: 'bench',
      performedAt: day(1),
      sets: [[100, 5]],
    });
    const corrected = await seedWorkout({
      exerciseId: 'bench',
      performedAt: day(2),
      sets: [[110, 5]],
    });
    await reconcileRecordsForExercises(['bench'], FORMULA);
    const detail = (await getArchivedWorkoutDetail(corrected.id))!;
    const row = detail.exercises[0]!;

    await saveArchivedWorkout({
      workoutId: corrected.id,
      name: corrected.name,
      startedAt: corrected.startedAt,
      durationSeconds: corrected.durationSeconds,
      exercises: [
        {
          id: row.row.id,
          exerciseId: row.row.exerciseId,
          supersetGroup: row.row.supersetGroup,
          restSeconds: row.row.restSeconds,
          sets: [{ id: row.sets[0]!.id, setType: 'normal', side: 'both', weight: 90, reps: 5 }],
        },
      ],
    });

    expect(incumbent.id).not.toBe(corrected.id);
    await expectExactProjection(['bench']);
  });

  it('reconciles both old and new exercises after an archived exercise edit', async () => {
    await db.exercises.bulkPut([exercise('bench'), exercise('squat')]);
    const workout = await seedWorkout({
      exerciseId: 'bench',
      performedAt: day(1),
      sets: [[100, 5]],
    });
    await reconcileRecordsForExercises(['bench'], FORMULA);
    const detail = (await getArchivedWorkoutDetail(workout.id))!;
    const row = detail.exercises[0]!;

    await saveArchivedWorkout({
      workoutId: workout.id,
      name: workout.name,
      startedAt: workout.startedAt,
      durationSeconds: workout.durationSeconds,
      exercises: [
        {
          id: row.row.id,
          exerciseId: 'squat',
          supersetGroup: row.row.supersetGroup,
          restSeconds: row.row.restSeconds,
          sets: [{ id: row.sets[0]!.id, setType: 'normal', side: 'both', weight: 140, reps: 5 }],
        },
      ],
    });

    await expectExactProjection(['bench', 'squat']);
  });

  it('reconciles chronology after archived set order changes', async () => {
    await db.exercises.put(exercise('bench'));
    const workout = await seedWorkout({
      exerciseId: 'bench',
      performedAt: day(1),
      sets: [
        [100, 5],
        [110, 5],
      ],
    });
    await reconcileRecordsForExercises(['bench'], FORMULA);
    const detail = (await getArchivedWorkoutDetail(workout.id))!;
    const row = detail.exercises[0]!;

    await saveArchivedWorkout({
      workoutId: workout.id,
      name: workout.name,
      startedAt: workout.startedAt,
      durationSeconds: workout.durationSeconds,
      exercises: [
        {
          id: row.row.id,
          exerciseId: row.row.exerciseId,
          supersetGroup: row.row.supersetGroup,
          restSeconds: row.row.restSeconds,
          sets: [...row.sets].reverse().map((set) => ({
            id: set.id,
            setType: set.setType,
            side: set.side,
            weight: set.weight,
            reps: set.reps,
          })),
        },
      ],
    });

    await expectExactProjection(['bench']);
  });

  it('reconciles after an archived set stops being a working set', async () => {
    await db.exercises.put(exercise('bench'));
    await seedWorkout({ exerciseId: 'bench', performedAt: day(1), sets: [[100, 5]] });
    const corrected = await seedWorkout({
      exerciseId: 'bench',
      performedAt: day(2),
      sets: [[110, 5]],
    });
    await reconcileRecordsForExercises(['bench'], FORMULA);
    const detail = (await getArchivedWorkoutDetail(corrected.id))!;
    const row = detail.exercises[0]!;

    await saveArchivedWorkout({
      workoutId: corrected.id,
      name: corrected.name,
      startedAt: corrected.startedAt,
      durationSeconds: corrected.durationSeconds,
      exercises: [
        {
          id: row.row.id,
          exerciseId: row.row.exerciseId,
          supersetGroup: row.row.supersetGroup,
          restSeconds: row.row.restSeconds,
          sets: [{ id: row.sets[0]!.id, setType: 'warmup', side: 'both', weight: 110, reps: 5 }],
        },
      ],
    });

    await expectExactProjection(['bench']);
  });

  it('reconciles after deleting an archived workout', async () => {
    await db.exercises.put(exercise('bench'));
    await seedWorkout({ exerciseId: 'bench', performedAt: day(1), sets: [[100, 5]] });
    const removed = await seedWorkout({
      exerciseId: 'bench',
      performedAt: day(2),
      sets: [[110, 5]],
    });
    await reconcileRecordsForExercises(['bench'], FORMULA);

    await deleteArchivedWorkout(removed.id);

    await expectExactProjection(['bench']);
  });

  it('rolls back archive sources and records when reconciliation fails', async () => {
    await db.exercises.put(exercise('bench'));
    const workout = await seedWorkout({
      exerciseId: 'bench',
      performedAt: day(1),
      sets: [[110, 5]],
    });
    await reconcileRecordsForExercises(['bench'], FORMULA);
    const detail = (await getArchivedWorkoutDetail(workout.id))!;
    const row = detail.exercises[0]!;
    const before = await snapshotWorkout(workout.id);
    const failure = vi
      .spyOn(db.personalRecords, 'bulkPut')
      .mockRejectedValueOnce(new Error('injected archive reconciliation failure'));

    try {
      await expect(
        saveArchivedWorkout({
          workoutId: workout.id,
          name: workout.name,
          startedAt: workout.startedAt,
          durationSeconds: workout.durationSeconds,
          exercises: [
            {
              id: row.row.id,
              exerciseId: row.row.exerciseId,
              supersetGroup: row.row.supersetGroup,
              restSeconds: row.row.restSeconds,
              sets: [{ id: row.sets[0]!.id, setType: 'normal', side: 'both', weight: 90, reps: 5 }],
            },
          ],
        }),
      ).rejects.toThrow('injected archive reconciliation failure');
    } finally {
      failure.mockRestore();
    }

    expect(await snapshotWorkout(workout.id)).toStrictEqual(before);
  });
});
