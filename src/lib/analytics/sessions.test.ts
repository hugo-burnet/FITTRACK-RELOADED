import { describe, expect, it } from 'vitest';
import type { Exercise, Workout, WorkoutExercise, WorkoutSet } from '@/data/types';
import type { ExportSource } from '@/lib/export/types';
import { toAnalyticsSessions } from './sessions';

const workout = (values: Partial<Workout>): Workout => ({
  id: 'w1',
  createdAt: 0,
  updatedAt: 0,
  deletedAt: 0,
  routineId: '',
  name: 'Upper A',
  status: 'completed',
  startedAt: 1_000,
  endedAt: 2_000,
  durationSeconds: 1_000,
  ...values,
});

const row = (values: Partial<WorkoutExercise>): WorkoutExercise => ({
  id: 'we1',
  createdAt: 0,
  updatedAt: 0,
  deletedAt: 0,
  workoutId: 'w1',
  exerciseId: 'ex1',
  order: 0,
  supersetGroup: 0,
  restSeconds: 120,
  ...values,
});

const exercise = (values: Partial<Exercise>): Exercise => ({
  id: 'ex1',
  createdAt: 0,
  updatedAt: 0,
  deletedAt: 0,
  name: 'Développé couché',
  primaryMuscle: 'chest',
  secondaryMuscles: [],
  equipment: 'barbell',
  measurementType: 'weight_reps',
  isCustom: 0,
  isUnilateral: 0,
  ...values,
});

const set = (values: Partial<WorkoutSet>): WorkoutSet => ({
  id: `s-${Math.random()}`,
  createdAt: 0,
  updatedAt: 0,
  deletedAt: 0,
  workoutExerciseId: 'we1',
  exerciseId: 'ex1',
  workoutId: 'w1',
  order: 0,
  setType: 'normal',
  side: 'both',
  isCompleted: 1,
  performedAt: 1,
  ...values,
});

describe('toAnalyticsSessions', () => {
  it('date une séance par son début, pas par sa première série', () => {
    // L’import Hevy interpole les heures des séries : la première n’est pas le début.
    const sources: ExportSource[] = [
      {
        workout: workout({ startedAt: 5_000 }),
        exercises: [
          { row: row({}), exercise: exercise({}), sets: [set({ performedAt: 9_999 })] },
        ],
      },
    ];

    expect(toAnalyticsSessions(sources)[0]!.startedAt).toBe(5_000);
  });

  it('lit le type de mesure de l’instantané, pas celui de la bibliothèque', () => {
    // Les deux se contredisent EXPRÈS : deux valeurs concordantes ne pourraient
    // pas dire laquelle a été lue.
    const sources: ExportSource[] = [
      {
        workout: workout({}),
        exercises: [
          {
            row: row({ exerciseMeasurementType: 'time_only' }),
            exercise: exercise({ measurementType: 'weight_reps' }),
            sets: [set({ durationSeconds: 45 })],
          },
        ],
      },
    ];

    expect(toAnalyticsSessions(sources)[0]!.measurementType).toBe('time_only');
  });

  it('retombe sur la bibliothèque quand la ligne ne porte pas d’instantané', () => {
    const sources: ExportSource[] = [
      {
        workout: workout({}),
        exercises: [{ row: row({}), exercise: exercise({ measurementType: 'reps_only' }), sets: [] }],
      },
    ];

    expect(toAnalyticsSessions(sources)[0]!.measurementType).toBe('reps_only');
  });

  it('ne rend aucun type quand ni la ligne ni la bibliothèque n’en portent', () => {
    const sources: ExportSource[] = [
      { workout: workout({}), exercises: [{ row: row({}), exercise: undefined, sets: [] }] },
    ];

    expect(toAnalyticsSessions(sources)[0]!.measurementType).toBeUndefined();
  });

  it('réunit en une séance un exercice fait deux fois dans la même séance', () => {
    // Sinon un exercice repris en fin de séance produirait deux points au même
    // instant, et la courbe se replierait sur elle-même.
    const sources: ExportSource[] = [
      {
        workout: workout({}),
        exercises: [
          { row: row({ id: 'we1' }), exercise: exercise({}), sets: [set({ weight: 80 })] },
          { row: row({ id: 'we2', order: 4 }), exercise: exercise({}), sets: [set({ weight: 100 })] },
        ],
      },
    ];

    const sessions = toAnalyticsSessions(sources);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.sets).toHaveLength(2);
  });

  it('garde l’ordre chronologique et une séance sans série', () => {
    const sources: ExportSource[] = [
      { workout: workout({ id: 'a', startedAt: 1 }), exercises: [] },
      {
        workout: workout({ id: 'b', startedAt: 2 }),
        exercises: [{ row: row({}), exercise: exercise({}), sets: [set({ weight: 60 })] }],
      },
    ];

    expect(toAnalyticsSessions(sources).map((session) => session.workoutId)).toEqual(['a', 'b']);
  });
});
