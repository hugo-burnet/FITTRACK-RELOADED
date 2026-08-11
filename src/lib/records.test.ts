import { describe, expect, it } from 'vitest';
import type { MeasurementType, PersonalRecordType, WorkoutSet } from '@/data/types';
import {
  isWorkingSet,
  projectRecordTimeline,
  setVolume,
  type RecordEventDraft,
  type RecordSource,
} from './records';

let sequence = 0;

const aSet = (values: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id: `set-${(sequence += 1)}`,
  createdAt: 0,
  updatedAt: 0,
  deletedAt: 0,
  workoutExerciseId: 'we',
  exerciseId: 'ex',
  workoutId: 'w',
  order: 0,
  setType: 'normal',
  side: 'both',
  isCompleted: 1,
  performedAt: 1,
  ...values,
});

const source = (values: Partial<RecordSource> = {}): RecordSource => {
  const hasWorkoutSetId = Object.hasOwn(values, 'workoutSetId');
  const workoutSetId = hasWorkoutSetId ? values.workoutSetId : `source-${(sequence += 1)}`;
  const set = Object.hasOwn(values, 'set') ? values.set : aSet({ id: workoutSetId });

  return {
    workoutId: 'workout',
    workoutSetId,
    exerciseId: 'exercise',
    measurementType: 'weight_reps',
    achievedAt: 1,
    exerciseOrder: 0,
    setOrder: 0,
    set,
    ...values,
  };
};

const assistedSource = (values: Partial<RecordSource> = {}): RecordSource =>
  source({ measurementType: 'assisted_weight_reps', ...values });

const values = (events: RecordEventDraft[], type: PersonalRecordType): number[] =>
  events.filter((event) => event.type === type).map((event) => event.value);

describe('record primitives', () => {
  it('calculates a set volume only when weight and reps are present', () => {
    expect(setVolume(aSet({ weight: 100, reps: 5 }))).toBe(500);
    expect(setVolume(aSet({ weight: 20, durationSeconds: 60 }))).toBe(0);
  });

  it('identifies warm-ups separately from working sets', () => {
    expect(isWorkingSet(aSet({ setType: 'warmup' }))).toBe(false);
    expect(isWorkingSet(aSet({ setType: 'normal' }))).toBe(true);
    expect(isWorkingSet(aSet({ setType: 'dropset' }))).toBe(true);
  });
});

describe('projectRecordTimeline', () => {
  it('emits the initial mark and only strict improvements', () => {
    const events = projectRecordTimeline(
      [
        source({ workoutSetId: 's1', set: aSet({ id: 's1', weight: 80, reps: 5 }), achievedAt: 1 }),
        source({ workoutSetId: 's2', set: aSet({ id: 's2', weight: 80, reps: 5 }), achievedAt: 2 }),
        source({
          workoutSetId: 's3',
          set: aSet({ id: 's3', weight: 82.5, reps: 5 }),
          achievedAt: 3,
        }),
      ],
      'epley',
    );

    expect(
      events.filter(({ type }) => type === 'max_weight').map(({ workoutSetId }) => workoutSetId),
    ).toEqual(['s1', 's3']);
  });

  it('uses lower-is-better semantics for assistance', () => {
    const events = projectRecordTimeline(
      [
        assistedSource({ workoutSetId: 's1', set: aSet({ id: 's1', weight: 35, reps: 8 }) }),
        assistedSource({ workoutSetId: 's2', set: aSet({ id: 's2', weight: 40, reps: 10 }) }),
        assistedSource({ workoutSetId: 's3', set: aSet({ id: 's3', weight: 30, reps: 8 }) }),
      ],
      'epley',
    );

    expect(values(events, 'min_assistance')).toEqual([35, 30]);
  });

  it('treats zero assistance as a strict improvement', () => {
    const events = projectRecordTimeline(
      [
        assistedSource({
          workoutSetId: 's1',
          set: aSet({ id: 's1', weight: 20, reps: 8 }),
        }),
        assistedSource({
          workoutSetId: 's2',
          set: aSet({ id: 's2', weight: 0, reps: 8 }),
          achievedAt: 2,
        }),
      ],
      'epley',
    );

    expect(values(events, 'min_assistance')).toEqual([20, 0]);
  });

  it('orders sources by timestamps, exercise and set order, then their stable ID', () => {
    const events = projectRecordTimeline(
      [
        source({
          workoutSetId: 'z',
          set: aSet({ id: 'z', weight: 10, reps: 1 }),
          achievedAt: 1,
          exerciseOrder: 0,
          setOrder: 0,
        }),
        source({
          workoutSetId: 'b',
          set: aSet({ id: 'b', weight: 30, reps: 1 }),
          achievedAt: 1,
          exerciseOrder: 1,
          setOrder: 0,
        }),
        source({
          workoutSetId: 'a',
          set: aSet({ id: 'a', weight: 20, reps: 1 }),
          achievedAt: 1,
          exerciseOrder: 1,
          setOrder: 0,
        }),
        source({
          workoutSetId: 'c',
          set: aSet({ id: 'c', weight: 40, reps: 1 }),
          achievedAt: 1,
          exerciseOrder: 1,
          setOrder: 1,
        }),
        source({ workoutSetId: 'd', set: aSet({ id: 'd', weight: 50, reps: 1 }), achievedAt: 2 }),
      ],
      'epley',
    );

    expect(
      events.filter((event) => event.type === 'max_weight').map((event) => event.workoutSetId),
    ).toEqual(['z', 'a', 'b', 'c', 'd']);
  });

  it('emits every category beaten by a single series with its entered context', () => {
    const events = projectRecordTimeline(
      [source({ workoutSetId: 's1', set: aSet({ id: 's1', weight: 100, reps: 5 }) })],
      'brzycki',
    );

    expect(events).toMatchObject([
      { type: 'max_weight', value: 100, weight: 100, reps: 5, workoutSetId: 's1' },
      { type: 'max_volume_set', value: 500, weight: 100, reps: 5, workoutSetId: 's1' },
      { type: 'best_1rm', weight: 100, reps: 5, formula: 'brzycki', workoutSetId: 's1' },
    ]);
  });

  it('does not project warm-up, incomplete, or deleted set sources', () => {
    const events = projectRecordTimeline(
      [
        source({ set: aSet({ weight: 100, reps: 5, setType: 'warmup' }) }),
        source({ set: aSet({ weight: 100, reps: 5, isCompleted: 0 }) }),
        source({ set: aSet({ weight: 100, reps: 5, deletedAt: 1 }) }),
      ],
      'epley',
    );

    expect(events).toEqual([]);
  });

  it.each([
    [
      'weight_reps',
      { weight: 80, reps: 5 },
      500,
      ['max_weight', 'max_volume_set', 'best_1rm', 'max_volume_session'],
    ],
    [
      'reps_only',
      { weight: 10, reps: 12 },
      500,
      ['max_reps', 'max_added_weight', 'max_volume_session'],
    ],
    [
      'assisted_weight_reps',
      { weight: 30, reps: 12 },
      500,
      ['min_assistance', 'max_reps', 'max_volume_session'],
    ],
    ['weight_time', { weight: 20, durationSeconds: 60 }, undefined, ['max_weight', 'max_duration']],
    ['time_only', { durationSeconds: 60 }, undefined, ['max_duration']],
    [
      'distance_time',
      { distanceMeters: 1000, durationSeconds: 300 },
      undefined,
      ['max_distance', 'max_duration'],
    ],
  ] satisfies readonly [
    MeasurementType,
    Partial<WorkoutSet>,
    number | undefined,
    PersonalRecordType[],
  ][])(
    'maps %s to its record categories',
    (measurementType, setValues, sessionTonnage, expected) => {
      const events = projectRecordTimeline(
        [
          source({ measurementType, set: aSet(setValues) }),
          ...(sessionTonnage === undefined
            ? []
            : [
                source({
                  measurementType,
                  workoutSetId: undefined,
                  set: undefined,
                  sessionTonnage,
                  achievedAt: 2,
                }),
              ]),
        ],
        'epley',
      );

      expect(events.map((event) => event.type)).toEqual(expected);
    },
  );

  it('adds a session-tonnage record once per workout and exercise without a set ID', () => {
    const events = projectRecordTimeline(
      [
        source({ workoutId: 'w1', workoutSetId: undefined, set: undefined, sessionTonnage: 500 }),
        source({ workoutId: 'w2', workoutSetId: undefined, set: undefined, sessionTonnage: 500 }),
        source({ workoutId: 'w3', workoutSetId: undefined, set: undefined, sessionTonnage: 600 }),
      ],
      'epley',
    );

    const tonnageEvents = events.filter((event) => event.type === 'max_volume_session');
    expect(tonnageEvents).toMatchObject([
      { workoutId: 'w1', value: 500 },
      { workoutId: 'w3', value: 600 },
    ]);
    expect(tonnageEvents.every((event) => !Object.hasOwn(event, 'workoutSetId'))).toBe(true);
  });

  it('does not create an estimated 1RM outside weighted rep sets or its valid rep range', () => {
    const events = projectRecordTimeline(
      [
        source({ measurementType: 'weight_reps', set: aSet({ weight: 100, reps: 13 }) }),
        source({ measurementType: 'reps_only', set: aSet({ weight: 100, reps: 5 }) }),
        source({ measurementType: 'weight_reps', set: aSet({ weight: 100, reps: 5 }) }),
      ],
      'epley',
    );

    expect(values(events, 'best_1rm')).toEqual([100 * (1 + 5 / 30)]);
  });

  it.each([
    ['max_weight', 'weight_reps', { weight: 100, reps: 1 }],
    ['max_added_weight', 'reps_only', { weight: 10, reps: 1 }],
    ['min_assistance', 'assisted_weight_reps', { weight: 30, reps: 1 }],
    ['max_reps', 'reps_only', { reps: 10 }],
    ['best_1rm', 'weight_reps', { weight: 100, reps: 5 }],
    ['max_volume_set', 'weight_reps', { weight: 100, reps: 5 }],
    ['max_volume_session', 'weight_reps', undefined],
    ['max_duration', 'time_only', { durationSeconds: 60 }],
    ['max_distance', 'distance_time', { distanceMeters: 1000 }],
  ] satisfies readonly [PersonalRecordType, MeasurementType, Partial<WorkoutSet> | undefined][])(
    'does not emit ties for %s',
    (type, measurementType, setValues) => {
      const first = source({
        measurementType,
        set: setValues === undefined ? undefined : aSet(setValues),
        sessionTonnage: type === 'max_volume_session' ? 500 : undefined,
      });
      const tied = source({
        measurementType,
        achievedAt: 2,
        set: setValues === undefined ? undefined : aSet(setValues),
        sessionTonnage: type === 'max_volume_session' ? 500 : undefined,
      });

      expect(values(projectRecordTimeline([first, tied], 'epley'), type)).toHaveLength(1);
    },
  );

  it('compares raw 1RM values instead of their display rounding', () => {
    const events = projectRecordTimeline(
      [
        source({ set: aSet({ weight: 100, reps: 1 }), achievedAt: 1 }),
        source({ set: aSet({ weight: 100.04, reps: 1 }), achievedAt: 2 }),
      ],
      'epley',
    );

    const oneRepMaxes = values(events, 'best_1rm');
    expect(oneRepMaxes).toHaveLength(2);
    expect(oneRepMaxes[0]!.toFixed(1)).toBe(oneRepMaxes[1]!.toFixed(1));
    expect(oneRepMaxes[1]).toBeGreaterThan(oneRepMaxes[0]!);
  });
});
