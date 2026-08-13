import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { newEntity } from '@/data/repositories/base';
import type { Exercise, Workout, WorkoutExercise, WorkoutSet } from '@/data/types';
import { resetDb } from '@/test/resetDb';
import { evaluateCoachForWorkout, finalizeCoachForWorkout } from './coachEvaluate';
import {
  listRecommendationsForExercise,
  recordCoachSignals,
} from './coachRecommendations';
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
        code: 'range_ceiling_reached',
        exerciseId: 'bench',
        nextLoadKg: 102.5,
      }),
    ]);
  });

  it('does not emit a numeric proposal for a programmed workout', async () => {
    const startedAt = Date.UTC(2026, 7, 10, 10);
    const workout: Workout = {
      ...newEntity<Workout>({
        routineId: '',
        name: 'Programmed',
        status: 'active',
        startedAt,
        endedAt: 0,
        durationSeconds: 0,
        programId: 'program',
      }),
      id: 'programmed',
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
      id: 'programmed-row',
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
        id: `programmed-set-${order}`,
      })),
    );

    expect(await evaluateCoachForWorkout(workout.id)).toEqual([]);
  });

  it('ne marque pas suivie une ancienne charge Coach reprise par un programme', async () => {
    const startedAt = Date.UTC(2026, 7, 10, 10);
    const workout: Workout = {
      ...newEntity<Workout>({
        routineId: '',
        name: 'Programmed',
        status: 'active',
        startedAt,
        endedAt: 0,
        durationSeconds: 0,
        programId: 'program',
      }),
      id: 'programmed-stale-load',
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
      id: 'programmed-stale-load-row',
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
        weight: 102.5,
        reps: 8,
        targetReps: 8,
        targetRepsMax: 12,
        isCompleted: 1,
        performedAt: startedAt,
      }),
      id: 'programmed-stale-load-set',
    });
    await recordCoachSignals(
      [
        {
          exerciseId: exercise.id,
          code: 'range_completed',
          severity: 1,
          nextLoadKg: 102.5,
          evidence: [{ label: 'next_load_kg', value: 102.5 }],
        },
      ],
      { recommendedAt: startedAt - 1 },
    );

    await finishWorkout(workout.id);
    await finalizeCoachForWorkout(workout.id);

    expect((await listRecommendationsForExercise(exercise.id))[0]).toMatchObject({
      status: 'pending',
      nextLoadKg: 102.5,
    });
  });

  it('keeps a rep-drop observation when a stronger program-owned signal also fires', async () => {
    const previousAt = Date.UTC(2026, 7, 4, 10);
    const currentAt = Date.UTC(2026, 7, 8, 10);
    const previous: Workout = {
      ...newEntity<Workout>({
        routineId: '',
        name: 'Previous',
        status: 'completed',
        startedAt: previousAt,
        endedAt: previousAt + 3_600_000,
        durationSeconds: 3_600,
      }),
      id: 'previous-miss',
    };
    const current: Workout = {
      ...newEntity<Workout>({
        routineId: '',
        name: 'Programmed',
        status: 'active',
        startedAt: currentAt,
        endedAt: 0,
        durationSeconds: 0,
        programId: 'program',
      }),
      id: 'programmed-drop',
    };
    const rows: WorkoutExercise[] = [previous, current].map((workout) => ({
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
      id: `${workout.id}-row`,
    }));
    const previousSets: WorkoutSet[] = [0, 1].map((order) => ({
      ...newEntity<WorkoutSet>({
        workoutExerciseId: rows[0]!.id,
        exerciseId: exercise.id,
        workoutId: previous.id,
        order,
        setType: 'normal',
        side: 'both',
        weight: 100,
        reps: 6,
        targetReps: 8,
        targetRepsMax: 12,
        isCompleted: 1,
        performedAt: previousAt + order * 90_000,
      }),
      id: `previous-miss-set-${order}`,
    }));
    const currentSets: WorkoutSet[] = [12, 5].map((reps, order) => ({
      ...newEntity<WorkoutSet>({
        workoutExerciseId: rows[1]!.id,
        exerciseId: exercise.id,
        workoutId: current.id,
        order,
        setType: 'normal',
        side: 'both',
        weight: 100,
        reps,
        targetReps: 8,
        targetRepsMax: 12,
        isCompleted: 1,
        performedAt: currentAt + order * 240_000,
      }),
      id: `programmed-drop-set-${order}`,
    }));
    await db.transaction('rw', db.workouts, db.workoutExercises, db.workoutSets, async () => {
      await db.workouts.bulkAdd([previous, current]);
      await db.workoutExercises.bulkAdd(rows);
      await db.workoutSets.bulkAdd([...previousSets, ...currentSets]);
    });

    expect(await evaluateCoachForWorkout(current.id)).toEqual([
      expect.objectContaining({ code: 'intra_session_drop', exerciseId: exercise.id }),
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
        programIsDeload: 1,
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
