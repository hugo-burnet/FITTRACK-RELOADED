import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { newEntity } from '@/data/repositories/base';
import type { Exercise, Workout, WorkoutExercise, WorkoutSet } from '@/data/types';
import { resetDb } from '@/test/resetDb';
import { evaluateCoachForWorkout, finalizeCoachForWorkout } from './coachEvaluate';
import { listRecommendationsForExercise } from './coachRecommendations';
import { finishWorkout } from './workoutLifecycle';

const exercise: Exercise = {
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

function seedSession(id: string, startedAt: number, reps: number, weight: number): Promise<void> {
  const workout: Workout = {
    ...newEntity<Workout>({
      routineId: '',
      name: 'Test',
      status: 'completed',
      startedAt,
      endedAt: startedAt + 3_600_000,
      durationSeconds: 3_600,
    }),
    id,
  };
  const row: WorkoutExercise = {
    ...newEntity<WorkoutExercise>({
      workoutId: id,
      exerciseId: exercise.id,
      order: 0,
      supersetGroup: 0,
      restSeconds: 120,
      exerciseName: exercise.name,
      exerciseMeasurementType: exercise.measurementType,
      exerciseEquipment: exercise.equipment,
    }),
    id: `${id}-row`,
  };
  const sets: WorkoutSet[] = [0, 1, 2].map((order) => ({
    ...newEntity<WorkoutSet>({
      workoutExerciseId: row.id,
      exerciseId: exercise.id,
      workoutId: id,
      order,
      setType: 'normal',
      side: 'both',
      weight,
      reps,
      // Plancher à 5 : ces séances sont des séries de 5. Le laisser à 8 en
      // ferait deux échecs consécutifs à la même charge, donc un signal
      // `range_missed` légitime — mais ce n'est pas ce que ce test observe.
      targetReps: 5,
      targetRepsMax: 12,
      isCompleted: 1,
      performedAt: startedAt + order * 120_000,
    }),
    id: `${id}-set-${order}`,
  }));

  return db.transaction('rw', db.workouts, db.workoutExercises, db.workoutSets, async () => {
    await db.workouts.add(workout);
    await db.workoutExercises.add(row);
    await db.workoutSets.bulkAdd(sets);
  });
}

describe('evaluateCoachForWorkout', () => {
  beforeEach(async () => {
    await resetDb();
    await db.exercises.add(exercise);
  });

  it('proposes the next load when the active session completes the range', async () => {
    const startedAt = Date.UTC(2026, 7, 10, 10);
    const workout: Workout = {
      ...newEntity<Workout>({
        routineId: '',
        name: 'Live',
        status: 'active',
        startedAt,
        endedAt: 0,
        durationSeconds: 0,
      }),
      id: 'live',
    };
    const row: WorkoutExercise = {
      ...newEntity<WorkoutExercise>({
        workoutId: workout.id,
        exerciseId: exercise.id,
        order: 0,
        supersetGroup: 0,
        restSeconds: 90,
        exerciseName: exercise.name,
        exerciseMeasurementType: exercise.measurementType,
        exerciseEquipment: exercise.equipment,
      }),
      id: 'live-row',
    };
    await db.workouts.add(workout);
    await db.workoutExercises.add(row);
    await db.workoutSets.bulkAdd(
      [0, 1, 2].map((order) => ({
        ...newEntity<WorkoutSet>({
          workoutExerciseId: row.id,
          exerciseId: exercise.id,
          workoutId: workout.id,
          order,
          setType: 'normal',
          side: 'both',
          weight: 100,
          reps: 12,
          targetReps: 8,
          targetRepsMax: 12,
          isCompleted: 1,
          performedAt: startedAt + order * 90_000,
        }),
        id: `live-set-${order}`,
      })),
    );

    const signals = await evaluateCoachForWorkout(workout.id);
    expect(signals).toEqual([
      expect.objectContaining({
        code: 'range_completed',
        exerciseId: 'bench',
        nextLoadKg: 102.5,
      }),
    ]);
  });

  it('persists recommendations on finalize and skips a deload plateau false positive', async () => {
    await seedSession('w1', Date.UTC(2026, 7, 1), 5, 100);
    await seedSession('w2', Date.UTC(2026, 7, 4), 5, 100);

    const startedAt = Date.UTC(2026, 7, 8, 10);
    const workout: Workout = {
      ...newEntity<Workout>({
        routineId: '',
        name: 'Deload week',
        status: 'active',
        startedAt,
        endedAt: 0,
        durationSeconds: 0,
        deloadPercent: 80,
      }),
      id: 'deload',
    };
    const row: WorkoutExercise = {
      ...newEntity<WorkoutExercise>({
        workoutId: workout.id,
        exerciseId: exercise.id,
        order: 0,
        supersetGroup: 0,
        restSeconds: 90,
        exerciseName: exercise.name,
        exerciseMeasurementType: exercise.measurementType,
      }),
      id: 'deload-row',
    };
    await db.workouts.add(workout);
    await db.workoutExercises.add(row);
    await db.workoutSets.add({
      ...newEntity<WorkoutSet>({
        workoutExerciseId: row.id,
        exerciseId: exercise.id,
        workoutId: workout.id,
        order: 0,
        setType: 'normal',
        side: 'both',
        weight: 80,
        reps: 8,
        targetReps: 8,
        targetRepsMax: 12,
        isCompleted: 1,
        performedAt: startedAt,
      }),
      id: 'deload-set',
    });

    await finishWorkout(workout.id);
    const signals = await finalizeCoachForWorkout(workout.id);
    expect(signals.filter((signal) => signal.code === 'plateau')).toEqual([]);

    // No range completed either (deload + missed top of range).
    expect(await listRecommendationsForExercise('bench')).toEqual([]);
  });
});
