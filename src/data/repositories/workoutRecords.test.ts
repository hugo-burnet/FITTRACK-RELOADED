import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/data/db';
import type { Exercise, PersonalRecord, WorkoutSet } from '@/data/types';
import { resetDb } from '@/test/resetDb';
import { createCustomExercise } from './exercises';
import { reconcileRecordsForExercises } from './recordReconciliation';
import {
  addSet,
  addWorkoutExercise,
  completeSet,
  deleteSet,
  restoreSet,
  startWorkout,
  uncompleteSet,
  updateSetType,
  updateSetValues,
} from './workouts';

type Movement = {
  exercise: Exercise;
  firstSet: WorkoutSet;
  workoutId: string;
  workoutExerciseId: string;
};

async function startMovement(
  measurementType: Exercise['measurementType'] = 'weight_reps',
  name = 'Développé couché',
): Promise<Movement> {
  const exercise = await createCustomExercise({
    name,
    primaryMuscle: 'chest',
    secondaryMuscles: [],
    equipment: 'barbell',
    measurementType,
    isUnilateral: 0,
  });
  const workout = await startWorkout('', 'Séance records');
  const row = await addWorkoutExercise(workout.id, exercise.id);
  const firstSet = await db.workoutSets.where('workoutExerciseId').equals(row.id).first();
  if (firstSet === undefined) throw new Error('Première série absente');
  return { exercise, firstSet, workoutId: workout.id, workoutExerciseId: row.id };
}

async function aliveRecords(exerciseId: string): Promise<PersonalRecord[]> {
  return db.personalRecords
    .where('exerciseId')
    .equals(exerciseId)
    .filter((record) => record.deletedAt === 0)
    .toArray();
}

async function establishRecords(...exerciseIds: string[]): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.exercises,
      db.workouts,
      db.workoutExercises,
      db.workoutSets,
      db.bodyMeasurements,
      db.personalRecords,
    ],
    async () => reconcileRecordsForExercises(exerciseIds, 'epley'),
  );
}

function idsByType(records: readonly PersonalRecord[]): Map<string, string> {
  return new Map(records.map((record) => [record.type, record.id]));
}

describe('live workout record writes', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await resetDb();
  });

  it('persists every initial record in the completion transaction', async () => {
    const { exercise, firstSet, workoutId } = await startMovement();

    await completeSet(firstSet.id, { weight: 100, reps: 5 });

    expect((await db.workoutSets.get(firstSet.id))?.isCompleted).toBe(1);
    expect((await aliveRecords(exercise.id)).map((record) => record.type).sort()).toEqual([
      'best_1rm',
      'max_volume_session',
      'max_volume_set',
      'max_weight',
    ]);
    expect((await aliveRecords(exercise.id)).every((record) => record.workoutId === workoutId)).toBe(
      true,
    );
  });

  it('persists every category beaten by a strict improvement', async () => {
    const { exercise, firstSet, workoutExerciseId } = await startMovement();
    await completeSet(firstSet.id, { weight: 100, reps: 5 });
    const improved = await addSet(workoutExerciseId);

    await completeSet(improved.id, { weight: 110, reps: 6 });

    expect(
      (await aliveRecords(exercise.id))
        .filter((record) => record.workoutSetId === improved.id)
        .map((record) => record.type)
        .sort(),
    ).toEqual(['best_1rm', 'max_volume_set', 'max_weight']);
  });

  it('does not add an event when a set only ties the incumbent', async () => {
    const { exercise, firstSet, workoutExerciseId } = await startMovement();
    await completeSet(firstSet.id, { weight: 100, reps: 5 });
    const before = await aliveRecords(exercise.id);
    const tied = await addSet(workoutExerciseId);

    await completeSet(tied.id, { weight: 100, reps: 5 });

    const after = await aliveRecords(exercise.id);
    expect(after).toHaveLength(before.length);
    expect(after.some((record) => record.workoutSetId === tied.id)).toBe(false);
  });

  it('does not persist records for a completed warm-up', async () => {
    const { exercise, firstSet } = await startMovement();
    await updateSetType(firstSet.id, 'warmup');

    await completeSet(firstSet.id, { weight: 100, reps: 5 });

    expect(await aliveRecords(exercise.id)).toEqual([]);
  });

  it('does not estimate a 1RM above the supported repetition range', async () => {
    const { exercise, firstSet } = await startMovement();

    await completeSet(firstSet.id, { weight: 60, reps: 13 });

    expect((await aliveRecords(exercise.id)).some((record) => record.type === 'best_1rm')).toBe(
      false,
    );
  });

  it('rolls completion values and timestamps back when record persistence fails', async () => {
    const { firstSet } = await startMovement();
    vi.spyOn(db.personalRecords, 'bulkPut').mockRejectedValueOnce(new Error('record write failed'));

    await expect(completeSet(firstSet.id, { weight: 100, reps: 5 })).rejects.toThrow(
      'record write failed',
    );

    const stored = await db.workoutSets.get(firstSet.id);
    expect(stored).toMatchObject({
      isCompleted: 0,
      performedAt: 0,
    });
    expect(stored?.weight).toBeUndefined();
    expect(stored?.reps).toBeUndefined();
    expect(await db.personalRecords.count()).toBe(0);
  });

  it('reconciles records after editing the values of a completed set', async () => {
    const { exercise, firstSet } = await startMovement();
    await completeSet(firstSet.id, { weight: 100, reps: 5 });
    await establishRecords(exercise.id);

    await updateSetValues(firstSet.id, { weight: 80 });

    const maxWeight = (await aliveRecords(exercise.id)).find(
      (record) => record.type === 'max_weight',
    );
    expect(maxWeight?.value).toBe(80);
  });

  it('reconciles records after changing the type of a completed set', async () => {
    const { exercise, firstSet } = await startMovement();
    await completeSet(firstSet.id, { weight: 100, reps: 5 });
    await establishRecords(exercise.id);

    await updateSetType(firstSet.id, 'warmup');

    expect(await aliveRecords(exercise.id)).toEqual([]);
  });

  it('reconciles records after uncompleting a set', async () => {
    const { exercise, firstSet } = await startMovement();
    await completeSet(firstSet.id, { weight: 100, reps: 5 });
    await establishRecords(exercise.id);

    await uncompleteSet(firstSet.id);

    expect(await aliveRecords(exercise.id)).toEqual([]);
  });

  it('reconciles records after deleting and restoring a completed set', async () => {
    const { exercise, firstSet } = await startMovement();
    await completeSet(firstSet.id, { weight: 100, reps: 5 });
    await establishRecords(exercise.id);
    const originalIds = idsByType(await aliveRecords(exercise.id));

    await deleteSet(firstSet.id);
    expect(await aliveRecords(exercise.id)).toEqual([]);

    await restoreSet(firstSet.id);
    expect(idsByType(await aliveRecords(exercise.id))).toEqual(originalIds);
  });

  it("does not rewrite another exercise's record identities during reconciliation", async () => {
    const bench = await startMovement();
    await completeSet(bench.firstSet.id, { weight: 100, reps: 5 });
    const rowExercise = await createCustomExercise({
      name: 'Rowing barre',
      primaryMuscle: 'upper_back',
      secondaryMuscles: [],
      equipment: 'barbell',
      measurementType: 'weight_reps',
      isUnilateral: 0,
    });
    const row = await addWorkoutExercise(bench.workoutId, rowExercise.id);
    const rowSet = await db.workoutSets.where('workoutExerciseId').equals(row.id).first();
    if (rowSet === undefined) throw new Error('Série de rowing absente');
    await completeSet(rowSet.id, { weight: 70, reps: 8 });
    await establishRecords(bench.exercise.id, rowExercise.id);
    const rowIds = idsByType(await aliveRecords(rowExercise.id));

    await updateSetValues(bench.firstSet.id, { weight: 90 });

    expect(idsByType(await aliveRecords(rowExercise.id))).toEqual(rowIds);
  });

  it('updates one workout-scoped session-tonnage row as sets complete', async () => {
    const { exercise, firstSet, workoutExerciseId, workoutId } = await startMovement();
    await completeSet(firstSet.id, { weight: 50, reps: 5 });
    const initial = (await aliveRecords(exercise.id)).find(
      (record) => record.type === 'max_volume_session',
    );
    const second = await addSet(workoutExerciseId);

    await completeSet(second.id, { weight: 60, reps: 5 });

    const sessions = (await aliveRecords(exercise.id)).filter(
      (record) => record.type === 'max_volume_session',
    );
    expect(sessions).toEqual([
      expect.objectContaining({ id: initial?.id, workoutId, value: 550 }),
    ]);
    expect(sessions[0]?.workoutSetId).toBeUndefined();
  });

  it('keeps an already completed set idempotent and reconciles changed values', async () => {
    const { exercise, firstSet } = await startMovement();
    await completeSet(firstSet.id, { weight: 100, reps: 5 });
    await db.workoutSets.update(firstSet.id, { performedAt: 123_456 });
    await establishRecords(exercise.id);

    await completeSet(firstSet.id, { weight: 105, reps: 5 });

    expect((await db.workoutSets.get(firstSet.id))?.performedAt).toBe(123_456);
    expect(
      (await aliveRecords(exercise.id)).find((record) => record.type === 'max_weight')?.value,
    ).toBe(105);
  });

  it('keeps incomplete draft edits off the record projection path', async () => {
    const { firstSet } = await startMovement();
    const recordWrite = vi.spyOn(db.personalRecords, 'bulkPut');

    await updateSetValues(firstSet.id, { weight: 80 });

    expect(recordWrite).not.toHaveBeenCalled();
  });
});
