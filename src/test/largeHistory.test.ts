import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { resetDb } from '@/test/resetDb';
import {
  seedLargeHistory,
  type LargeHistoryProfile,
} from '@/test/largeHistory';

const SMALL_PROFILE: LargeHistoryProfile = {
  workoutCount: 3,
  exercisesPerWorkout: 2,
  setsPerExercise: 2,
  startedAt: Date.UTC(2020, 0, 6, 18),
  workoutSpacingMs: 36 * 60 * 60 * 1_000,
};

async function snapshotIdsAndTimes(): Promise<{
  workoutIds: string[];
  workoutTimes: number[];
  rowIds: string[];
  setIds: string[];
}> {
  const [workouts, rows, sets] = await Promise.all([
    db.workouts.orderBy('startedAt').toArray(),
    db.workoutExercises.toArray(),
    db.workoutSets.toArray(),
  ]);

  return {
    workoutIds: workouts.map((workout) => workout.id),
    workoutTimes: workouts.map((workout) => workout.startedAt),
    rowIds: rows.map((row) => row.id).sort(),
    setIds: sets.map((set) => set.id).sort(),
  };
}

describe('seedLargeHistory', () => {
  beforeEach(resetDb);

  it('creates the requested graph with valid parent relationships', async () => {
    const counts = await seedLargeHistory(SMALL_PROFILE);

    expect(counts).toEqual({
      exercises: 2,
      workouts: 3,
      workoutExercises: 6,
      workoutSets: 12,
    });
    await expect(db.exercises.count()).resolves.toBe(2);
    await expect(db.workouts.count()).resolves.toBe(3);
    await expect(db.workoutExercises.count()).resolves.toBe(6);
    await expect(db.workoutSets.count()).resolves.toBe(12);

    const workouts = new Set((await db.workouts.toArray()).map((row) => row.id));
    const rows = await db.workoutExercises.toArray();
    const rowIds = new Set(rows.map((row) => row.id));
    const sets = await db.workoutSets.toArray();

    expect(rows.every((row) => workouts.has(row.workoutId))).toBe(true);
    expect(sets.every((set) => workouts.has(set.workoutId))).toBe(true);
    expect(sets.every((set) => rowIds.has(set.workoutExerciseId))).toBe(true);
    expect(sets.every((set) => set.isCompleted === 1)).toBe(true);
  });

  it('recreates the same ids, ordering, and timestamps after reset', async () => {
    await seedLargeHistory(SMALL_PROFILE);
    const first = await snapshotIdsAndTimes();

    await resetDb();
    await seedLargeHistory(SMALL_PROFILE);

    expect(await snapshotIdsAndTimes()).toEqual(first);
  });
});
