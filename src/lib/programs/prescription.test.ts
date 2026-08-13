import { describe, expect, it } from 'vitest';
import type { Exercise, ProgramWeek, RoutineSet } from '@/data/types';
import { projectProgramPrescription } from './prescription';

type ExerciseInput = Pick<
  Exercise,
  'id' | 'equipment' | 'measurementType' | 'loadIncrementKg'
>;

const exercise = (overrides: Partial<ExerciseInput> = {}): ExerciseInput => ({
  id: 'bench',
  equipment: 'barbell',
  measurementType: 'weight_reps',
  ...overrides,
});

const routineSet = (overrides: Partial<RoutineSet> = {}): RoutineSet => ({
  id: 'routine-set',
  routineExerciseId: 'routine-exercise',
  order: 0,
  setType: 'normal',
  createdAt: 0,
  updatedAt: 0,
  deletedAt: 0,
  ...overrides,
});

const week = (overrides: Partial<Pick<ProgramWeek, 'loadIndex' | 'phase'>> = {}) => ({
  loadIndex: 100,
  phase: 'construction' as const,
  ...overrides,
});

describe('projectProgramPrescription', () => {
  it('copies working-set routine targets as-is (identity; loadIndex is not a multiplier)', () => {
    const result = projectProgramPrescription({
      week: week({ loadIndex: 75 }),
      exercises: [
        {
          exercise: exercise({ loadIncrementKg: 1.25 }),
          sets: [routineSet({ targetWeight: 70, targetReps: 5 })],
        },
      ],
      oneRepMaxByExerciseId: new Map([['bench', 100]]),
    });

    expect(result).toEqual({
      sets: [
        {
          routineSetId: 'routine-set',
          targetWeight: 70,
          targetReps: 5,
        },
      ],
      warnings: [],
    });
  });

  it('keeps all warm-up targets untouched', () => {
    const warmup = routineSet({
      setType: 'warmup',
      targetWeight: 20,
      targetReps: 8,
      targetRepsMax: 10,
      targetDurationSeconds: 45,
      targetDistanceMeters: 100,
      targetRpe: 6,
    });

    const result = projectProgramPrescription({
      week: week(),
      exercises: [{ exercise: exercise(), sets: [warmup] }],
      oneRepMaxByExerciseId: new Map([['bench', 100]]),
    });

    expect(result.sets).toEqual([
      {
        routineSetId: 'routine-set',
        targetWeight: 20,
        targetReps: 8,
        targetRepsMax: 10,
        targetDurationSeconds: 45,
        targetDistanceMeters: 100,
        targetRpe: 6,
      },
    ]);
    expect(result.warnings).toEqual([]);
  });

  it('copies non-weight measurement targets in order without inventing warnings', () => {
    const result = projectProgramPrescription({
      week: week(),
      exercises: [
        {
          exercise: exercise({ id: 'plank', measurementType: 'time_only' }),
          sets: [
            routineSet({ id: 'later', order: 2, targetDurationSeconds: 45 }),
            routineSet({ id: 'first', order: 1, targetDurationSeconds: 30 }),
          ],
        },
      ],
      oneRepMaxByExerciseId: new Map(),
    });

    expect(result.sets).toEqual([
      { routineSetId: 'first', targetDurationSeconds: 30 },
      { routineSetId: 'later', targetDurationSeconds: 45 },
    ]);
    expect(result.warnings).toEqual([]);
  });

  it('copies assisted-exercise targets as-is without assistance warnings', () => {
    const result = projectProgramPrescription({
      week: week(),
      exercises: [
        {
          exercise: exercise({ id: 'assisted-pull-up', measurementType: 'assisted_weight_reps' }),
          sets: [
            routineSet({ id: 'first', targetWeight: 40 }),
            routineSet({ id: 'second', order: 1, targetWeight: 35 }),
          ],
        },
      ],
      oneRepMaxByExerciseId: new Map([['assisted-pull-up', 100]]),
    });

    expect(result.sets).toEqual([
      { routineSetId: 'first', targetWeight: 40 },
      { routineSetId: 'second', targetWeight: 35 },
    ]);
    expect(result.warnings).toEqual([]);
  });

  it('copies routine targets even when no 1RM exists and emits no missing-1RM warning', () => {
    const result = projectProgramPrescription({
      week: week(),
      exercises: [
        {
          exercise: exercise(),
          sets: [routineSet({ id: 'first', targetWeight: 70 }), routineSet({ id: 'second', order: 1 })],
        },
      ],
      oneRepMaxByExerciseId: new Map(),
    });

    expect(result.sets).toEqual([
      { routineSetId: 'first', targetWeight: 70 },
      { routineSetId: 'second' },
    ]);
    expect(result.warnings).toEqual([]);
  });

  it('copies routine RPE targets as-is and does not stamp week-level RPE', () => {
    const result = projectProgramPrescription({
      week: week({ loadIndex: 100, phase: 'construction' }),
      exercises: [
        {
          exercise: exercise({ id: 'squat' }),
          sets: [
            routineSet({ id: 'warmup', setType: 'warmup', targetWeight: 40, targetRpe: 5 }),
            routineSet({ id: 'work', order: 1, targetWeight: 100, targetReps: 5, targetRpe: 7 }),
          ],
        },
      ],
      oneRepMaxByExerciseId: new Map(),
    });

    expect(result).toEqual({
      sets: [
        { routineSetId: 'warmup', targetWeight: 40, targetRpe: 5 },
        { routineSetId: 'work', targetWeight: 100, targetReps: 5, targetRpe: 7 },
      ],
      warnings: [],
    });
  });

  it('delegates deload weeks to the deload recipe (not identity)', () => {
    const result = projectProgramPrescription({
      week: week({ loadIndex: 60, phase: 'deload' }),
      exercises: [
        {
          exercise: exercise(),
          sets: [
            routineSet({
              id: 'a',
              order: 0,
              targetWeight: 80,
              targetReps: 8,
              targetRepsMax: 12,
            }),
            routineSet({
              id: 'b',
              order: 1,
              targetWeight: 80,
              targetReps: 8,
              targetRepsMax: 12,
            }),
          ],
        },
      ],
      oneRepMaxByExerciseId: new Map(),
    });

    expect(result.sets).toEqual([
      { routineSetId: 'a', targetWeight: 75, targetReps: 8 },
    ]);
  });
});
