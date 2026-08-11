import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { resolveExerciseIdentity } from '@/lib/exerciseSnapshot';
import { resetDb } from '@/test/resetDb';
import type { BodyMeasurement, Exercise, Workout, WorkoutExercise, WorkoutSet } from '@/data/types';
import { newEntity } from './base';
import {
  getCompletedSetRecordSources,
  listRecordSourcesForExercises,
} from './recordSources';

const at = (minutes: number): number => 1_700_000_000_000 + minutes * 60_000;

const exercise = (id: string): Exercise => ({
  ...newEntity<Exercise>({
    name: 'Tractions de catalogue',
    primaryMuscle: 'lats',
    secondaryMuscles: [],
    equipment: 'bodyweight',
    measurementType: 'weight_reps',
    bodyweightLoadFactor: 0.5,
    isCustom: 0,
    isUnilateral: 0,
  }),
  id,
});

const workout = (id: string, status: Workout['status'], deletedAt = 0): Workout => ({
  ...newEntity<Workout>({
    routineId: '',
    name: id,
    status,
    startedAt: at(0),
    endedAt: status === 'active' ? 0 : at(60),
    durationSeconds: status === 'active' ? 0 : 3600,
  }),
  id,
  deletedAt,
});

const workoutExercise = (
  id: string,
  workoutId: string,
  exerciseId: string,
  order: number,
): WorkoutExercise => ({
  ...newEntity<WorkoutExercise>({
    workoutId,
    exerciseId,
    order,
    supersetGroup: 0,
    restSeconds: 120,
    exerciseName: 'Tractions archiv\u00e9es',
    exerciseMeasurementType: 'reps_only',
    exercisePrimaryMuscle: 'lats',
    exerciseEquipment: 'bodyweight',
    exerciseBodyweightLoadFactor: 0.75,
  }),
  id,
});

const workoutSet = (
  id: string,
  row: WorkoutExercise,
  values: Partial<WorkoutSet> = {},
): WorkoutSet => ({
  ...newEntity<WorkoutSet>({
    workoutExerciseId: row.id,
    exerciseId: row.exerciseId,
    workoutId: row.workoutId,
    order: 0,
    setType: 'normal',
    side: 'both',
    weight: 10,
    reps: 8,
    isCompleted: 1,
    performedAt: at(1),
  }),
  id,
  ...values,
});

const bodyWeight = (value: number, measuredAt: number): BodyMeasurement =>
  newEntity<BodyMeasurement>({
    type: 'body_weight',
    value,
    unit: 'kg',
    measuredAt,
  });

describe('record projection sources', () => {
  beforeEach(resetDb);

  it('assembles only live working history from snapshots with deterministic session tonnage', async () => {
    const movement = exercise('exercise');
    const completed = workout('completed', 'completed');
    const active = workout('active', 'active');
    const discarded = workout('discarded', 'discarded');
    const deleted = workout('deleted', 'completed', at(2));
    const completedRow = workoutExercise('completed-row', completed.id, movement.id, 4);
    const activeRow = workoutExercise('active-row', active.id, movement.id, 1);
    const discardedRow = workoutExercise('discarded-row', discarded.id, movement.id, 0);
    const deletedRow = workoutExercise('deleted-row', deleted.id, movement.id, 0);
    const completedSet = workoutSet('completed-set', completedRow, { order: 1, performedAt: at(2) });
    const lastWorkingSet = workoutSet('last-working-set', completedRow, {
      order: 3,
      weight: 20,
      reps: 5,
      performedAt: at(4),
    });
    const rows = [completedRow, activeRow, discardedRow, deletedRow];
    const sets = [
      completedSet,
      workoutSet('warmup-set', completedRow, { order: 0, setType: 'warmup', performedAt: at(1) }),
      lastWorkingSet,
      workoutSet('incomplete-set', completedRow, { order: 4, isCompleted: 0, performedAt: 0 }),
      workoutSet('deleted-set', completedRow, { order: 5, deletedAt: at(5), performedAt: at(5) }),
      workoutSet('active-set', activeRow, { order: 0, weight: 30, reps: 4, performedAt: at(3) }),
      workoutSet('discarded-set', discardedRow, { performedAt: at(3) }),
      workoutSet('workout-deleted-set', deletedRow, { performedAt: at(3) }),
    ];

    await db.transaction(
      'rw',
      db.exercises,
      db.workouts,
      db.workoutExercises,
      db.workoutSets,
      db.bodyMeasurements,
      async () => {
        await db.exercises.add(movement);
        await db.workouts.bulkAdd([completed, active, discarded, deleted]);
        await db.workoutExercises.bulkAdd(rows);
        await db.workoutSets.bulkAdd(sets);
        await db.bodyMeasurements.bulkAdd([bodyWeight(80, at(-20)), bodyWeight(75, at(10))]);
      },
    );
    await db.exercises.update(movement.id, {
      name: 'Tractions renomm\u00e9es',
      measurementType: 'weight_reps',
      bodyweightLoadFactor: 0.25,
    });

    const sources = await listRecordSourcesForExercises([movement.id]);
    const again = await listRecordSourcesForExercises([movement.id]);
    const setSources = sources.filter((source) => source.workoutSetId !== undefined);
    const completedSession = sources.find(
      (source) => source.workoutId === completed.id && source.sessionTonnage !== undefined,
    );

    expect(sources).toEqual(again);
    expect(setSources.map((source) => source.workoutSetId)).toEqual([
      completedSet.id,
      'active-set',
      lastWorkingSet.id,
    ]);
    expect(setSources.map((source) => source.measurementType)).toEqual([
      'reps_only',
      'reps_only',
      'reps_only',
    ]);
    expect(completedSession).toMatchObject({
      workoutId: completed.id,
      exerciseId: movement.id,
      measurementType: 'reps_only',
      achievedAt: lastWorkingSet.performedAt,
      exerciseOrder: completedRow.order,
      setOrder: lastWorkingSet.order,
      sessionTonnage: 960,
    });
    expect(completedSession).not.toHaveProperty('workoutSetId');
    expect(completedSession).not.toHaveProperty('set');
    expect(completedSession).not.toHaveProperty('exerciseName');
    expect(resolveExerciseIdentity(completedRow, undefined).name).toBe('Tractions archiv\u00e9es');
  });

  it('returns the completed set and current session source in the full-assembly shapes', async () => {
    const movement = exercise('exercise');
    const currentWorkout = workout('active', 'active');
    const row = workoutExercise('row', currentWorkout.id, movement.id, 2);
    const firstSet = workoutSet('first', row, { order: 0, performedAt: at(1) });
    const completedSet = workoutSet('completed', row, { order: 1, weight: 15, reps: 6, performedAt: at(2) });

    await db.transaction('rw', db.exercises, db.workouts, db.workoutExercises, db.workoutSets, async () => {
      await db.exercises.add(movement);
      await db.workouts.add(currentWorkout);
      await db.workoutExercises.add(row);
      await db.workoutSets.bulkAdd([firstSet, completedSet]);
    });

    const full = await listRecordSourcesForExercises([movement.id]);
    const incremental = await getCompletedSetRecordSources(completedSet.id);

    expect(incremental).toEqual(
      full.filter(
        (source) =>
          source.workoutSetId === completedSet.id ||
          (source.workoutId === currentWorkout.id && source.sessionTonnage !== undefined),
      ),
    );
  });

  it('returns nothing when the requested set is not a completed working set', async () => {
    const movement = exercise('exercise');
    const currentWorkout = workout('active', 'active');
    const row = workoutExercise('row', currentWorkout.id, movement.id, 2);
    const completedSet = workoutSet('completed', row, { performedAt: at(1) });
    const warmupSet = workoutSet('warmup', row, {
      order: 1,
      setType: 'warmup',
      performedAt: at(2),
    });

    await db.transaction('rw', db.exercises, db.workouts, db.workoutExercises, db.workoutSets, async () => {
      await db.exercises.add(movement);
      await db.workouts.add(currentWorkout);
      await db.workoutExercises.add(row);
      await db.workoutSets.bulkAdd([completedSet, warmupSet]);
    });

    await expect(getCompletedSetRecordSources(warmupSet.id)).resolves.toEqual([]);
  });
});
