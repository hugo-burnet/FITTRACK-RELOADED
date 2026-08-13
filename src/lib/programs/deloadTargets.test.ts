import { describe, expect, it } from 'vitest';
import type { Exercise, RoutineSet } from '@/data/types';
import { previousLoad, resolveLoadIncrementKg } from '@/lib/loadIncrement';
import { createDeloadTargets } from './deloadTargets';

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

describe('createDeloadTargets', () => {
  it('ignores loadIndex (60 and 90 produce the same projection)', () => {
    const exercises = [
      {
        exercise: exercise(),
        sets: [
          routineSet({ id: 'a', order: 0, targetWeight: 80, targetReps: 8, targetRepsMax: 12 }),
          routineSet({ id: 'b', order: 1, targetWeight: 80, targetReps: 8, targetRepsMax: 12 }),
          routineSet({ id: 'c', order: 2, targetWeight: 80, targetReps: 8, targetRepsMax: 12 }),
        ],
      },
    ];

    expect(
      createDeloadTargets({ week: { phase: 'deload', loadIndex: 60 }, exercises }),
    ).toEqual(
      createDeloadTargets({ week: { phase: 'deload', loadIndex: 90 }, exercises }),
    );
  });

  it('reduces 3 working sets 80×8–12 to 2 sets with double previousLoad and floor reps', () => {
    const movement = exercise();
    const increment = resolveLoadIncrementKg(movement);
    const deloadWeight = previousLoad(
      previousLoad(80, increment, 'weight_reps'),
      increment,
      'weight_reps',
    );

    const result = createDeloadTargets({
      week: { phase: 'deload', loadIndex: 60 },
      exercises: [
        {
          exercise: movement,
          sets: [
            routineSet({
              id: 'w1',
              order: 0,
              targetWeight: 80,
              targetReps: 8,
              targetRepsMax: 12,
            }),
            routineSet({
              id: 'w2',
              order: 1,
              targetWeight: 80,
              targetReps: 8,
              targetRepsMax: 12,
            }),
            routineSet({
              id: 'w3',
              order: 2,
              targetWeight: 80,
              targetReps: 8,
              targetRepsMax: 12,
            }),
          ],
        },
      ],
    });

    expect(result.sets).toEqual([
      { routineSetId: 'w1', targetWeight: deloadWeight, targetReps: 8 },
      { routineSetId: 'w2', targetWeight: deloadWeight, targetReps: 8 },
    ]);
    expect(deloadWeight).toBe(75);
  });

  it('keeps warm-ups untouched and still drops one working set', () => {
    const movement = exercise({ loadIncrementKg: 2.5 });
    const result = createDeloadTargets({
      week: { phase: 'deload', loadIndex: 60 },
      exercises: [
        {
          exercise: movement,
          sets: [
            routineSet({
              id: 'wu',
              order: 0,
              setType: 'warmup',
              targetWeight: 40,
              targetReps: 8,
              targetRepsMax: 10,
              targetRpe: 5,
            }),
            routineSet({
              id: 'w1',
              order: 1,
              targetWeight: 100,
              targetReps: 5,
              targetRepsMax: 8,
              targetRpe: 7,
            }),
            routineSet({
              id: 'w2',
              order: 2,
              targetWeight: 100,
              targetReps: 5,
              targetRepsMax: 8,
            }),
          ],
        },
      ],
    });

    expect(result.sets).toEqual([
      {
        routineSetId: 'wu',
        targetWeight: 40,
        targetReps: 8,
        targetRepsMax: 10,
        targetRpe: 5,
      },
      {
        routineSetId: 'w1',
        targetWeight: 95,
        targetReps: 5,
        targetRpe: 7,
      },
    ]);
  });

  it('keeps at least one working set when the routine only has one', () => {
    const result = createDeloadTargets({
      week: { phase: 'deload', loadIndex: 60 },
      exercises: [
        {
          exercise: exercise(),
          sets: [
            routineSet({
              id: 'only',
              targetWeight: 80,
              targetReps: 8,
              targetRepsMax: 12,
            }),
          ],
        },
      ],
    });

    expect(result.sets).toHaveLength(1);
    expect(result.sets[0]).toMatchObject({
      routineSetId: 'only',
      targetWeight: 75,
      targetReps: 8,
    });
    expect(result.sets[0]?.targetRepsMax).toBeUndefined();
  });

  it('does not invent a weight when the routine target has none', () => {
    const result = createDeloadTargets({
      week: { phase: 'deload', loadIndex: 60 },
      exercises: [
        {
          exercise: exercise({ id: 'plank', measurementType: 'time_only' }),
          sets: [
            routineSet({ id: 'a', order: 0, targetDurationSeconds: 45 }),
            routineSet({ id: 'b', order: 1, targetDurationSeconds: 45 }),
          ],
        },
      ],
    });

    expect(result.sets).toEqual([
      { routineSetId: 'a', targetDurationSeconds: 45 },
    ]);
  });
});
