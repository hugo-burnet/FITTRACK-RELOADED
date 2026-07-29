import { describe, expect, it } from 'vitest';
import fixture from '@/test/fixtures/hevy-workout-data.csv?raw';
import { parseHevyCsv } from './hevyCsv';

const HEADER =
  'title,start_time,end_time,description,exercise_title,superset_id,' +
  'exercise_notes,set_index,set_type,weight_kg,reps,distance_km,' +
  'duration_seconds,rpe';

function row(overrides: Partial<Record<string, string>> = {}): string {
  const value = {
    title: 'Séance A',
    start_time: '24 juil. 2026, 15:05',
    end_time: '24 juil. 2026, 16:05',
    description: '',
    exercise_title: 'Développé couché (barre)',
    superset_id: '',
    exercise_notes: '',
    set_index: '0',
    set_type: 'normal',
    weight_kg: '80',
    reps: '8',
    distance_km: '',
    duration_seconds: '',
    rpe: '',
    ...overrides,
  };

  return [
    value.title,
    value.start_time,
    value.end_time,
    value.description,
    value.exercise_title,
    value.superset_id,
    value.exercise_notes,
    value.set_index,
    value.set_type,
    value.weight_kg,
    value.reps,
    value.distance_km,
    value.duration_seconds,
    value.rpe,
  ]
    .map((cell) => `"${cell.replaceAll('"', '""')}"`)
    .join(',');
}

describe('parseHevyCsv RFC 4180 input', () => {
  it('parses the complete anonymized fixture', () => {
    const result = parseHevyCsv(fixture);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.workoutCount).toBe(4);
    expect(new Set(result.data.sourceExercises.map((source) => source.measurementType))).toEqual(
      new Set(['weight_reps', 'reps_only', 'time_only', 'distance_time', 'weight_time']),
    );
  });

  it('preserves commas, quotes and newlines inside quoted notes', () => {
    const csv = `${HEADER}\r\n${row({
      description: 'Lourd, mais propre',
      exercise_notes: 'Banc "4"\nPrise moyenne',
    })}`;

    const result = parseHevyCsv(csv);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.workouts[0]!.notes).toBe('Lourd, mais propre');
    expect(result.data.workouts[0]!.exercises[0]!.notes).toBe('Banc "4"\nPrise moyenne');
  });

  it('rejects a missing required column before reading rows', () => {
    const result = parseHevyCsv(HEADER.replace(',rpe', ''));

    expect(result).toEqual({
      ok: false,
      issues: [{ line: 1, code: 'missing_header', field: 'rpe' }],
    });
  });

  it('rejects an unknown column to avoid reading another Hevy export', () => {
    const result = parseHevyCsv(`${HEADER},body_weight`);

    expect(result).toEqual({
      ok: false,
      issues: [{ line: 1, code: 'unexpected_header', field: 'body_weight' }],
    });
  });

  it('rejects a duplicated known column to enforce 14 headers', () => {
    const result = parseHevyCsv(`${HEADER},rpe`);

    expect(result).toEqual({
      ok: false,
      issues: [{ line: 1, code: 'unexpected_header', field: 'rpe' }],
    });
  });

  it('reports the physical line of an unclosed quoted field', () => {
    const result = parseHevyCsv(`${HEADER}\n"séance`);

    expect(result).toEqual({
      ok: false,
      issues: [{ line: 2, code: 'malformed_csv' }],
    });
  });
});

describe('parseHevyCsv values and grouping', () => {
  it('accepts point and comma decimals and converts kilometres to metres', () => {
    const csv = [
      HEADER,
      row({
        exercise_title: 'Rameur',
        weight_kg: '',
        reps: '',
        distance_km: '1,25',
        duration_seconds: '300',
        rpe: '7,5',
      }),
    ].join('\n');

    const result = parseHevyCsv(csv);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.workouts[0]!.exercises[0]!.sets[0]).toMatchObject({
      distanceMeters: 1250,
      durationSeconds: 300,
      rpe: 7.5,
    });
    expect(result.data.workouts[0]!.exercises[0]!.sets[0]).not.toHaveProperty('weight');
  });

  it.each([
    ['normal', 'normal'],
    ['warmup', 'warmup'],
    ['dropset', 'dropset'],
    ['drop', 'dropset'],
    ['failure', 'failure'],
  ] as const)('maps the Hevy set type %s to %s', (source, expected) => {
    const result = parseHevyCsv(`${HEADER}\n${row({ set_type: source })}`);

    expect(result.ok && result.data.workouts[0]!.exercises[0]!.sets[0]!.setType).toBe(expected);
  });

  it('rejects an unknown set type with its physical line', () => {
    const result = parseHevyCsv(`${HEADER}\n${row({ set_type: 'myo' })}`);

    expect(result).toEqual({
      ok: false,
      issues: [
        {
          line: 2,
          code: 'invalid_set_type',
          field: 'set_type',
          value: 'myo',
        },
      ],
    });
  });

  it('groups workouts and keeps exercise first appearance order', () => {
    const csv = [
      HEADER,
      row({
        exercise_title: 'Curl',
        set_index: '1',
        weight_kg: '12',
      }),
      row({
        exercise_title: 'Squat',
        set_index: '0',
        weight_kg: '100',
      }),
      row({
        exercise_title: 'Curl',
        set_index: '0',
        weight_kg: '10',
      }),
    ].join('\n');

    const result = parseHevyCsv(csv);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.workouts).toHaveLength(1);
    expect(result.data.workouts[0]!.exercises.map((exercise) => exercise.sourceTitle)).toEqual([
      'Curl',
      'Squat',
    ]);
    expect(result.data.workouts[0]!.exercises[0]!.sets.map((set) => set.weight)).toEqual([10, 12]);
    expect(result.data).toMatchObject({
      workoutCount: 1,
      exerciseCount: 2,
      setCount: 3,
    });
  });

  it('groups case, accent and punctuation variants under their first display title', () => {
    const csv = [
      HEADER,
      row({
        exercise_title: 'Développé debout centré',
        set_index: '0',
      }),
      row({
        exercise_title: 'DEVELOPPE-DEBOUT-CENTRE',
        set_index: '1',
      }),
      row({
        exercise_title: 'développé, debout centré !',
        set_index: '2',
      }),
    ].join('\n');

    const result = parseHevyCsv(csv);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.workouts[0]!.exercises).toHaveLength(1);
    expect(result.data.workouts[0]!.exercises[0]).toMatchObject({
      sourceTitle: 'Développé debout centré',
      sets: [{ order: 0 }, { order: 1 }, { order: 2 }],
    });
    expect(result.data.sourceExercises).toEqual([
      {
        sourceTitle: 'Développé debout centré',
        measurementType: 'weight_reps',
        equipment: 'other',
      },
    ]);
    expect(result.data).toMatchObject({
      exerciseCount: 1,
      setCount: 3,
    });
  });

  it('remaps source supersets to consecutive groups per workout', () => {
    const csv = [
      HEADER,
      row({ exercise_title: 'Curl', superset_id: '42' }),
      row({ exercise_title: 'Extension', superset_id: '42' }),
      row({ exercise_title: 'Rowing', superset_id: '99' }),
    ].join('\n');

    const result = parseHevyCsv(csv);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.workouts[0]!.exercises.map((exercise) => exercise.supersetGroup)).toEqual([
      1, 1, 2,
    ]);
  });

  it('generates a stable import key from title and timestamps', () => {
    const first = parseHevyCsv(`${HEADER}\n${row()}`);
    const second = parseHevyCsv(`${HEADER}\n${row()}`);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.data.workouts[0]!.importKey).toBe(second.data.workouts[0]!.importKey);
  });

  it.each([
    ['', { line: 1, code: 'empty_file' }],
    [
      `${HEADER}\n${row({ title: '' })}`,
      {
        line: 2,
        code: 'required_value',
        field: 'title',
        value: '',
      },
    ],
    [
      `${HEADER}\n${row({ exercise_title: '' })}`,
      {
        line: 2,
        code: 'required_value',
        field: 'exercise_title',
        value: '',
      },
    ],
    [
      `${HEADER}\n${row({ start_time: '31 févr. 2026, 10:00' })}`,
      {
        line: 2,
        code: 'invalid_date',
        field: 'start_time',
        value: '31 févr. 2026, 10:00',
      },
    ],
    [
      `${HEADER}\n${row({ end_time: '24 juil. 2026, 14:05' })}`,
      {
        line: 2,
        code: 'invalid_workout_range',
        field: 'end_time',
        value: '24 juil. 2026, 14:05',
      },
    ],
    [
      `${HEADER}\n${row({ set_index: '-1' })}`,
      {
        line: 2,
        code: 'invalid_number',
        field: 'set_index',
        value: '-1',
      },
    ],
    [
      `${HEADER}\n${row({ reps: '8,5' })}`,
      {
        line: 2,
        code: 'invalid_number',
        field: 'reps',
        value: '8,5',
      },
    ],
    [
      `${HEADER}\n${row({ rpe: '5,5' })}`,
      {
        line: 2,
        code: 'invalid_number',
        field: 'rpe',
        value: '5,5',
      },
    ],
    [
      `${HEADER}\n${row({ rpe: '7,2' })}`,
      {
        line: 2,
        code: 'invalid_number',
        field: 'rpe',
        value: '7,2',
      },
    ],
    [
      `${HEADER}\n${row({
        weight_kg: '',
        reps: '',
        distance_km: '1',
        duration_seconds: '',
      })}`,
      {
        line: 2,
        code: 'invalid_measurement',
        field: 'distance_km',
        value: '1',
      },
    ],
  ] as const)('rejects invalid CSV values with line details', (csv, issue) => {
    expect(parseHevyCsv(csv)).toEqual({
      ok: false,
      issues: [issue],
    });
  });

  it('rejects duplicate set indexes in the same exercise', () => {
    const result = parseHevyCsv([HEADER, row(), row()].join('\n'));

    expect(result).toEqual({
      ok: false,
      issues: [
        {
          line: 3,
          code: 'duplicate_set_index',
          field: 'set_index',
          value: '0',
        },
      ],
    });
  });
});

describe('parseHevyCsv source exercise inference', () => {
  it('infers all five supported measurement types and explicit equipment', () => {
    const csv = [
      HEADER,
      row({ exercise_title: 'Squat (barre)' }),
      row({
        exercise_title: 'Pompes au poids du corps',
        weight_kg: '',
        reps: '12',
      }),
      row({
        exercise_title: 'Planche',
        weight_kg: '',
        reps: '',
        duration_seconds: '60',
      }),
      row({
        exercise_title: 'Rameur',
        weight_kg: '',
        reps: '',
        distance_km: '1',
        duration_seconds: '300',
      }),
      row({
        exercise_title: 'Farmer hold avec haltères',
        reps: '',
        duration_seconds: '45',
      }),
    ].join('\n');

    const result = parseHevyCsv(csv);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.sourceExercises).toEqual([
      {
        sourceTitle: 'Squat (barre)',
        measurementType: 'weight_reps',
        equipment: 'barbell',
      },
      {
        sourceTitle: 'Pompes au poids du corps',
        measurementType: 'reps_only',
        equipment: 'bodyweight',
      },
      {
        sourceTitle: 'Planche',
        measurementType: 'time_only',
        equipment: 'other',
      },
      {
        sourceTitle: 'Rameur',
        measurementType: 'distance_time',
        equipment: 'other',
      },
      {
        sourceTitle: 'Farmer hold avec haltères',
        measurementType: 'weight_time',
        equipment: 'dumbbell',
      },
    ]);
    expect(result.data.exerciseCount).toBe(5);
  });

  it('rejects incompatible measurements under one source title', () => {
    const csv = [
      HEADER,
      row({ exercise_title: 'Exercice mixte' }),
      row({
        exercise_title: 'Exercice mixte',
        set_index: '1',
        weight_kg: '',
        reps: '',
        duration_seconds: '60',
      }),
    ].join('\n');

    expect(parseHevyCsv(csv)).toEqual({
      ok: false,
      issues: [
        {
          line: 2,
          code: 'invalid_measurement',
          field: 'exercise_title',
          value: 'Exercice mixte',
        },
      ],
    });
  });

  it('rejects incompatible measurements across source title variants', () => {
    const csv = [
      HEADER,
      row({ exercise_title: 'Élévation latérale' }),
      row({
        exercise_title: 'ELEVATION-LATERALE!',
        set_index: '1',
        weight_kg: '',
        reps: '',
        duration_seconds: '60',
      }),
    ].join('\n');

    expect(parseHevyCsv(csv)).toEqual({
      ok: false,
      issues: [
        {
          line: 2,
          code: 'invalid_measurement',
          field: 'exercise_title',
          value: 'Élévation latérale',
        },
      ],
    });
  });

  it('counts a repeated source title once across multiple workouts', () => {
    const csv = [
      HEADER,
      row(),
      row({
        title: 'Séance B',
        start_time: '25 juil. 2026, 15:05',
        end_time: '25 juil. 2026, 16:05',
      }),
    ].join('\n');

    const result = parseHevyCsv(csv);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toMatchObject({
      workoutCount: 2,
      exerciseCount: 1,
      setCount: 2,
    });
    expect(result.data.sourceExercises).toHaveLength(1);
  });

  it('counts source title variants once across multiple workouts', () => {
    const csv = [
      HEADER,
      row({ exercise_title: 'Développé debout centré' }),
      row({
        title: 'Séance B',
        start_time: '25 juil. 2026, 15:05',
        end_time: '25 juil. 2026, 16:05',
        exercise_title: 'DEVELOPPE-DEBOUT-CENTRE!',
      }),
    ].join('\n');

    const result = parseHevyCsv(csv);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toMatchObject({
      workoutCount: 2,
      exerciseCount: 1,
      setCount: 2,
    });
    expect(result.data.sourceExercises).toEqual([
      {
        sourceTitle: 'Développé debout centré',
        measurementType: 'weight_reps',
        equipment: 'other',
      },
    ]);
  });
});
