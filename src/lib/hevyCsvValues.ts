import {
  EQUIPMENT,
  MEASUREMENT_TYPES,
  type Equipment,
  type MeasurementType,
  type SetType,
  type Side,
} from '@/data/types';
import type {
  HevyCsvIssue,
  HevyParsedSet,
} from './hevyCsv';
import type { CsvRow } from './hevyCsvRows';

export const HEVY_HEADERS = [
  'title',
  'start_time',
  'end_time',
  'description',
  'exercise_title',
  'superset_id',
  'exercise_notes',
  'set_index',
  'set_type',
  'weight_kg',
  'reps',
  'distance_km',
  'duration_seconds',
  'rpe',
] as const;

export type HevyHeader = (typeof HEVY_HEADERS)[number];

/**
 * Les colonnes que FitTrack ajoute aux 14 de Hevy quand c'est lui qui écrit le
 * fichier — cf. `hevyCsvExport`.
 *
 * Elles sont **facultatives des deux côtés** : un export Hevy authentique n'en
 * a aucune et s'importe comme avant, et une valeur illisible est ignorée plutôt
 * que refusée. Le format reste celui de Hevy ; ces colonnes ne font que rendre
 * à l'import ce que les 14 colonnes ne savent pas transporter (le repos, le
 * côté travaillé, l'identité de mesure, la routine d'origine). Un fichier
 * FitTrack reste donc lisible par n'importe quel outil qui lit du Hevy.
 */
export const FITTRACK_HEADERS = [
  'fittrack_routine',
  'fittrack_rest_seconds',
  'fittrack_measurement',
  'fittrack_equipment',
  'fittrack_side',
] as const;

export type FittrackHeader = (typeof FITTRACK_HEADERS)[number];

export interface ValidHevyRow {
  sourceLine: number;
  title: string;
  startedAt: number;
  endedAt: number;
  description?: string;
  exerciseTitle: string;
  sourceSupersetId?: string;
  exerciseNotes?: string;
  set: HevyParsedSet;
  /** Nom de la routine d'origine — colonne `fittrack_routine`, si elle est là. */
  routineName?: string;
  /** Repos de l'exercice en secondes — colonne `fittrack_rest_seconds`. */
  restSeconds?: number;
  /** Type de mesure déclaré, qui dispense de l'inférer du contenu des séries. */
  measurementType?: MeasurementType;
  /** Matériel déclaré, qui dispense de le deviner du titre. */
  equipment?: Equipment;
}

/**
 * Les mois tels que Hevy les écrit en français. Exportés parce que l'écriture
 * (`hevyCsvExport`) doit produire **exactement** ce que cette table relit : deux
 * listes de mois qui divergent, et l'app n'arrive plus à relire ses propres
 * fichiers.
 */
export const FRENCH_MONTH_LABELS = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
] as const;

const FRENCH_MONTHS = new Map<string, number>(
  FRENCH_MONTH_LABELS.map((label, index) => [label, index]),
);

const SIDES: readonly Side[] = ['both', 'left', 'right'];

/**
 * Une valeur d'extension illisible ne fait pas échouer l'import : la colonne
 * est un bonus, et un fichier retouché à la main dans un tableur doit rester
 * importable. On retombe alors sur le comportement Hevy — inférence, défauts.
 */
function optionalMember<T extends string>(
  raw: string | undefined,
  allowed: readonly T[],
): T | undefined {
  const value = raw?.trim().toLowerCase();
  if (value === undefined || value === '') return undefined;
  return allowed.find((member) => member === value);
}

function optionalCount(raw: string | undefined): number | undefined {
  const value = raw?.trim();
  if (value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

const SET_TYPE_MAP: Readonly<Record<string, SetType>> = {
  normal: 'normal',
  warmup: 'warmup',
  dropset: 'dropset',
  drop: 'dropset',
  failure: 'failure',
};

function parseLocalDate(value: string): number | undefined {
  const match =
    /^(\d{1,2}) ([^\s]+) (\d{4}), (\d{2}):(\d{2})$/.exec(value.trim());
  if (match === null) return undefined;
  const dayValue = match[1]!;
  const monthValue = match[2]!;
  const yearValue = match[3]!;
  const hourValue = match[4]!;
  const minuteValue = match[5]!;
  const month = FRENCH_MONTHS.get(monthValue.toLowerCase());
  if (month === undefined) return undefined;

  const day = Number(dayValue);
  const year = Number(yearValue);
  const hour = Number(hourValue);
  const minute = Number(minuteValue);
  const date = new Date(year, month, day, hour, minute);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute
  ) {
    return undefined;
  }
  return date.getTime();
}

function optionalText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

function decimal(value: string): number {
  return Number(value.trim().replace(',', '.'));
}

function optionalNumber(
  record: Record<HevyHeader, string>,
  field: HevyHeader,
  line: number,
  issues: HevyCsvIssue[],
  valid: (value: number) => boolean,
): number | undefined {
  const raw = record[field].trim();
  if (raw === '') return undefined;
  const value = decimal(raw);
  if (!Number.isFinite(value) || !valid(value)) {
    issues.push({
      line,
      code: 'invalid_number',
      field,
      value: record[field],
    });
    return undefined;
  }
  return value;
}

type CsvRecord = Record<HevyHeader, string> & Partial<Record<FittrackHeader, string>>;

function toRecord(
  headers: readonly string[],
  row: CsvRow,
): CsvRecord | undefined {
  if (row.cells.length !== headers.length) return undefined;
  return Object.fromEntries(
    headers.map((header, index) => [header, row.cells[index]]),
  ) as CsvRecord;
}

export function parseHevyRow(
  headers: readonly string[],
  row: CsvRow,
): { value?: ValidHevyRow; issues: HevyCsvIssue[] } {
  const record = toRecord(headers, row);
  if (record === undefined) {
    return {
      issues: [{ line: row.line, code: 'malformed_csv' }],
    };
  }

  const issues: HevyCsvIssue[] = [];
  const title = record.title.trim();
  const exerciseTitle = record.exercise_title.trim();
  if (title === '') {
    issues.push({
      line: row.line,
      code: 'required_value',
      field: 'title',
      value: record.title,
    });
  }
  if (exerciseTitle === '') {
    issues.push({
      line: row.line,
      code: 'required_value',
      field: 'exercise_title',
      value: record.exercise_title,
    });
  }

  const startedAt = parseLocalDate(record.start_time);
  const endedAt = parseLocalDate(record.end_time);
  if (startedAt === undefined) {
    issues.push({
      line: row.line,
      code: 'invalid_date',
      field: 'start_time',
      value: record.start_time,
    });
  }
  if (endedAt === undefined) {
    issues.push({
      line: row.line,
      code: 'invalid_date',
      field: 'end_time',
      value: record.end_time,
    });
  } else if (startedAt !== undefined && endedAt <= startedAt) {
    issues.push({
      line: row.line,
      code: 'invalid_workout_range',
      field: 'end_time',
      value: record.end_time,
    });
  }

  const setIndex = optionalNumber(
    record,
    'set_index',
    row.line,
    issues,
    (value) => Number.isInteger(value) && value >= 0,
  );
  if (record.set_index.trim() === '') {
    issues.push({
      line: row.line,
      code: 'invalid_number',
      field: 'set_index',
      value: record.set_index,
    });
  }

  const setType = SET_TYPE_MAP[record.set_type.trim().toLowerCase()];
  if (setType === undefined) {
    issues.push({
      line: row.line,
      code: 'invalid_set_type',
      field: 'set_type',
      value: record.set_type,
    });
  }

  const weight = optionalNumber(
    record,
    'weight_kg',
    row.line,
    issues,
    (value) => value >= 0,
  );
  const reps = optionalNumber(
    record,
    'reps',
    row.line,
    issues,
    (value) => Number.isInteger(value) && value >= 0,
  );
  const distanceKm = optionalNumber(
    record,
    'distance_km',
    row.line,
    issues,
    (value) => value >= 0,
  );
  const durationSeconds = optionalNumber(
    record,
    'duration_seconds',
    row.line,
    issues,
    (value) => Number.isInteger(value) && value >= 0,
  );
  const rpe = optionalNumber(
    record,
    'rpe',
    row.line,
    issues,
    (value) => value >= 6 && value <= 10 && Number.isInteger(value * 2),
  );

  if (distanceKm !== undefined && durationSeconds === undefined) {
    issues.push({
      line: row.line,
      code: 'invalid_measurement',
      field: 'distance_km',
      value: record.distance_km,
    });
  }

  const routineName = optionalText(record.fittrack_routine ?? '');
  const restSeconds = optionalCount(record.fittrack_rest_seconds);
  const measurementType = optionalMember(record.fittrack_measurement, MEASUREMENT_TYPES);
  const equipment = optionalMember(record.fittrack_equipment, EQUIPMENT);
  const side = optionalMember(record.fittrack_side, SIDES);

  if (
    issues.length > 0 ||
    startedAt === undefined ||
    endedAt === undefined ||
    setIndex === undefined ||
    setType === undefined
  ) {
    return { issues };
  }

  return {
    issues,
    value: {
      sourceLine: row.line,
      title,
      startedAt,
      endedAt,
      description: optionalText(record.description),
      exerciseTitle,
      sourceSupersetId: optionalText(record.superset_id),
      exerciseNotes: optionalText(record.exercise_notes),
      ...(routineName === undefined ? {} : { routineName }),
      ...(restSeconds === undefined ? {} : { restSeconds }),
      ...(measurementType === undefined ? {} : { measurementType }),
      ...(equipment === undefined ? {} : { equipment }),
      set: {
        sourceLine: row.line,
        order: setIndex,
        setType,
        ...(side === undefined ? {} : { side }),
        ...(weight === undefined ? {} : { weight }),
        ...(reps === undefined ? {} : { reps }),
        ...(distanceKm === undefined
          ? {}
          : { distanceMeters: distanceKm * 1000 }),
        ...(durationSeconds === undefined ? {} : { durationSeconds }),
        ...(rpe === undefined ? {} : { rpe }),
      },
    },
  };
}
