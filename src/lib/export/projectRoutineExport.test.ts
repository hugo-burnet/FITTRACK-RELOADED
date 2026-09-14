import { describe, expect, it } from 'vitest';
import type { Exercise, Routine, RoutineExercise, RoutineSet } from '@/data/types';
import { projectRoutineExport, type RoutineSource } from './projectRoutineExport';
import { DEFAULT_EXPORT_OPTIONS } from './types';

const stamps = { createdAt: 1, updatedAt: 1, deletedAt: 0 };

const EXERCISE: Exercise = {
  ...stamps,
  id: 'bench',
  name: 'Développé couché',
  primaryMuscle: 'chest',
  secondaryMuscles: [],
  equipment: 'barbell',
  measurementType: 'weight_reps',
  isCustom: 0,
  isUnilateral: 0,
};

const routine = (overrides: Partial<Routine> = {}): Routine => ({
  ...stamps,
  id: 'r1',
  name: 'Poussée A',
  folderId: '',
  order: 0,
  ...overrides,
});

const row = (overrides: Partial<RoutineExercise> = {}): RoutineExercise => ({
  ...stamps,
  id: 're1',
  routineId: 'r1',
  exerciseId: 'bench',
  order: 0,
  supersetGroup: 0,
  restSeconds: 0,
  notes: '',
  ...overrides,
});

const set = (overrides: Partial<RoutineSet> = {}): RoutineSet => ({
  ...stamps,
  id: 's1',
  routineExerciseId: 're1',
  order: 0,
  setType: 'normal',
  targetReps: 8,
  ...overrides,
});

const source = (overrides: Partial<RoutineSource> = {}): RoutineSource => ({
  routine: routine(),
  exercises: [{ row: row(), exercise: EXERCISE, sets: [set()] }],
  ...overrides,
});

const project = (sources: RoutineSource[], options = DEFAULT_EXPORT_OPTIONS) =>
  projectRoutineExport({ kind: 'routine', routineId: 'r1' }, sources, options, 1_757_750_400_000);

describe('projectRoutineExport', () => {
  it('décrit la routine, ses exercices et ses séries', () => {
    const data = project([source()]);

    expect(data.format).toBe('fittrack-routine-export');
    expect(data.routineCount).toBe(1);
    expect(data.routines[0]?.name).toBe('Poussée A');
    expect(data.routines[0]?.exercises[0]?.name).toBe('Développé couché');
    expect(data.routines[0]?.exercises[0]?.sets).toHaveLength(1);
  });

  it('range les routines, les exercices et les séries par leur ordre', () => {
    const data = project([
      source({ routine: routine({ id: 'second', name: 'B', order: 1 }) }),
      source({
        routine: routine({ id: 'first', name: 'A', order: 0 }),
        exercises: [
          { row: row({ id: 'late', order: 1 }), exercise: EXERCISE, sets: [] },
          {
            row: row({ id: 'early', order: 0 }),
            exercise: EXERCISE,
            sets: [set({ id: 'b', order: 1, targetReps: 5 }), set({ id: 'a', order: 0 })],
          },
        ],
      }),
    ]);

    expect(data.routines.map((one) => one.name)).toEqual(['A', 'B']);
    const first = data.routines[0];
    expect(first?.exercises[0]?.sets.map((one) => one.number)).toEqual([1, 2]);
    expect(first?.exercises[0]?.sets[0]?.targetReps).toBe(8);
  });

  it('laisse dehors ce qui est supprimé', () => {
    const data = project([
      source({ routine: routine({ id: 'gone', deletedAt: 5 }) }),
      source({
        exercises: [
          { row: row({ id: 'removed', deletedAt: 5 }), exercise: EXERCISE, sets: [] },
          {
            row: row(),
            exercise: EXERCISE,
            sets: [set(), set({ id: 'dead', order: 1, deletedAt: 5 })],
          },
        ],
      }),
    ]);

    expect(data.routineCount).toBe(1);
    expect(data.routines[0]?.exercises).toHaveLength(1);
    expect(data.routines[0]?.exercises[0]?.sets).toHaveLength(1);
  });

  it('garde les échauffements par défaut, et renumérote quand ils sautent', () => {
    const withWarmup = source({
      exercises: [
        {
          row: row(),
          exercise: EXERCISE,
          sets: [set({ id: 'w', order: 0, setType: 'warmup' }), set({ id: 'work', order: 1 })],
        },
      ],
    });

    expect(project([withWarmup]).routines[0]?.exercises[0]?.sets).toHaveLength(2);

    const without = project([withWarmup], { ...DEFAULT_EXPORT_OPTIONS, includeWarmups: false });
    const sets = without.routines[0]?.exercises[0]?.sets;
    // La série de travail devient la série 1 : le document ne doit pas parler
    // d'une « série 2 » qu'il ne contient pas.
    expect(sets).toHaveLength(1);
    expect(sets?.[0]?.number).toBe(1);
  });

  it('ne porte une note que s’il y en a une', () => {
    const blank = project([source()]).routines[0]?.exercises[0];
    expect(blank?.notes).toBeUndefined();

    const noted = project([
      source({ exercises: [{ row: row({ notes: 'Cran 3' }), exercise: EXERCISE, sets: [] }] }),
    ]);
    expect(noted.routines[0]?.exercises[0]?.notes).toBe('Cran 3');

    // Des espaces ne sont pas une consigne.
    const blanks = project([
      source({ exercises: [{ row: row({ notes: '   ' }), exercise: EXERCISE, sets: [] }] }),
    ]);
    expect(blanks.routines[0]?.exercises[0]?.notes).toBeUndefined();
  });

  it('n’invente rien pour un exercice sorti de la bibliothèque', () => {
    const data = project([
      source({ exercises: [{ row: row(), exercise: undefined, sets: [set()] }] }),
    ]);
    const exercise = data.routines[0]?.exercises[0];

    expect(exercise?.name).toBeUndefined();
    expect(exercise?.measurementType).toBeUndefined();
    // La ligne elle-même reste : elle a des séries, et elles sont prévues.
    expect(exercise?.sets).toHaveLength(1);
  });

  it('garde les identifiants hors du document, sauf demande explicite', () => {
    expect(project([source()]).routines[0]?.id).toBeUndefined();

    const withIds = project([source()], { ...DEFAULT_EXPORT_OPTIONS, includeIds: true });
    expect(withIds.routines[0]?.id).toBe('r1');
    expect(withIds.routines[0]?.exercises[0]?.id).toBe('bench');
  });
});
