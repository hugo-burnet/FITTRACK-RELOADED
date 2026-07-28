import type { MeasurementType, SetType, Side } from '@/data/types';
import { t } from '@/i18n/fr';
import {
  equipmentLabel,
  formatDuration,
  muscleLabel,
  setTypeLabel,
  sideLabel,
  unitLabel,
} from '@/i18n/labels';
import {
  type EntryColumn,
  entryColumns,
  measurementShape,
  performedParts,
  type TargetField,
} from '@/lib/measurement';
import type { CoachExport, ExportExercise, ExportScope, ExportSet, ExportWorkout } from './types';

/**
 * A projection turned into a document a human — or a model — can read.
 *
 * **The one module of `lib/` allowed to import `i18n/`.** Everything else here
 * emits keys and lets a component find the words, because a component always
 * follows. Nothing follows a serialiser: its output *is* the French. Injecting a
 * label dictionary instead would create a second, parallel `fr.ts`, which is
 * exactly what the "no hard-coded string" rule exists to prevent.
 *
 * What it must never do is decide anything the app has already decided. The
 * columns come from `entryColumns`, the readings from `performedParts`, the
 * durations from `formatDuration`, the totals from the projection. A document
 * that disagreed with the screen that produced it would be the real defect.
 */

const decimal = (value: number): string => value.toLocaleString('fr-FR');

const MONTHS = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

/** `'2026-07-27'` → « 27 juillet 2026 », read as a calendar day and nothing else. */
function frenchDate(isoDate: string): string {
  const [year = '0', month = '1', day = '1'] = isoDate.split('-');
  return MONTHS.format(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

/** A timestamp as the civil day it falls on **where the reader is**. */
function frenchDateOf(at: number): string {
  const local = new Date(at);
  return MONTHS.format(Date.UTC(local.getFullYear(), local.getMonth(), local.getDate()));
}

/**
 * « 27 juillet 2026 à 18:20 » from the ISO the projection wrote.
 *
 * Read off the string rather than re-derived from a `Date`: the string already
 * carries the session's own offset, and handing it back to `Date` would place it
 * on the reader's clock — the exact drift the stored offset exists to stop.
 */
function frenchDateTime(workout: ExportWorkout): string {
  return `${frenchDate(workout.localDate)} à ${workout.startedAt.slice(11, 16)}`;
}

/** A pipe closes a cell and a newline closes a row. Nothing else can break one. */
const cell = (text: string): string => text.replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ');

// ---------------------------------------------------------------------------
// Colonnes
// ---------------------------------------------------------------------------

/** Entry order, for a row whose measurement type is lost — cf. `projectCoachExport`. */
const UNKNOWN_COLUMNS: EntryColumn[] = [
  { field: 'weight', unit: 'kg' },
  { field: 'distance', unit: 'meters' },
  { field: 'reps', unit: 'reps' },
  { field: 'duration', unit: 'seconds' },
];

function columnLabel(field: TargetField, type: MeasurementType | undefined): string {
  if (field === 'reps') return t('export.columnReps');
  if (field === 'duration') return t('export.columnDuration');
  if (field === 'distance') return t('export.columnDistance');

  const role = type === undefined ? 'load' : measurementShape(type).weightRole;
  if (role === 'assist') return t('export.columnWeightAssist');
  if (role === 'added') return t('export.columnWeightAdded');
  return t('export.columnWeightLoad');
}

/**
 * One figure, formatted exactly as the app formats it.
 *
 * Routed through `performedParts` with a single field rather than reimplemented:
 * "1:30 min" and "2 km" are decisions `lib/measurement` already made, and an
 * export that spelled them differently would look like a different app.
 */
function reading(set: ExportSet, field: TargetField, type: MeasurementType | undefined): string {
  const known = type ?? (field === 'reps' || field === 'weight' ? 'weight_reps' : 'distance_time');
  const part = performedParts(known, {
    ...(field === 'weight' ? { weight: set.weightKg } : {}),
    ...(field === 'reps' ? { reps: set.reps } : {}),
    ...(field === 'duration' ? { durationSeconds: set.durationSeconds } : {}),
    ...(field === 'distance' ? { distanceMeters: set.distanceMeters } : {}),
  }).at(0);

  if (part === undefined) return t('export.missingValue');

  // Two things are dropped on purpose. The prefix, because the column heading
  // already says whether these kilos are a load, a belt or an assistance, and a
  // `−` under a column called "Assistance" reads as a negative assistance. And
  // the unit of a repetition, because it is the one unit that cannot vary from
  // cell to cell — unlike s/min and m/km, which is why those keep theirs.
  if (field === 'reps') return part.value;

  return `${part.value} ${unitLabel(part.unit)}`;
}

interface Column {
  label: string;
  /** Numbers right, words left — the only alignment a Markdown table can carry. */
  numeric: boolean;
  of: (set: ExportSet) => string;
}

function columnsFor(exercise: ExportExercise): Column[] {
  const type = exercise.measurementType;
  const figures = type === undefined ? UNKNOWN_COLUMNS : entryColumns(type);

  const columns: Column[] = [
    { label: t('export.columnSet'), numeric: true, of: (set) => String(set.number) },
  ];

  // Both of these describe the *exception*, so they earn their width only when
  // there is one. Twenty rows reading "Normale" are twenty rows of noise on the
  // column that would have told a coach something.
  if (exercise.sets.some((set) => set.type !== 'normal')) {
    columns.push({
      label: t('export.columnType'),
      numeric: false,
      of: (set) => setTypeLabel(set.type as SetType),
    });
  }
  if (exercise.sets.some((set) => set.side !== 'both')) {
    columns.push({
      label: t('export.columnSide'),
      numeric: false,
      of: (set) => sideLabel(set.side as Side) || t('export.missingValue'),
    });
  }

  for (const figure of figures) {
    columns.push({
      label: columnLabel(figure.field, type),
      numeric: true,
      of: (set) => reading(set, figure.field, type),
    });
  }

  if (exercise.sets.some((set) => set.rpe !== undefined)) {
    columns.push({
      label: t('export.columnRpe'),
      numeric: true,
      of: (set) => (set.rpe === undefined ? t('export.missingValue') : decimal(set.rpe)),
    });
  }

  return columns;
}

const tableRow = (cells: string[]): string => `| ${cells.map(cell).join(' | ')} |`;

function table(exercise: ExportExercise): string[] {
  const columns = columnsFor(exercise);

  return [
    tableRow(columns.map((column) => column.label)),
    `|${columns.map((column) => (column.numeric ? '---:' : '---')).join('|')}|`,
    ...exercise.sets.map((set) => tableRow(columns.map((column) => column.of(set)))),
  ];
}

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

function scopeLine(scope: ExportScope, workouts: readonly ExportWorkout[]): string {
  if (scope.kind === 'workout') {
    const workout = workouts.at(0);
    return workout === undefined
      ? t('export.scopeAll')
      : t('export.scopeWorkout', { name: workout.name, date: frenchDate(workout.localDate) });
  }

  if (scope.kind === 'period') {
    return t('export.scopePeriod', {
      from: frenchDateOf(scope.from),
      // `to` is exclusive, so the last day covered is the one before it. A header
      // announcing a day the document does not contain is a small lie the reader
      // has no way of catching.
      to: frenchDateOf(scope.to - 1),
    });
  }

  if (scope.kind === 'exercise') {
    const name = workouts.flatMap((workout) => workout.exercises).find((one) => one.name !== undefined)
      ?.name;
    return name === undefined
      ? t('export.scopeExerciseAnonymous')
      : t('export.scopeExercise', { name });
  }

  return t('export.scopeAll');
}

function exerciseSection(exercise: ExportExercise): string[] {
  const subtitle = [
    exercise.primaryMuscle === undefined ? undefined : muscleLabel(exercise.primaryMuscle),
    exercise.equipment === undefined ? undefined : equipmentLabel(exercise.equipment),
  ]
    .filter((part): part is string => part !== undefined)
    .join(' · ');
  const name = exercise.name ?? t('export.unknownExercise');

  return [
    `### ${subtitle === '' ? name : `${name} — ${subtitle}`}`,
    '',
    // Notes live outside the table precisely so they keep their line breaks: a
    // machine setting written on three lines is three facts, not one sentence.
    ...(exercise.notes?.trim() ? [exercise.notes, ''] : []),
    ...(exercise.sets.length === 0 ? [] : [...table(exercise), '']),
  ];
}

function workoutSection(workout: ExportWorkout): string[] {
  const facts = [
    t('export.duration', { value: formatDuration(workout.durationSeconds) }),
    ...(workout.totals.tonnage > 0
      ? [t('export.tonnage', { value: `${decimal(workout.totals.tonnage)} ${unitLabel('kg')}` })]
      : []),
    t('export.workingSets', { count: workout.totals.workingSets }),
  ];

  return [
    `## ${t('export.workoutHeading', { name: workout.name, date: frenchDateTime(workout) })}`,
    '',
    facts.join(' · '),
    '',
    ...(workout.notes?.trim() ? [workout.notes, ''] : []),
    ...workout.exercises.flatMap(exerciseSection),
  ];
}

export function serializeMarkdown(data: CoachExport): string {
  const anyTonnage = data.workouts.some((workout) => workout.totals.tonnage > 0);

  const lines = [
    `# ${t('export.title')}`,
    '',
    `- ${scopeLine(data.scope, data.workouts)}`,
    `- ${t('export.workoutCount', { count: data.workoutCount })}`,
    `- ${t('export.workingSetCount', { count: data.workingSetCount })}`,
    `- ${t('export.exportedAt', { date: frenchDate(data.exportedAt.slice(0, 10)) })}`,
    ...(anyTonnage ? [`- ${t('export.tonnageNote')}`] : []),
    '',
    ...(data.workouts.length === 0
      ? [t('export.empty'), '']
      : data.workouts.flatMap(workoutSection)),
  ];

  // A single trailing newline: a document pasted into a chat should not open on
  // a blank screen's worth of whitespace.
  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`;
}
