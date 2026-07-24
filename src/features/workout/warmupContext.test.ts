import { describe, expect, it } from 'vitest';
import type { WorkoutExerciseDetail } from '@/data/repositories/workouts';
import type { Exercise, WorkoutExercise, WorkoutSet } from '@/data/types';
import { warmupContextFor } from './warmupContext';

const exercise = (overrides: Partial<Exercise> = {}): Exercise => ({
  id: 'exercise',
  name: 'Développé couché',
  primaryMuscle: 'chest',
  secondaryMuscles: [],
  equipment: 'barbell',
  measurementType: 'weight_reps',
  isCustom: 0,
  isUnilateral: 0,
  createdAt: 1,
  updatedAt: 1,
  deletedAt: 0,
  ...overrides,
});

const row: WorkoutExercise = {
  id: 'row',
  workoutId: 'workout',
  exerciseId: 'exercise',
  order: 0,
  supersetGroup: 0,
  restSeconds: 120,
  createdAt: 1,
  updatedAt: 1,
  deletedAt: 0,
};

const set = (overrides: Partial<WorkoutSet>): WorkoutSet => ({
  id: crypto.randomUUID(),
  workoutExerciseId: row.id,
  exerciseId: exercise().id,
  workoutId: row.workoutId,
  order: 0,
  setType: 'normal',
  side: 'both',
  isCompleted: 0,
  performedAt: 0,
  createdAt: 1,
  updatedAt: 1,
  deletedAt: 0,
  ...overrides,
});

const detail = (
  currentExercise: Exercise | undefined,
  sets: WorkoutSet[],
): WorkoutExerciseDetail => ({
  row,
  exercise: currentExercise,
  sets,
  previous: [],
});

describe('warmupContextFor', () => {
  it('prend la valeur réalisée de la première série de travail avant sa cible', () => {
    expect(
      warmupContextFor(
        detail(exercise(), [
          set({ setType: 'warmup', weight: 40, targetWeight: 45 }),
          set({ order: 1, weight: 102.5, targetWeight: 100 }),
          set({ order: 2, weight: 110 }),
        ]),
      ),
    ).toEqual({ targetWeightKg: 102.5, minimumWeightKg: 20 });
  });

  it('retombe sur la cible de la première série de travail', () => {
    expect(
      warmupContextFor(detail(exercise(), [set({ targetWeight: 100, targetReps: 5 })])),
    ).toEqual({ targetWeightKg: 100, minimumWeightKg: 20 });
  });

  it('laisse la cible vide quand aucune série de travail ne porte de charge', () => {
    expect(warmupContextFor(detail(exercise(), [set({})]))).toEqual({
      targetWeightKg: undefined,
      minimumWeightKg: 20,
    });
  });

  it('utilise zéro comme minimum pour une machine ou un haltère fixe', () => {
    expect(
      warmupContextFor(
        detail(exercise({ equipment: 'machine' }), [set({ targetWeight: 80 })]),
      ),
    ).toEqual({ targetWeightKg: 80, minimumWeightKg: 0 });
  });

  it.each(['reps_only', 'assisted_weight_reps', 'time_only', 'distance_time'] as const)(
    'n’offre pas le calculateur pour %s',
    (measurementType) => {
      expect(
        warmupContextFor(detail(exercise({ measurementType }), [set({ targetWeight: 20 })])),
      ).toBeNull();
    },
  );

  it('n’offre rien pour un exercice supprimé de la bibliothèque', () => {
    expect(warmupContextFor(detail(undefined, [set({ targetWeight: 100 })]))).toBeNull();
  });
});
