import type {
  Equipment,
  MeasurementType,
  SetType,
} from '@/data/types';
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

function normalizeImportTitle(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

export function makeHevyImportKey(
  title: string,
  startedAt: number,
  endedAt: number,
): string {
  return `hevy_csv:${startedAt}:${endedAt}:${normalizeImportTitle(title)}`;
}

interface WorkoutBuilder {
  row: ValidHevyRow;
  exerciseRows: Map<string, ValidHevyRow[]>;
}

function buildWorkouts(
  rows: readonly ValidHevyRow[],
): { workouts?: HevyParsedWorkout[]; issues: HevyCsvIssue[] } {
  const groups = new Map<string, WorkoutBuilder>();
  for (const row of rows) {
    const key = `${row.title}\u0000${row.startedAt}\u0000${row.endedAt}`;
    const workout = groups.get(key);
    if (workout === undefined) {
      groups.set(key, {
        row,
        exerciseRows: new Map([[row.exerciseTitle, [row]]]),
      });
      continue;
    }
    const exercise = workout.exerciseRows.get(row.exerciseTitle);
    if (exercise === undefined) {
      workout.exerciseRows.set(row.exerciseTitle, [row]);
    } else {
      exercise.push(row);
    }
  }

  const issues: HevyCsvIssue[] = [];
  const workouts = [...groups.values()].map(({ row, exerciseRows }) => {
    const supersetGroups = new Map<string, number>();
    const exercises = [...exerciseRows.entries()].map(
      ([sourceTitle, sourceRows], exerciseIndex): HevyParsedExercise => {
        const indexes = new Set<number>();
        for (const sourceRow of sourceRows) {
          if (indexes.has(sourceRow.set.order)) {
            issues.push({
              line: sourceRow.sourceLine,
              code: 'duplicate_set_index',
              field: 'set_index',
              value: String(sourceRow.set.order),
            });
          }
          indexes.add(sourceRow.set.order);
        }

        const first = sourceRows[0];
        if (first === undefined) {
          throw new Error('Hevy exercise group cannot be empty');
        }
        let supersetGroup = 0;
        if (first.sourceSupersetId !== undefined) {
          const existing = supersetGroups.get(first.sourceSupersetId);
          if (existing === undefined) {
            supersetGroup = supersetGroups.size + 1;
            supersetGroups.set(first.sourceSupersetId, supersetGroup);
          } else {
            supersetGroup = existing;
          }
        }

        const sets = sourceRows
          .map((sourceRow) => sourceRow.set)
          .sort((left, right) => left.order - right.order)
          .map((set, order) => ({ ...set, order }));
        return {
          sourceTitle,
          order: exerciseIndex,
          ...(first.sourceSupersetId === undefined
            ? {}
            : { sourceSupersetId: first.sourceSupersetId }),
          supersetGroup,
          ...(first.exerciseNotes === undefined
            ? {}
            : { notes: first.exerciseNotes }),
          sets,
        };
      },
    );

    return {
      title: row.title,
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      durationSeconds: Math.floor((row.endedAt - row.startedAt) / 1000),
      ...(row.description === undefined ? {} : { notes: row.description }),
      importKey: makeHevyImportKey(
        row.title,
        row.startedAt,
        row.endedAt,
      ),
      exercises,
    };
  });

  return issues.length === 0 ? { workouts, issues } : { issues };
}

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

  const built = buildWorkouts(rows);
  if (built.workouts === undefined) {
    return { ok: false, issues: built.issues };
  }
  const workouts = built.workouts;
  const sourceTitles = new Set(
    workouts.flatMap((workout) =>
      workout.exercises.map((exercise) => exercise.sourceTitle),
    ),
  );

  return {
    ok: true,
    data: {
      workouts,
      sourceExercises: [],
      workoutCount: workouts.length,
      exerciseCount: sourceTitles.size,
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
