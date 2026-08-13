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

const week = (overrides: Partial<Pick<ProgramWeek, 'prescriptionKind' | 'prescriptionValue'>> = {}) => ({
  prescriptionKind: 'percent_1rm' as const,
  prescriptionValue: 77,
  ...overrides,
});

describe('projectProgramPrescription', () => {
  it('projects compatible working sets from the exercise 1RM onto its own load grid', () => {
    const result = projectProgramPrescription({
      week: week(),
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
          targetWeight: 77.5,
          targetReps: 5,
        },
      ],
      warnings: [],
    });
  });

  it('keeps all warm-up targets untouched under a percentage prescription', () => {
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
  });

  it('falls back to routine targets and deduplicates unsupported warnings per exercise', () => {
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
    expect(result.warnings).toEqual([
      { code: 'unsupported_measurement', exerciseId: 'plank' },
    ]);
  });

  it('falls back to routine targets and warns once when an assisted exercise cannot be projected', () => {
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
    expect(result.warnings).toEqual([
      { code: 'assistance_not_supported', exerciseId: 'assisted-pull-up' },
    ]);
  });

  it('falls back to routine targets and warns once when a compatible exercise has no 1RM', () => {
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
    expect(result.warnings).toEqual([{ code: 'missing_one_rep_max', exerciseId: 'bench' }]);
  });

  it('writes programmed RPE into targets only and leaves every other target untouched', () => {
    const result = projectProgramPrescription({
      week: week({ prescriptionKind: 'target_rpe', prescriptionValue: 8.5 }),
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
        { routineSetId: 'work', targetWeight: 100, targetReps: 5, targetRpe: 8.5 },
      ],
      warnings: [],
    });
  });
});
