import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { newEntity } from '@/data/repositories/base';
import type { Exercise, MeasurementType, Workout, WorkoutExercise, WorkoutSet } from '@/data/types';
import { resetDb } from '@/test/resetDb';
import { applyCoachObjective } from './coachApply';

const bench: Exercise = {
  ...newEntity<Exercise>({
    name: 'Développé couché',
    primaryMuscle: 'chest',
    secondaryMuscles: [],
    equipment: 'barbell',
    measurementType: 'weight_reps',
    isCustom: 0,
    isUnilateral: 0,
  }),
  id: 'bench',
};

async function seedRow(measurementType: MeasurementType = 'weight_reps'): Promise<string> {
  const workout: Workout = {
    ...newEntity<Workout>({
      routineId: '',
      name: 'Live',
      status: 'active',
      startedAt: Date.UTC(2026, 7, 12, 10),
      endedAt: 0,
      durationSeconds: 0,
    }),
    id: 'live',
  };
  const row: WorkoutExercise = {
    ...newEntity<WorkoutExercise>({
      workoutId: workout.id,
      exerciseId: bench.id,
      order: 0,
      supersetGroup: 0,
      restSeconds: 120,
      exerciseName: bench.name,
      exerciseMeasurementType: measurementType,
      exerciseEquipment: bench.equipment,
    }),
    id: 'live-row',
  };
  await db.workouts.add(workout);
  await db.workoutExercises.add(row);
  return row.id;
}

function set(id: string, order: number, fields: Partial<WorkoutSet>): WorkoutSet {
  return {
    ...newEntity<WorkoutSet>({
      workoutExerciseId: 'live-row',
      exerciseId: bench.id,
      workoutId: 'live',
      order,
      setType: 'normal',
      side: 'both',
      reps: 10,
      isCompleted: 0,
      performedAt: 0,
      ...fields,
    }),
    id,
  };
}

describe('applyCoachObjective', () => {
  beforeEach(async () => {
    await resetDb();
    await db.exercises.add(bench);
  });

  it('writes a target on a set where nothing has been typed', async () => {
    const rowId = await seedRow();
    await db.workoutSets.add(set('s0', 0, {}));

    expect(await applyCoachObjective(rowId, 50)).toBe(1);
    const stored = await db.workoutSets.get('s0');
    expect(stored?.targetWeight).toBe(50);
    // A target, not a value: the grid still shows an empty field to fill in.
    expect(stored?.weight).toBeUndefined();
  });

  it('overwrites a value already typed, because that is what the tap means', async () => {
    const rowId = await seedRow();
    await db.workoutSets.add(set('s0', 0, { weight: 47.5 }));

    expect(await applyCoachObjective(rowId, 50)).toBe(1);
    expect((await db.workoutSets.get('s0'))?.weight).toBe(50);
  });

  it('never rewrites a set already validated', async () => {
    const rowId = await seedRow();
    await db.workoutSets.bulkAdd([
      set('done', 0, { weight: 47.5, isCompleted: 1, performedAt: Date.UTC(2026, 7, 12, 10) }),
      set('todo', 1, { weight: 47.5 }),
    ]);

    expect(await applyCoachObjective(rowId, 50)).toBe(1);
    expect((await db.workoutSets.get('done'))?.weight).toBe(47.5);
    expect((await db.workoutSets.get('todo'))?.weight).toBe(50);
  });

  it('applies to an assistance machine, where progress means less weight', async () => {
    const rowId = await seedRow('assisted_weight_reps');
    await db.workoutSets.add(set('s0', 0, { weight: 50 }));

    expect(await applyCoachObjective(rowId, 45)).toBe(1);
    expect((await db.workoutSets.get('s0'))?.weight).toBe(45);
  });

  it('does nothing on an exercise with no weight field', async () => {
    const rowId = await seedRow('time_only');
    await db.workoutSets.add(set('s0', 0, {}));

    expect(await applyCoachObjective(rowId, 50)).toBe(0);
    expect((await db.workoutSets.get('s0'))?.targetWeight).toBeUndefined();
  });

  it('ignores a load that is not a usable number', async () => {
    const rowId = await seedRow();
    await db.workoutSets.add(set('s0', 0, {}));

    expect(await applyCoachObjective(rowId, Number.NaN)).toBe(0);
    expect((await db.workoutSets.get('s0'))?.targetWeight).toBeUndefined();
  });
});
