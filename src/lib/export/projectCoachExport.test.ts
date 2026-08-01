import { describe, expect, it } from 'vitest';
import type {
  MeasurementType,
  SetType,
} from '@/data/types';
import type {
  HistoricalSet,
  HistoricalWorkout,
} from '@/lib/historyProjection';
import {
  historicalExercise,
  historicalSet,
  historicalWorkout,
} from '@/test/historicalWorkout';
import { projectCoachExport } from './projectCoachExport';
import { DEFAULT_EXPORT_OPTIONS } from './types';

const EXPORTED_AT = Date.UTC(2026, 6, 28, 9, 0, 0);
const STARTED_AT = Date.UTC(2026, 6, 27, 16, 20, 0);

const source = (
  overrides: Partial<HistoricalWorkout> = {},
): HistoricalWorkout =>
  historicalWorkout({
    workoutId: 'w1',
    name: 'Upper A',
    startedAt: STARTED_AT,
    timezoneOffsetMinutes: 120,
    durationSeconds: 4_320,
    exercises: [
      historicalExercise({
        exerciseId: 'e1',
        sets: [historicalSet({ weight: 80, reps: 10 })],
      }),
    ],
    ...overrides,
  });

const project = (
  sources: HistoricalWorkout[],
  options = DEFAULT_EXPORT_OPTIONS,
) =>
  projectCoachExport(
    { kind: 'all-history' },
    sources,
    options,
    EXPORTED_AT,
  );

describe('projectCoachExport — envelope', () => {
  it('declares its format and version', () => {
    const data = project([source()]);
    expect(data.format).toBe('fittrack-coach-export');
    expect(data.schemaVersion).toBe(1);
    expect(data.exportedAt).toBe('2026-07-28T09:00:00.000Z');
  });

  it('carries the requested scope', () => {
    const scope = {
      kind: 'workout',
      workoutId: 'w1',
    } as const;

    expect(
      projectCoachExport(
        scope,
        [source()],
        DEFAULT_EXPORT_OPTIONS,
        EXPORTED_AT,
      ).scope,
    ).toEqual(scope);
  });

  it('counts sessions and working sets without warm-ups', () => {
    const data = project([
      source({
        exercises: [
          historicalExercise({
            sets: [
              historicalSet({ setType: 'warmup' }),
              historicalSet(),
              historicalSet({ setType: 'dropset' }),
            ],
          }),
        ],
      }),
    ]);

    expect(data.workoutCount).toBe(1);
    expect(data.workingSetCount).toBe(2);
    expect(
      data.workouts[0]?.exercises[0]?.sets,
    ).toHaveLength(3);
  });

  it('projects an empty history', () => {
    const data = project([]);
    expect(data.workouts).toEqual([]);
    expect(data.workoutCount).toBe(0);
    expect(data.workingSetCount).toBe(0);
  });

  it('keeps a session without exercises and an exercise without sets', () => {
    const data = project([
      source({ exercises: [] }),
      source({
        workoutId: 'w2',
        exercises: [historicalExercise({ sets: [] })],
      }),
    ]);

    expect(data.workouts).toHaveLength(2);
    expect(data.workouts[0]?.exercises).toEqual([]);
    expect(data.workouts[1]?.exercises[0]?.sets).toEqual([]);
  });
});

describe('projectCoachExport — totals', () => {
  it('counts tonnage only where weight is the load', () => {
    const data = project([
      source({
        exercises: [
          historicalExercise({
            measurementType: 'assisted_weight_reps',
            sets: [historicalSet({ weight: 20, reps: 8 })],
          }),
        ],
      }),
    ]);

    expect(data.workouts[0]?.totals.tonnage).toBe(0);
    expect(data.workouts[0]?.totals.totalReps).toBe(8);
    expect(data.workouts[0]?.totals.workingSets).toBe(1);
  });

  it('adds the load of a barbell session', () => {
    const data = project([
      source({
        exercises: [
          historicalExercise({
            sets: [
              historicalSet({
                setType: 'warmup',
                weight: 40,
                reps: 12,
              }),
              historicalSet({ weight: 80, reps: 10 }),
              historicalSet({ weight: 80, reps: 9 }),
            ],
          }),
        ],
      }),
    ]);

    expect(data.workouts[0]?.totals.tonnage).toBe(1_520);
    expect(data.workouts[0]?.totals.workingSets).toBe(2);
  });

  it('keeps whole-session totals when warm-ups are dropped', () => {
    const sources = [
      source({
        exercises: [
          historicalExercise({
            sets: [
              historicalSet({
                setType: 'warmup',
                weight: 40,
                reps: 12,
              }),
              historicalSet(),
            ],
          }),
        ],
      }),
    ];

    expect(project(sources).workouts[0]?.totals).toEqual(
      project(sources, {
        ...DEFAULT_EXPORT_OPTIONS,
        includeWarmups: false,
      }).workouts[0]?.totals,
    );
  });
});

describe('projectCoachExport — dates', () => {
  it('places a session with its recorded offset', () => {
    const data = project([source()]);
    expect(data.workouts[0]?.startedAt).toBe(
      '2026-07-27T18:20:00+02:00',
    );
    expect(data.workouts[0]?.localDate).toBe('2026-07-27');
    expect(data.workouts[0]?.timezoneOffsetMinutes).toBe(120);
  });

  it('does not read the phone when an offset was recorded', () => {
    const data = project([
      source({ timezoneOffsetMinutes: -300 }),
    ]);
    expect(data.workouts[0]?.startedAt).toBe(
      '2026-07-27T11:20:00-05:00',
    );
    expect(data.workouts[0]?.localDate).toBe('2026-07-27');
  });

  it('falls back to the platform offset for legacy sessions', () => {
    const data = project([
      source({ timezoneOffsetMinutes: undefined }),
    ]);
    expect(data.workouts[0]?.timezoneOffsetMinutes).toBe(
      -new Date(STARTED_AT).getTimezoneOffset(),
    );
  });
});

describe('projectCoachExport — exercise projection', () => {
  it('omits a fully absent historical identity', () => {
    const data = project([
      source({
        exercises: [
          historicalExercise({
            name: undefined,
            measurementType: undefined,
            primaryMuscle: undefined,
            equipment: undefined,
          }),
        ],
      }),
    ]);

    const projected = data.workouts[0]?.exercises[0];
    expect(projected).toEqual({
      sets: [
        {
          number: 1,
          type: 'normal',
          side: 'both',
          weightKg: 80,
          reps: 8,
        },
      ],
    });
    expect(projected).not.toHaveProperty('name');
    expect(projected).not.toHaveProperty('measurementType');
    expect(projected).not.toHaveProperty('primaryMuscle');
    expect(projected).not.toHaveProperty('equipment');
  });

  it('projects the resolved historical identity', () => {
    const data = project([source()]);
    expect(data.workouts[0]?.exercises[0]).toMatchObject({
      name: 'Développé couché',
      measurementType: 'weight_reps',
      primaryMuscle: 'chest',
      equipment: 'barbell',
    });
  });

  it('projects a field-by-field resolved identity', () => {
    const data = project([
      source({
        exercises: [
          historicalExercise({
            name: 'Développé couché',
            primaryMuscle: 'quads',
          }),
        ],
      }),
    ]);

    const projected = data.workouts[0]?.exercises[0];
    expect(projected?.name).toBe('Développé couché');
    expect(projected?.primaryMuscle).toBe('quads');
  });
});

describe('projectCoachExport — sets', () => {
  const withType = (
    type: MeasurementType,
    values: Partial<HistoricalSet>,
  ) =>
    project([
      source({
        exercises: [
          historicalExercise({
            measurementType: type,
            sets: [
              historicalSet({
                weight: undefined,
                reps: undefined,
                ...values,
              }),
            ],
          }),
        ],
      }),
    ]).workouts[0]?.exercises[0]?.sets[0];

  it('emits only fields measured by the measurement type', () => {
    expect(
      withType('weight_reps', {
        weight: 80,
        reps: 10,
        durationSeconds: 42,
      }),
    ).toEqual({
      number: 1,
      type: 'normal',
      side: 'both',
      weightKg: 80,
      reps: 10,
    });

    expect(
      withType('time_only', {
        durationSeconds: 45,
        weight: 12,
      }),
    ).toEqual({
      number: 1,
      type: 'normal',
      side: 'both',
      durationSeconds: 45,
    });

    expect(
      withType('distance_time', {
        distanceMeters: 2_000,
        durationSeconds: 480,
        reps: 3,
      }),
    ).toEqual({
      number: 1,
      type: 'normal',
      side: 'both',
      durationSeconds: 480,
      distanceMeters: 2_000,
    });

    expect(
      withType('assisted_weight_reps', {
        weight: 20,
        reps: 8,
      }),
    ).toEqual({
      number: 1,
      type: 'normal',
      side: 'both',
      weightKg: 20,
      reps: 8,
    });
  });

  it('emits every stored figure when the type is unknown', () => {
    const data = project([
      source({
        exercises: [
          historicalExercise({
            measurementType: undefined,
            sets: [
              historicalSet({
                weight: 80,
                reps: 10,
                durationSeconds: 30,
                distanceMeters: 100,
              }),
            ],
          }),
        ],
      }),
    ]);

    expect(
      data.workouts[0]?.exercises[0]?.sets[0],
    ).toMatchObject({
      weightKg: 80,
      reps: 10,
      durationSeconds: 30,
      distanceMeters: 100,
    });
  });

  it('carries set type, side, and RPE', () => {
    const types: SetType[] = [
      'normal',
      'warmup',
      'dropset',
      'failure',
    ];
    const data = project([
      source({
        exercises: [
          historicalExercise({
            sets: types.map((setType, index) =>
              historicalSet({
                setType,
                side: index === 1 ? 'left' : 'both',
                rpe: index === 3 ? 8.5 : undefined,
              }),
            ),
          }),
        ],
      }),
    ]);

    const sets = data.workouts[0]?.exercises[0]?.sets ?? [];
    expect(sets.map((one) => one.type)).toEqual(types);
    expect(sets[1]?.side).toBe('left');
    expect(sets[3]?.rpe).toBe(8.5);
    expect(sets[0]?.rpe).toBeUndefined();
  });

  it('numbers sets from one in order', () => {
    const data = project([
      source({
        exercises: [
          historicalExercise({
            sets: [
              historicalSet(),
              historicalSet(),
              historicalSet(),
            ],
          }),
        ],
      }),
    ]);

    expect(
      data.workouts[0]?.exercises[0]?.sets.map(
        (one) => one.number,
      ),
    ).toEqual([1, 2, 3]);
  });
});

describe('projectCoachExport — options', () => {
  const mixedSets = () =>
    source({
      notes: 'Bonne séance.',
      exercises: [
        historicalExercise({
          notes: 'Siège position 4',
          sets: [
            historicalSet({
              setType: 'warmup',
              weight: 40,
              reps: 12,
            }),
            historicalSet({ setType: 'normal' }),
            historicalSet({ setType: 'dropset' }),
            historicalSet({ setType: 'failure' }),
          ],
        }),
      ],
    });

  it('drops warm-ups and renumbers what remains', () => {
    const data = project([mixedSets()], {
      ...DEFAULT_EXPORT_OPTIONS,
      includeWarmups: false,
    });
    const sets = data.workouts[0]?.exercises[0]?.sets ?? [];

    expect(sets).toHaveLength(3);
    expect(sets.map((one) => one.number)).toEqual([1, 2, 3]);
    expect(sets.map((one) => one.type)).toEqual(['normal', 'dropset', 'failure']);
    expect(data.workingSetCount).toBe(sets.length);
  });

  it('keeps warm-ups by default', () => {
    expect(
      project([mixedSets()]).workouts[0]?.exercises[0]?.sets,
    ).toHaveLength(4);
  });

  it('drops both kinds of notes on request', () => {
    const data = project([mixedSets()], {
      ...DEFAULT_EXPORT_OPTIONS,
      includeNotes: false,
    });
    expect(data.workouts[0]?.notes).toBeUndefined();
    expect(
      data.workouts[0]?.exercises[0]?.notes,
    ).toBeUndefined();
  });

  it('keeps note line breaks by default', () => {
    const data = project([
      source({ notes: 'Ligne un\nLigne deux' }),
    ]);
    expect(data.workouts[0]?.notes).toBe(
      'Ligne un\nLigne deux',
    );
  });

  it('omits ids by default and adds them on request', () => {
    expect(project([source()]).workouts[0]?.id).toBeUndefined();

    const withIds = project([source()], {
      ...DEFAULT_EXPORT_OPTIONS,
      includeIds: true,
    });
    expect(withIds.workouts[0]?.id).toBe('w1');
    expect(withIds.workouts[0]?.exercises[0]?.id).toBe('e1');
  });
});

describe('projectCoachExport — order', () => {
  it('keeps handed session, exercise, and set order', () => {
    const data = project([
      source({ workoutId: 'w1', name: 'Lundi' }),
      source({
        workoutId: 'w2',
        name: 'Mercredi',
        startedAt: STARTED_AT + 172_800_000,
        exercises: [
          historicalExercise({ name: 'Squat', sets: [] }),
          historicalExercise({ name: 'Soulevé', sets: [] }),
        ],
      }),
    ]);

    expect(data.workouts.map((one) => one.name)).toEqual([
      'Lundi',
      'Mercredi',
    ]);
    expect(
      data.workouts[1]?.exercises.map((one) => one.name),
    ).toEqual(['Squat', 'Soulevé']);
  });
});
