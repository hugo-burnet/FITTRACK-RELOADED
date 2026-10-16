import { describe, expect, it } from 'vitest';
import type { WorkoutExercise, WorkoutSet } from '@/data/types';
import { rowWithoutExerciseIdentity, setForReplacement } from './exerciseReplacement';

const set = (overrides: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id: 's1',
  createdAt: 1,
  updatedAt: 1,
  deletedAt: 0,
  workoutExerciseId: 'row-1',
  exerciseId: 'bench',
  workoutId: 'w1',
  order: 2,
  setType: 'normal',
  side: 'both',
  isCompleted: 0,
  performedAt: 0,
  ...overrides,
});

describe('setForReplacement', () => {
  it('efface ce qui a été saisi pour l’ancien exercice', () => {
    const next = setForReplacement(
      set({
        weight: 100,
        reps: 8,
        durationSeconds: 30,
        distanceMeters: 500,
        rpe: 8,
        unilateralSecondSideStartsAt: 123,
      }),
      'weight_reps',
    );
    expect(next.weight).toBeUndefined();
    expect(next.reps).toBeUndefined();
    expect(next.durationSeconds).toBeUndefined();
    expect(next.distanceMeters).toBeUndefined();
    expect(next.rpe).toBeUndefined();
    expect(next.unilateralSecondSideStartsAt).toBeUndefined();
  });

  it('ne reporte jamais une charge cible : elle dit un exercice, pas une place', () => {
    const next = setForReplacement(set({ targetWeight: 100 }), 'weight_reps');
    expect(next.targetWeight).toBeUndefined();
  });

  it('garde la fourchette de répétitions quand le nouvel exercice se compte en répétitions', () => {
    const next = setForReplacement(set({ targetReps: 8, targetRepsMax: 12 }), 'weight_reps');
    expect(next).toMatchObject({ targetReps: 8, targetRepsMax: 12 });
    expect(
      setForReplacement(set({ targetReps: 8, targetRepsMax: 12 }), 'assisted_weight_reps'),
    ).toMatchObject({ targetReps: 8, targetRepsMax: 12 });
    expect(setForReplacement(set({ targetReps: 15 }), 'reps_only')).toMatchObject({
      targetReps: 15,
    });
  });

  it('abandonne les répétitions visées quand le nouvel exercice se chronomètre', () => {
    const next = setForReplacement(
      set({ targetReps: 8, targetRepsMax: 12, targetDurationSeconds: 45 }),
      'time_only',
    );
    expect(next.targetReps).toBeUndefined();
    expect(next.targetRepsMax).toBeUndefined();
    // La durée visée vaut pour un maintien comme pour l'autre.
    expect(next.targetDurationSeconds).toBe(45);
  });

  it('abandonne durée et distance visées quand le nouvel exercice ne les mesure pas', () => {
    const next = setForReplacement(
      set({ targetDurationSeconds: 45, targetDistanceMeters: 500 }),
      'weight_reps',
    );
    expect(next.targetDurationSeconds).toBeUndefined();
    expect(next.targetDistanceMeters).toBeUndefined();
    expect(
      setForReplacement(set({ targetDistanceMeters: 500 }), 'distance_time').targetDistanceMeters,
    ).toBe(500);
  });

  it('garde la place de la série : rang, type, côté, effort visé', () => {
    const next = setForReplacement(
      set({ order: 3, setType: 'warmup', side: 'both', targetRpe: 8 }),
      'weight_reps',
    );
    expect(next).toMatchObject({ order: 3, setType: 'warmup', side: 'both', targetRpe: 8 });
  });

  it('rend une série à faire, même si on la lui donnait validée', () => {
    const next = setForReplacement(set({ isCompleted: 1, performedAt: 999 }), 'weight_reps');
    expect(next.isCompleted).toBe(0);
    expect(next.performedAt).toBe(0);
  });

  it('ne modifie pas la série reçue', () => {
    const original = set({ weight: 100, targetWeight: 100 });
    setForReplacement(original, 'weight_reps');
    expect(original.weight).toBe(100);
    expect(original.targetWeight).toBe(100);
  });
});

describe('rowWithoutExerciseIdentity', () => {
  const row: WorkoutExercise = {
    id: 'row-1',
    createdAt: 1,
    updatedAt: 1,
    deletedAt: 0,
    workoutId: 'w1',
    exerciseId: 'bench',
    order: 2,
    supersetGroup: 1,
    notes: 'tempo 3-1-1',
    restSeconds: 150,
    repSeconds: 4,
    exerciseName: 'Développé couché',
    exerciseMeasurementType: 'weight_reps',
    exercisePrimaryMuscle: 'chest',
    exerciseSecondaryMuscles: ['triceps'],
    exerciseEquipment: 'barbell',
    exerciseBodyweightLoadFactor: 0.65,
    exerciseIsUnilateral: 0,
    routineExerciseId: 'routine-row-1',
  };

  it('retire tout ce que l’ancien exercice disait de lui, jusqu’à sa cadence et à sa ligne de routine', () => {
    const next = rowWithoutExerciseIdentity(row);
    for (const key of [
      'exerciseName',
      'exerciseMeasurementType',
      'exercisePrimaryMuscle',
      'exerciseSecondaryMuscles',
      'exerciseEquipment',
      'exerciseBodyweightLoadFactor',
      'exerciseIsUnilateral',
      'repSeconds',
      'routineExerciseId',
    ]) {
      expect(next, key).not.toHaveProperty(key);
    }
  });

  it('garde la place de la ligne dans la séance, ses notes et son superset', () => {
    expect(rowWithoutExerciseIdentity(row)).toMatchObject({
      id: 'row-1',
      workoutId: 'w1',
      order: 2,
      supersetGroup: 1,
      notes: 'tempo 3-1-1',
    });
  });

  it('ne modifie pas la ligne reçue', () => {
    rowWithoutExerciseIdentity(row);
    expect(row.exerciseName).toBe('Développé couché');
    expect(row.repSeconds).toBe(4);
  });
});
