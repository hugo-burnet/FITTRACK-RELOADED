import type {
  Equipment,
  MeasurementType,
  SetType,
} from '@/data/types';
import {
  inferHevyEquipment,
  inferHevyMeasurementType,
} from './hevyExerciseMatch';
import { buildHevyWorkouts } from './hevyCsvGrouping';
export { makeHevyImportKey } from './hevyCsvGrouping';
import { readCsvRows } from './hevyCsvRows';
import {
  HEVY_HEADERS,
  parseHevyRow,
  type HevyHeader,
  type ValidHevyRow,
} from './hevyCsvValues';

export type HevyCsvIssueCode =
  | 'empty_file'
  | 'malformed_csv'
  | 'missing_header'
  | 'unexpected_header'
  | 'required_value'
  | 'invalid_date'
  | 'invalid_number'
  | 'invalid_set_type'
  | 'invalid_measurement'
  | 'invalid_workout_range'
  | 'duplicate_set_index';

export interface HevyCsvIssue {
  line: number;
  code: HevyCsvIssueCode;
  field?: string;
  value?: string;
}

export interface HevyParsedSet {
  sourceLine: number;
  order: number;
  setType: SetType;
  weight?: number;
  reps?: number;
  distanceMeters?: number;
  durationSeconds?: number;
  rpe?: number;
}

export interface HevyParsedExercise {
  sourceTitle: string;
  order: number;
  sourceSupersetId?: string;
  supersetGroup: number;
  notes?: string;
  sets: HevyParsedSet[];
}

export interface HevyParsedWorkout {
  title: string;
  startedAt: number;
  endedAt: number;
  durationSeconds: number;
  notes?: string;
  importKey: string;
  exercises: HevyParsedExercise[];
}

export interface HevySourceExercise {
  sourceTitle: string;
  measurementType: MeasurementType;
  equipment: Equipment;
}

export interface HevyImportData {
  workouts: HevyParsedWorkout[];
  sourceExercises: HevySourceExercise[];
  workoutCount: number;
  exerciseCount: number;
  setCount: number;
}

export type HevyCsvResult =
  | { ok: true; data: HevyImportData }
  | { ok: false; issues: HevyCsvIssue[] };

export function parseHevyCsv(text: string): HevyCsvResult {
  const parsedRows = readCsvRows(text);
  if (!parsedRows.ok) {
    return {
      ok: false,
      issues: [{ line: parsedRows.line, code: 'malformed_csv' }],
    };
  }
  const [headerRow, ...dataRows] = parsedRows.rows;
  if (headerRow === undefined) {
    return { ok: false, issues: [{ line: 1, code: 'empty_file' }] };
  }

  const missing = HEVY_HEADERS.filter(
    (header) => !headerRow.cells.includes(header),
  );
  if (missing.length > 0) {
    return {
      ok: false,
      issues: missing.map((field) => ({
        line: 1,
        code: 'missing_header',
        field,
      })),
    };
  }

  const unexpected = headerRow.cells.filter(
    (header) => !HEVY_HEADERS.includes(header as HevyHeader),
  );
  if (unexpected.length > 0) {
    return {
      ok: false,
      issues: unexpected.map((field) => ({
        line: 1,
        code: 'unexpected_header',
        field,
      })),
    };
  }

  const rows: ValidHevyRow[] = [];
  const rowIssues: HevyCsvIssue[] = [];
  for (const csvRow of dataRows) {
    const parsed = parseHevyRow(headerRow.cells, csvRow);
    rowIssues.push(...parsed.issues);
    if (parsed.value !== undefined) rows.push(parsed.value);
  }
  if (rowIssues.length > 0) {
    return { ok: false, issues: rowIssues };
  }

  const built = buildHevyWorkouts(rows);
  if (built.workouts === undefined) {
    return { ok: false, issues: built.issues };
  }
  const workouts = built.workouts;
  const sourceSets = new Map<string, HevyParsedSet[]>();
  for (const workout of workouts) {
    for (const exercise of workout.exercises) {
      const existing = sourceSets.get(exercise.sourceTitle);
      if (existing === undefined) {
        sourceSets.set(exercise.sourceTitle, [...exercise.sets]);
      } else {
        existing.push(...exercise.sets);
      }
    }
  }

  const sourceExercises: HevySourceExercise[] = [];
  const measurementIssues: HevyCsvIssue[] = [];
  for (const [sourceTitle, sets] of sourceSets) {
    const measurementType = inferHevyMeasurementType(sets);
    if (measurementType === undefined) {
      measurementIssues.push({
        line: sets[0]?.sourceLine ?? 1,
        code: 'invalid_measurement',
        field: 'exercise_title',
        value: sourceTitle,
      });
      continue;
    }
    sourceExercises.push({
      sourceTitle,
      measurementType,
      equipment: inferHevyEquipment(sourceTitle),
    });
  }
  if (measurementIssues.length > 0) {
    return { ok: false, issues: measurementIssues };
  }

  return {
    ok: true,
    data: {
      workouts,
      sourceExercises,
      workoutCount: workouts.length,
      exerciseCount: sourceExercises.length,
      setCount: workouts.reduce(
        (total, workout) =>
          total +
          workout.exercises.reduce(
            (exerciseTotal, exercise) =>
              exerciseTotal + exercise.sets.length,
            0,
          ),
        0,
      ),
    },
  };
}
