import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/data/db';
import { newEntity } from '@/data/repositories/base';
import {
  PERSONAL_RECORDS_PROJECTION_VERSION,
  isRecordProjectionCurrent,
} from '@/data/repositories/personalRecords';
import * as personalRecordsRepository from '@/data/repositories/personalRecords';
import * as seedRepository from '@/data/seed/seedDatabase';
import type { Exercise, Workout, WorkoutExercise, WorkoutSet } from '@/data/types';
import { resetDb } from '@/test/resetDb';
import { initializePersistentData } from './initialize';

async function seedRecordSource(): Promise<void> {
  const exercise = newEntity<Exercise>({
    name: 'Développé couché',
    primaryMuscle: 'chest',
    secondaryMuscles: [],
    equipment: 'barbell',
    measurementType: 'weight_reps',
    isCustom: 1,
    isUnilateral: 0,
  });
  const workout = newEntity<Workout>({
    routineId: '',
    name: 'Upper',
    status: 'completed',
    startedAt: 1_000,
    endedAt: 2_000,
    durationSeconds: 1,
    startedTimezoneOffsetMinutes: 0,
  });
  const row = newEntity<WorkoutExercise>({
    workoutId: workout.id,
    exerciseId: exercise.id,
    order: 0,
    supersetGroup: 0,
    restSeconds: 120,
    exerciseName: exercise.name,
    exerciseMeasurementType: exercise.measurementType,
    exercisePrimaryMuscle: exercise.primaryMuscle,
    exerciseEquipment: exercise.equipment,
  });
  const set = newEntity<WorkoutSet>({
    workoutExerciseId: row.id,
    exerciseId: exercise.id,
    workoutId: workout.id,
    order: 0,
    setType: 'normal',
    side: 'both',
    weight: 100,
    reps: 5,
    isCompleted: 1,
    performedAt: 1_500,
  });

  await db.transaction(
    'rw',
    db.exercises,
    db.workouts,
    db.workoutExercises,
    db.workoutSets,
    async () => {
      await db.exercises.add(exercise);
      await db.workouts.add(workout);
      await db.workoutExercises.add(row);
      await db.workoutSets.add(set);
    },
  );
}

describe('initializePersistentData', () => {
  beforeEach(resetDb);
  afterEach(() => vi.restoreAllMocks());

  it('seeds before checking the record projection', async () => {
    const order: string[] = [];
    vi.spyOn(seedRepository, 'seedDatabase').mockImplementation(async () => {
      order.push('seed');
    });
    vi.spyOn(personalRecordsRepository, 'ensureRecordProjection').mockImplementation(async () => {
      order.push('records');
      return 'ready';
    });

    await expect(initializePersistentData()).resolves.toEqual({ recordProjection: 'ready' });
    expect(order).toEqual(['seed', 'records']);
  });

  it('rebuilds an absent projection version once, then skips at the current version', async () => {
    await seedRecordSource();

    await expect(initializePersistentData()).resolves.toEqual({ recordProjection: 'rebuilt' });
    expect(await db.personalRecords.count()).toBeGreaterThan(0);
    expect(await isRecordProjectionCurrent()).toBe(true);

    await expect(initializePersistentData()).resolves.toEqual({ recordProjection: 'ready' });
    expect((await db.settings.get('personalRecordsProjectionVersion'))?.value).toBe(
      PERSONAL_RECORDS_PROJECTION_VERSION,
    );
  });

  it('keeps seed failure on the fatal boot path', async () => {
    const failure = new Error('seed failed');
    vi.spyOn(seedRepository, 'seedDatabase').mockRejectedValueOnce(failure);
    const ensure = vi.spyOn(personalRecordsRepository, 'ensureRecordProjection');

    await expect(initializePersistentData()).rejects.toBe(failure);
    expect(ensure).not.toHaveBeenCalled();
  });

  it('mounts with a stale projection and leaves its version retryable after rebuild failure', async () => {
    await seedRecordSource();
    await db.settings.put({ key: 'personalRecordsProjectionVersion', value: 0, updatedAt: 1 });
    vi.spyOn(db.personalRecords, 'bulkPut').mockRejectedValueOnce(new Error('rebuild failed'));

    await expect(initializePersistentData()).resolves.toEqual({ recordProjection: 'stale' });
    expect((await db.settings.get('personalRecordsProjectionVersion'))?.value).toBe(0);
  });
});
