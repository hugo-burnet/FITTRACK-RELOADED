import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import Dexie from 'dexie';
import { calculateDeloadWeight } from '@/lib/deload';
import { db } from '@/data/db';
import { resetDb } from '@/test/resetDb';
import { buildBackup, restoreBackup } from './backup';
import { createRoutine } from './routines';
import { createCustomExercise, updateExercise } from './exercises';
import { startWorkout, finishWorkout } from './workoutLifecycle';
import { addWorkoutExercise } from './workoutExercises';
import { completeSet } from './workoutSets';
import { getWorkoutDetail } from './workoutDetail';
import { applyWorkoutDeload } from './workoutDeload';
beforeEach(async () => {
  await resetDb();
  localStorage.clear();
});
afterEach(() => vi.restoreAllMocks());
it('preserves the database and preferences when preference restoration fails', async () => {
  await createRoutine('Backup routine');
  localStorage.setItem('fittrack:theme', 'light');
  const backup = await buildBackup();
  const local = await createRoutine('Recent local routine');
  localStorage.setItem('fittrack:theme', 'dark');
  const original = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
    if (key === 'fittrack:theme' && value === 'light')
      throw new DOMException('Quota full', 'QuotaExceededError');
    return original.call(this, key, value);
  });
  await expect(restoreBackup(backup)).rejects.toThrow();
  expect(await db.routines.get(local.id)).toEqual(local);
  expect(localStorage.getItem('fittrack:theme')).toBe('dark');
});
it('does not propose assistance as added weight after a measurement edit', async () => {
  const exercise = await createCustomExercise({
    name: 'Tractions',
    primaryMuscle: 'lats',
    secondaryMuscles: [],
    equipment: 'machine',
    measurementType: 'assisted_weight_reps',
    isUnilateral: 0,
    bodyweightLoadFactor: 1,
  });
  const old = await startWorkout('', 'Assisted');
  await addWorkoutExercise(old.id, exercise.id);
  const detail = (await getWorkoutDetail(old.id))!;
  await completeSet(detail.exercises[0]!.sets[0]!.id, { weight: 30, reps: 10 });
  await finishWorkout(old.id);
  await updateExercise(exercise.id, { measurementType: 'reps_only' });
  const current = await startWorkout('', 'Added');
  await addWorkoutExercise(current.id, exercise.id);
  const result = (await getWorkoutDetail(current.id))!.exercises[0]!;
  expect(result.identity?.measurementType).toBe('reps_only');
  expect(result.previous).toEqual([]);
  expect(await applyWorkoutDeload(current.id, 'Deload')).toBeNull();
  // Editing the library again must not change the active session snapshot.
  await updateExercise(exercise.id, { measurementType: 'assisted_weight_reps' });
  expect((await getWorkoutDetail(current.id))!.exercises[0]!.previous).toEqual([]);
  expect(result.sets[0]?.targetWeight).toBeUndefined();
});

it('reduces small loads instead of rounding up or leaving them unchanged', () => {
  expect(calculateDeloadWeight(2)).toBe(1.6);
  expect(calculateDeloadWeight(5)).toBe(4);
});

it('restores preferences if the database aborts after they are written', async () => {
  await createRoutine('Backup routine');
  localStorage.setItem('fittrack:theme', 'light');
  const backup = await buildBackup();
  const local = await createRoutine('Recent local routine');
  localStorage.setItem('fittrack:theme', 'dark');
  const original = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
    original.call(this, key, value);
    if (key === 'fittrack:theme' && value === 'light') Dexie.currentTransaction?.abort();
  });
  await expect(restoreBackup(backup)).rejects.toThrow();
  expect(await db.routines.get(local.id)).toEqual(local);
  expect(localStorage.getItem('fittrack:theme')).toBe('dark');
});
