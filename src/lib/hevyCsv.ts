import type { Equipment, MeasurementType, SetType, Side } from '@/data/types';
import { inferHevyEquipment, inferHevyMeasurementType } from './hevyExerciseMatch';
import { externalExerciseIdentityKey } from './externalExerciseIdentity';
import { buildHevyWorkouts } from './hevyCsvGrouping';
export { makeHevyImportKey } from './hevyCsvGrouping';
import { readCsvRows } from './hevyCsvRows';
import {
  FITTRACK_HEADERS,
  HEVY_HEADERS,
  parseHevyRow,
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
  /** Côté travaillé, absent d'un fichier Hevy — cf. `FITTRACK_HEADERS`. */
  side?: Side;
}

export interface HevyParsedExercise {
  sourceTitle: string;
  order: number;
  sourceSupersetId?: string;
  supersetGroup: number;
  notes?: string;
  /** Repos déclaré par FitTrack, absent d'un fichier Hevy. */
  restSeconds?: number;
  /** Mesure et matériel déclarés : ils dispensent de les deviner du titre. */
  measurementType?: MeasurementType;
  equipment?: Equipment;
  sets: HevyParsedSet[];
}

export interface HevyParsedWorkout {
  title: string;
  /** La routine d'origine, déclarée par FitTrack. Absente = séance libre. */
  routineName?: string;
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
  { ok: true; data: HevyImportData } | { ok: false; issues: HevyCsvIssue[] };

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

  const missing = HEVY_HEADERS.filter((header) => !headerRow.cells.includes(header));
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

  // Les 14 de Hevy, plus les colonnes `fittrack_*` que l'app ajoute quand c'est
  // elle qui écrit. Tout le reste est refusé : une colonne inconnue est presque
  // toujours un fichier qui n'est pas celui qu'on croit.
  const known = new Set<string>([...HEVY_HEADERS, ...FITTRACK_HEADERS]);
  const seenHeaders = new Set<string>();
  const unexpected = headerRow.cells.filter((header) => {
    const duplicated = seenHeaders.has(header);
    seenHeaders.add(header);
    return duplicated || !known.has(header);
  });
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
  const sourcesByIdentityKey = new Map<
    string,
    {
      sourceTitle: string;
      sets: HevyParsedSet[];
      measurementType?: MeasurementType;
      equipment?: Equipment;
    }
  >();
  for (const workout of workouts) {
    for (const exercise of workout.exercises) {
      const identityKey = externalExerciseIdentityKey(exercise.sourceTitle);
      const existing = sourcesByIdentityKey.get(identityKey);
      if (existing === undefined) {
        sourcesByIdentityKey.set(identityKey, {
          sourceTitle: exercise.sourceTitle,
          sets: [...exercise.sets],
          ...(exercise.measurementType === undefined
            ? {}
            : { measurementType: exercise.measurementType }),
          ...(exercise.equipment === undefined ? {} : { equipment: exercise.equipment }),
        });
      } else {
        existing.sets.push(...exercise.sets);
        existing.measurementType ??= exercise.measurementType;
        existing.equipment ??= exercise.equipment;
      }
    }
  }

  const sourceExercises: HevySourceExercise[] = [];
  const measurementIssues: HevyCsvIssue[] = [];
  for (const source of sourcesByIdentityKey.values()) {
    const { sourceTitle, sets } = source;
    // Déclaré d'abord, deviné ensuite. L'inférence lit ce que les séries
    // contiennent : elle ne peut pas distinguer une traction assistée d'un
    // développé, alors que le fichier, lui, le sait quand FitTrack l'a écrit.
    const measurementType = source.measurementType ?? inferHevyMeasurementType(sets);
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
      equipment: source.equipment ?? inferHevyEquipment(sourceTitle),
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
            (exerciseTotal, exercise) => exerciseTotal + exercise.sets.length,
            0,
          ),
        0,
      ),
    },
  };
}
