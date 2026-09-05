import { describe, expect, it } from 'vitest';
import type { WorkoutExerciseDetail } from '@/data/repositories/workouts';
import type { Exercise, WorkoutExercise, WorkoutSet } from '@/data/types';
import { resolveWorkoutExerciseIdentity } from '@/lib/exerciseSnapshot';
import { warmupOfferFor } from './warmupOffer';

const exercise = (overrides: Partial<Exercise> = {}): Exercise => ({
  id: 'exercise',
  name: 'Développé couché',
  primaryMuscle: 'chest',
  secondaryMuscles: [],
  equipment: 'machine',
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
  exerciseId: row.exerciseId,
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

/** La dernière fois : 20 kg × 10 puis 40 kg × 5, pour 60 kg de travail. */
const lastTime = (workingWeight = 60): WorkoutSet[] => [
  set({ setType: 'warmup', weight: 20, reps: 10, isCompleted: 1, performedAt: 1 }),
  set({ order: 1, setType: 'warmup', weight: 40, reps: 5, isCompleted: 1, performedAt: 2 }),
  set({ order: 2, weight: workingWeight, reps: 8, isCompleted: 1, performedAt: 3 }),
];

const detail = (sets: WorkoutSet[], previous: WorkoutSet[]): WorkoutExerciseDetail => ({
  row,
  exercise: exercise(),
  identity: resolveWorkoutExerciseIdentity(row, exercise()),
  sets,
  previous,
});

describe('warmupOfferFor', () => {
  it('repropose la montée de la dernière fois, aux poids du jour', () => {
    const offer = warmupOfferFor(detail([set({ targetWeight: 60, targetReps: 8 })], lastTime()));

    expect(offer?.suggestions).toEqual([
      { weightKg: 17.5, reps: 10 },
      { weightKg: 40, reps: 5 },
    ]);
    expect(offer?.changedLoad).toBe(false);
  });

  it('rapporte la montée à la charge du jour quand elle a changé', () => {
    // 33 % et 67 % de 80 kg, arrondis vers le bas au pas de 2,5.
    const offer = warmupOfferFor(detail([set({ targetWeight: 80, targetReps: 8 })], lastTime()));

    expect(offer?.suggestions).toEqual([
      { weightKg: 25, reps: 10 },
      { weightKg: 52.5, reps: 5 },
    ]);
    expect(offer?.changedLoad).toBe(true);
    expect(offer?.targetWeightKg).toBe(80);
  });

  it('ne propose rien quand la séance porte déjà un échauffement', () => {
    // Le cas de la routine qui prévoit sa propre montée : pas de doublon.
    const sets = [
      set({ setType: 'warmup', targetWeight: 30, targetReps: 8 }),
      set({ order: 1, targetWeight: 60, targetReps: 8 }),
    ];

    expect(warmupOfferFor(detail(sets, lastTime()))).toBeNull();
  });

  it('ne propose plus rien une fois la première série validée', () => {
    // Passé la première série, l'échauffement est derrière soi — et une reprise
    // de séance après un kill retombe exactement sur ce cas.
    const sets = [set({ targetWeight: 60, weight: 60, reps: 8, isCompleted: 1, performedAt: 9 })];

    expect(warmupOfferFor(detail(sets, lastTime()))).toBeNull();
  });

  it('ne propose rien sans historique d’échauffement', () => {
    const previous = [set({ weight: 60, reps: 8, isCompleted: 1, performedAt: 3 })];

    expect(warmupOfferFor(detail([set({ targetWeight: 60 })], previous))).toBeNull();
  });

  it('ne propose rien sans charge de travail pour aujourd’hui', () => {
    expect(warmupOfferFor(detail([set({ targetReps: 8 })], lastTime()))).toBeNull();
  });

  it('ne propose rien pour un exercice qui ne se charge pas en kilos', () => {
    const line: WorkoutExerciseDetail = {
      ...detail([set({ targetWeight: 60 })], lastTime()),
      exercise: exercise({ measurementType: 'reps_only' }),
    };

    expect(warmupOfferFor(line)).toBeNull();
  });
});
