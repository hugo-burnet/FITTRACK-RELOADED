import { describe, expect, it } from 'vitest';
import type { Exercise, MeasurementType, SetType, Workout, WorkoutExercise, WorkoutSet } from '@/data/types';
import { projectCoachExport } from './projectCoachExport';
import { DEFAULT_EXPORT_OPTIONS, type ExportSource } from './types';

const EXPORTED_AT = Date.UTC(2026, 6, 28, 9, 0, 0);
// 27 July 2026, 16:20 UTC — 18:20 on a Paris summer evening.
const STARTED_AT = Date.UTC(2026, 6, 27, 16, 20, 0);

function workout(overrides: Partial<Workout> = {}): Workout {
  return {
    id: 'w1',
    createdAt: STARTED_AT,
    updatedAt: STARTED_AT,
    deletedAt: 0,
    routineId: '',
    name: 'Upper A',
    status: 'completed',
    startedAt: STARTED_AT,
    endedAt: STARTED_AT + 4_320_000,
    durationSeconds: 4320,
    startedTimezoneOffsetMinutes: 120,
    ...overrides,
  };
}

function row(overrides: Partial<WorkoutExercise> = {}): WorkoutExercise {
  return {
    id: 'we1',
    createdAt: STARTED_AT,
    updatedAt: STARTED_AT,
    deletedAt: 0,
    workoutId: 'w1',
    exerciseId: 'e1',
    order: 0,
    supersetGroup: 0,
    restSeconds: 120,
    exerciseName: 'Développé couché',
    exerciseMeasurementType: 'weight_reps',
    exercisePrimaryMuscle: 'chest',
    exerciseEquipment: 'barbell',
    ...overrides,
  };
}

function exercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 'e1',
    createdAt: 0,
    updatedAt: 0,
    deletedAt: 0,
    name: 'Développé couché',
    primaryMuscle: 'chest',
    secondaryMuscles: ['triceps'],
    equipment: 'barbell',
    measurementType: 'weight_reps',
    isCustom: 0,
    isUnilateral: 0,
    ...overrides,
  };
}

let setSequence = 0;

function set(overrides: Partial<WorkoutSet> = {}): WorkoutSet {
  setSequence += 1;
  return {
    id: `s${setSequence}`,
    createdAt: STARTED_AT,
    updatedAt: STARTED_AT,
    deletedAt: 0,
    workoutExerciseId: 'we1',
    exerciseId: 'e1',
    workoutId: 'w1',
    order: 0,
    setType: 'normal',
    side: 'both',
    weight: 80,
    reps: 10,
    isCompleted: 1,
    performedAt: STARTED_AT + 60_000,
    ...overrides,
  };
}

const source = (overrides: Partial<ExportSource> = {}): ExportSource => ({
  workout: workout(),
  exercises: [{ row: row(), exercise: exercise(), sets: [set()] }],
  ...overrides,
});

const project = (sources: ExportSource[], options = DEFAULT_EXPORT_OPTIONS) =>
  projectCoachExport({ kind: 'all-history' }, sources, options, EXPORTED_AT);

describe('projectCoachExport — envelope', () => {
  it('declares its format and version', () => {
    const data = project([source()]);
    expect(data.format).toBe('fittrack-coach-export');
    expect(data.schemaVersion).toBe(1);
    expect(data.exportedAt).toBe('2026-07-28T09:00:00.000Z');
  });

  it('carries the scope it was asked for', () => {
    const scope = { kind: 'workout', workoutId: 'w1' } as const;
    expect(projectCoachExport(scope, [source()], DEFAULT_EXPORT_OPTIONS, EXPORTED_AT).scope).toEqual(
      scope,
    );
  });

  it('counts sessions and working sets, warm-ups excluded', () => {
    const data = project([
      source({
        exercises: [
          {
            row: row(),
            exercise: exercise(),
            sets: [
              set({ order: 0, setType: 'warmup' }),
              set({ order: 1 }),
              set({ order: 2, setType: 'dropset' }),
            ],
          },
        ],
      }),
    ]);

    expect(data.workoutCount).toBe(1);
    // The warm-up is exported, but it is not a working set.
    expect(data.workingSetCount).toBe(2);
    expect(data.workouts[0]?.exercises[0]?.sets).toHaveLength(3);
  });

  it('projects an empty history', () => {
    const data = project([]);
    expect(data.workouts).toEqual([]);
    expect(data.workoutCount).toBe(0);
    expect(data.workingSetCount).toBe(0);
  });

  it('keeps a session with no exercise, and an exercise with no set', () => {
    const data = project([
      source({ exercises: [] }),
      source({
        workout: workout({ id: 'w2' }),
        exercises: [{ row: row(), exercise: exercise(), sets: [] }],
      }),
    ]);

    expect(data.workouts).toHaveLength(2);
    expect(data.workouts[0]?.exercises).toEqual([]);
    expect(data.workouts[1]?.exercises[0]?.sets).toEqual([]);
  });
});

describe('projectCoachExport — totals', () => {
  it('counts tonnage only where the weight really is the load', () => {
    const data = project([
      source({
        exercises: [
          {
            row: row({ exerciseMeasurementType: 'assisted_weight_reps' }),
            exercise: exercise({ measurementType: 'assisted_weight_reps' }),
            sets: [set({ weight: 20, reps: 8 })],
          },
        ],
      }),
    ]);

    expect(data.workouts[0]?.totals.tonnage).toBe(0);
    expect(data.workouts[0]?.totals.totalReps).toBe(8);
    expect(data.workouts[0]?.totals.workingSets).toBe(1);
  });

  it('adds up the load of a barbell session', () => {
    const data = project([
      source({
        exercises: [
          {
            row: row(),
            exercise: exercise(),
            sets: [
              set({ order: 0, setType: 'warmup', weight: 40, reps: 12 }),
              set({ order: 1, weight: 80, reps: 10 }),
              set({ order: 2, weight: 80, reps: 9 }),
            ],
          },
        ],
      }),
    ]);

    // The warm-up counts in neither the tonnage nor the set count.
    expect(data.workouts[0]?.totals.tonnage).toBe(1520);
    expect(data.workouts[0]?.totals.workingSets).toBe(2);
  });

  it('keeps the totals of the whole session even when warm-ups are dropped', () => {
    const sources = [
      source({
        exercises: [
          {
            row: row(),
            exercise: exercise(),
            sets: [set({ order: 0, setType: 'warmup', weight: 40, reps: 12 }), set({ order: 1 })],
          },
        ],
      }),
    ];

    expect(project(sources).workouts[0]?.totals).toEqual(
      project(sources, { ...DEFAULT_EXPORT_OPTIONS, includeWarmups: false }).workouts[0]?.totals,
    );
  });
});

describe('projectCoachExport — dates', () => {
  it('places a session with its own recorded offset', () => {
    const data = project([source()]);
    expect(data.workouts[0]?.startedAt).toBe('2026-07-27T18:20:00+02:00');
    expect(data.workouts[0]?.localDate).toBe('2026-07-27');
    expect(data.workouts[0]?.timezoneOffsetMinutes).toBe(120);
  });

  it('does not read the phone when the session recorded an offset', () => {
    const data = project([
      source({ workout: workout({ startedTimezoneOffsetMinutes: -300 }) }),
    ]);
    expect(data.workouts[0]?.startedAt).toBe('2026-07-27T11:20:00-05:00');
    expect(data.workouts[0]?.localDate).toBe('2026-07-27');
  });

  it('falls back to the platform offset for a session predating the field', () => {
    const legacy: Workout = workout();
    delete legacy.startedTimezoneOffsetMinutes;
    const data = project([source({ workout: legacy })]);
    expect(data.workouts[0]?.timezoneOffsetMinutes).toBe(
      -new Date(STARTED_AT).getTimezoneOffset(),
    );
  });
});

describe('projectCoachExport — exercise identity', () => {
  it('reads the snapshot the row was created with', () => {
    const data = project([source()]);
    expect(data.workouts[0]?.exercises[0]).toMatchObject({
      name: 'Développé couché',
      measurementType: 'weight_reps',
      primaryMuscle: 'chest',
      equipment: 'barbell',
    });
  });

  it('prefers the snapshot over a library that has since been edited', () => {
    // The regression test of milestone 08A, seen from its first consumer:
    // renaming an exercise must not rewrite a session that already happened.
    const data = project([
      source({
        exercises: [
          {
            row: row(),
            exercise: exercise({
              name: 'Développé couché haltères',
              primaryMuscle: 'shoulders',
              equipment: 'dumbbell',
              measurementType: 'reps_only',
            }),
            sets: [set()],
          },
        ],
      }),
    ]);

    expect(data.workouts[0]?.exercises[0]).toMatchObject({
      name: 'Développé couché',
      measurementType: 'weight_reps',
      primaryMuscle: 'chest',
      equipment: 'barbell',
    });
  });

  it('falls back to the library for a row predating the snapshot', () => {
    const data = project([
      source({
        exercises: [
          {
            row: row({
              exerciseName: undefined,
              exerciseMeasurementType: undefined,
              exercisePrimaryMuscle: undefined,
              exerciseEquipment: undefined,
            }),
            exercise: exercise({ name: 'Squat', primaryMuscle: 'quads' }),
            sets: [set()],
          },
        ],
      }),
    ]);

    expect(data.workouts[0]?.exercises[0]).toMatchObject({
      name: 'Squat',
      primaryMuscle: 'quads',
    });
  });

  it('falls back field by field, not all or nothing', () => {
    const data = project([
      source({
        exercises: [
          {
            row: row({ exercisePrimaryMuscle: undefined }),
            exercise: exercise({ name: 'Squat', primaryMuscle: 'quads' }),
            sets: [set()],
          },
        ],
      }),
    ]);

    const projected = data.workouts[0]?.exercises[0];
    expect(projected?.name).toBe('Développé couché');
    expect(projected?.primaryMuscle).toBe('quads');
  });

  it('names nothing when there is neither snapshot nor library row', () => {
    const data = project([
      source({
        exercises: [
          {
            row: row({
              exerciseName: undefined,
              exerciseMeasurementType: undefined,
              exercisePrimaryMuscle: undefined,
              exerciseEquipment: undefined,
            }),
            exercise: undefined,
            sets: [set()],
          },
        ],
      }),
    ]);

    const projected = data.workouts[0]?.exercises[0];
    expect(projected?.name).toBeUndefined();
    expect(projected?.measurementType).toBeUndefined();
  });
});

describe('projectCoachExport — sets', () => {
  const withType = (type: MeasurementType, values: Partial<WorkoutSet>) =>
    project([
      source({
        exercises: [
          {
            row: row({ exerciseMeasurementType: type }),
            exercise: exercise({ measurementType: type }),
            sets: [
              set({
                weight: undefined,
                reps: undefined,
                ...values,
              }),
            ],
          },
        ],
      }),
    ]).workouts[0]?.exercises[0]?.sets[0];

  it('emits only the fields the measurement type measures', () => {
    expect(withType('weight_reps', { weight: 80, reps: 10, durationSeconds: 42 })).toEqual({
      number: 1,
      type: 'normal',
      side: 'both',
      weightKg: 80,
      reps: 10,
    });

    expect(withType('time_only', { durationSeconds: 45, weight: 12 })).toEqual({
      number: 1,
      type: 'normal',
      side: 'both',
      durationSeconds: 45,
    });

    expect(
      withType('distance_time', { distanceMeters: 2000, durationSeconds: 480, reps: 3 }),
    ).toEqual({
      number: 1,
      type: 'normal',
      side: 'both',
      durationSeconds: 480,
      distanceMeters: 2000,
    });

    expect(withType('assisted_weight_reps', { weight: 20, reps: 8 })).toEqual({
      number: 1,
      type: 'normal',
      side: 'both',
      weightKg: 20,
      reps: 8,
    });
  });

  it('emits every stored figure when the measurement type is unknown', () => {
    const data = project([
      source({
        exercises: [
          {
            row: row({ exerciseMeasurementType: undefined }),
            exercise: undefined,
            sets: [set({ weight: 80, reps: 10, durationSeconds: 30, distanceMeters: 100 })],
          },
        ],
      }),
    ]);

    expect(data.workouts[0]?.exercises[0]?.sets[0]).toMatchObject({
      weightKg: 80,
      reps: 10,
      durationSeconds: 30,
      distanceMeters: 100,
    });
  });

  it('carries the set type, the side and the RPE', () => {
    const types: SetType[] = ['normal', 'warmup', 'dropset', 'failure'];
    const data = project([
      source({
        exercises: [
          {
            row: row(),
            exercise: exercise(),
            sets: types.map((setType, order) =>
              set({ order, setType, side: order === 1 ? 'left' : 'both', rpe: order === 3 ? 8.5 : undefined }),
            ),
          },
        ],
      }),
    ]);

    const sets = data.workouts[0]?.exercises[0]?.sets ?? [];
    expect(sets.map((one) => one.type)).toEqual(types);
    expect(sets[1]?.side).toBe('left');
    expect(sets[3]?.rpe).toBe(8.5);
    expect(sets[0]?.rpe).toBeUndefined();
  });

  it('numbers the sets from one, in order', () => {
    const data = project([
      source({
        exercises: [
          {
            row: row(),
            exercise: exercise(),
            sets: [set({ order: 0 }), set({ order: 1 }), set({ order: 2 })],
          },
        ],
      }),
    ]);

    expect(data.workouts[0]?.exercises[0]?.sets.map((one) => one.number)).toEqual([1, 2, 3]);
  });
});

describe('projectCoachExport — options', () => {
  const threeSets = () =>
    source({
      exercises: [
        {
          row: row({ notes: 'Siège position 4' }),
          exercise: exercise(),
          sets: [
            set({ order: 0, setType: 'warmup', weight: 40, reps: 12 }),
            set({ order: 1 }),
            set({ order: 2 }),
          ],
        },
      ],
      workout: workout({ notes: 'Bonne séance.' }),
    });

  it('drops warm-ups and renumbers what is left', () => {
    const data = project([threeSets()], { ...DEFAULT_EXPORT_OPTIONS, includeWarmups: false });
    const sets = data.workouts[0]?.exercises[0]?.sets ?? [];

    expect(sets).toHaveLength(2);
    expect(sets.map((one) => one.number)).toEqual([1, 2]);
    expect(sets.every((one) => one.type !== 'warmup')).toBe(true);
  });

  it('keeps warm-ups by default', () => {
    expect(project([threeSets()]).workouts[0]?.exercises[0]?.sets).toHaveLength(3);
  });

  it('drops both kinds of notes on request', () => {
    const data = project([threeSets()], { ...DEFAULT_EXPORT_OPTIONS, includeNotes: false });
    expect(data.workouts[0]?.notes).toBeUndefined();
    expect(data.workouts[0]?.exercises[0]?.notes).toBeUndefined();
  });

  it('keeps notes with their line breaks by default', () => {
    const data = project([
      source({ workout: workout({ notes: 'Ligne un\nLigne deux' }) }),
    ]);
    expect(data.workouts[0]?.notes).toBe('Ligne un\nLigne deux');
  });

  it('omits internal ids by default and adds them on request', () => {
    expect(project([source()]).workouts[0]?.id).toBeUndefined();

    const withIds = project([source()], { ...DEFAULT_EXPORT_OPTIONS, includeIds: true });
    expect(withIds.workouts[0]?.id).toBe('w1');
    expect(withIds.workouts[0]?.exercises[0]?.id).toBe('e1');
  });
});

describe('projectCoachExport — order', () => {
  it('keeps the order it was handed, for sessions, exercises and sets', () => {
    const data = project([
      source({ workout: workout({ id: 'w1', name: 'Lundi' }) }),
      source({
        workout: workout({ id: 'w2', name: 'Mercredi', startedAt: STARTED_AT + 172_800_000 }),
        exercises: [
          { row: row({ id: 'a', order: 0, exerciseName: 'Squat' }), exercise: exercise(), sets: [] },
          { row: row({ id: 'b', order: 1, exerciseName: 'Soulevé' }), exercise: exercise(), sets: [] },
        ],
      }),
    ]);

    expect(data.workouts.map((one) => one.name)).toEqual(['Lundi', 'Mercredi']);
    expect(data.workouts[1]?.exercises.map((one) => one.name)).toEqual(['Squat', 'Soulevé']);
  });
});
