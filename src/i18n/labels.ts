import type {
  Equipment,
  Exercise,
  MeasurementType,
  MuscleGroup,
  PersonalRecord,
  PersonalRecordType,
  PlateLoading,
  SetType,
  Side,
} from '@/data/types';
import type { MetricKey, MetricUnit } from '@/lib/analytics/metrics';
import type { PeriodKey } from '@/lib/analytics/periods';
import type { WeeklyVolumeMetric } from '@/lib/analytics/volume';
import type { TargetPart, TargetUnit } from '@/lib/measurement';
import type { OneRepMaxFormula } from '@/lib/oneRepMax';
import { t } from './fr';

/**
 * The stored vocabulary, in French. Lives next to the dictionary rather than in
 * `features/exercises/`: routines (Lot 4) and the live workout (Lot 5) name the
 * same muscles and the same hardware, and a feature importing from another
 * feature is the layering bug §7 of the architecture warns about.
 *
 * The template literal types are the whole point: adding a value to
 * MUSCLE_GROUPS without adding its label fails the typecheck, instead of
 * quietly printing `lower_back` on a screen that is meant to be in French.
 */

export const muscleLabel = (muscle: MuscleGroup): string => t(`muscle.${muscle}`);

/** `Date.getDay()` order, so a stored day and a label never need a conversion. */
const WEEKDAY_KEYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

export const weekdayLabel = (day: number): string => {
  const key = WEEKDAY_KEYS[day];
  return key === undefined ? '' : t(`weekday.long.${key}`);
};

/** The letter on a seven-box week. Never on its own — cf. `weekdayLabel`. */
export const weekdayInitial = (day: number): string => {
  const key = WEEKDAY_KEYS[day];
  return key === undefined ? '' : t(`weekday.initial.${key}`);
};

/** « mercredi 26 août à 18:00 » — one reminder, in one readable sentence. */
export const reminderMoment = (at: number): string =>
  new Date(at)
    .toLocaleString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    })
    // Intl écrit « mercredi 26 août, 18:00 » ; la phrase, elle, se lit « à ».
    .replace(', ', ' à ');

export const equipmentLabel = (equipment: Equipment): string => t(`equipment.${equipment}`);

export const measurementLabel = (measurement: MeasurementType): string =>
  t(`measurement.${measurement}`);

export const measurementHint = (measurement: MeasurementType): string =>
  t(`measurementHint.${measurement}`);

export const plateLoadingLabel = (loading: PlateLoading): string => t(`plateLoading.${loading}`);

export const plateLoadingHint = (loading: PlateLoading): string =>
  t(`plateLoadingHint.${loading}`);

export const setTypeLabel = (setType: SetType): string => t(`setType.${setType}`);

export const setTypeHint = (setType: SetType): string => t(`setTypeHint.${setType}`);

/**
 * « Charge max » — the name of a record, wherever it is read.
 *
 * The exercise sheet lists the three, the live session congratulates them
 * (RF-23): naming them twice is how the same fact ends up with two names.
 */
export const recordLabel = (type: PersonalRecordType): string => t(`record.${type}`);

const recordNumber = (value: number, precision = 100): string =>
  (Math.round(value * precision) / precision).toLocaleString('fr-FR');

const recordKilograms = (value: number, precision?: number): string =>
  `${recordNumber(value, precision)} ${unitLabel('kg')}`;

export function recordValue(record: PersonalRecord): string {
  switch (record.type) {
    case 'max_reps':
      return `${recordNumber(record.value)} ${unitLabel('reps')}`;
    case 'max_duration':
      return formatDuration(record.value);
    case 'max_distance':
      return metricReading(record.value, 'meters');
    case 'min_assistance':
      return t('record.assistanceValue', { value: recordKilograms(record.value) });
    case 'best_1rm':
      return recordKilograms(record.value, 10);
    default:
      return recordKilograms(record.value);
  }
}

export const oneRepMaxFormulaLabel = (formula: OneRepMaxFormula): string =>
  t(
    formula === 'epley'
      ? 'record.formulaEpley'
      : formula === 'brzycki'
        ? 'record.formulaBrzycki'
        : 'record.formulaLombardi',
  );

export function recordContext(record: PersonalRecord): string {
  if (record.type === 'max_volume_session') return t('record.sessionTonnageContext');

  const weightReps =
    record.weight !== undefined && record.reps !== undefined
      ? t('record.weightRepsContext', {
          weight: recordKilograms(record.weight),
          reps: recordNumber(record.reps),
        })
      : undefined;

  if (record.type === 'best_1rm' && weightReps !== undefined && record.formula !== undefined) {
    return t('record.formulaContext', {
      context: weightReps,
      formula: oneRepMaxFormulaLabel(record.formula),
    });
  }
  if (record.type === 'max_volume_set') return weightReps ?? '';
  // `max_reps` is shared by added-load and assisted movements. The persisted
  // event does not carry that weight role, so omitting it is safer than calling
  // assistance a positive added load.
  if (record.type === 'max_reps') return '';
  if (record.type === 'min_assistance' && record.weight !== undefined) {
    return t('record.assistanceContext', { weight: recordKilograms(record.weight) });
  }
  if (
    (record.type === 'max_distance' || record.type === 'max_duration') &&
    record.distanceMeters !== undefined &&
    record.durationSeconds !== undefined
  ) {
    return t('record.distanceDurationContext', {
      distance: metricReading(record.distanceMeters, 'meters'),
      duration: formatDuration(record.durationSeconds),
    });
  }
  return record.reps === undefined
    ? ''
    : t('record.repsContext', { count: recordNumber(record.reps) });
}

export function recordGain(
  record: PersonalRecord,
  previousValue?: number,
): string | undefined {
  if (previousValue === undefined) return undefined;
  const delta =
    record.type === 'min_assistance'
      ? previousValue - record.value
      : record.value - previousValue;
  if (!(delta > 0)) return undefined;

  const value = (() => {
    switch (record.type) {
      case 'max_reps':
        return `${recordNumber(delta)} ${unitLabel('reps')}`;
      case 'max_duration':
        return formatDuration(delta);
      case 'max_distance':
        return metricReading(delta, 'meters');
      case 'best_1rm':
        return recordKilograms(delta, 10);
      default:
        return recordKilograms(delta);
    }
  })();

  return record.type === 'min_assistance'
    ? t('record.gainLessAssistance', { value })
    : t('record.gain', { value });
}

/** "Pectoraux · Barre" — the one line under every exercise name in the app. */
export const exerciseSubtitle = (exercise: Exercise): string =>
  `${muscleLabel(exercise.primaryMuscle)} · ${equipmentLabel(exercise.equipment)}`;

/**
 * The unit keys of `lib/measurement` become words only here — the routine card
 * and the live grid must not spell them out twice and drift apart.
 */
export const unitLabel = (unit: TargetUnit): string => t(`units.${unit}`);

/**
 * « 15 – 18 reps », « +3,5 kg », « 1:30 min » — one reading of `targetParts`.
 *
 * The prefix is optional on purpose (only added load and assistance carry one),
 * and every screen that inlined this interpolation had to remember the `?? ''`.
 * One of them didn't, and printed « undefined15 – 18 reps » on a published
 * routine. It is spelled once here, next to `unitLabel`, for the same reason.
 */
export const partReading = (part: TargetPart): string =>
  `${part.prefix ?? ''}${part.value} ${unitLabel(part.unit)}`;

/** « Gauche » / « Droite ». `both` has no word: it is the unremarkable case. */
export const sideLabel = (side: Side): string =>
  side === 'both' ? '' : t(side === 'left' ? 'side.left' : 'side.right');

/** « Charge max » — the name of what a curve counts, wherever it is read. */
export const metricLabel = (key: MetricKey): string => t(`metric.${key}`);

/** One sentence under the curve: what that number really counts, and excludes. */
export const metricHint = (key: MetricKey): string => t(`metricHint.${key}`);

export const periodLabel = (key: PeriodKey): string => t(`period.${key}`);

/**
 * « 4 séances », « 1 séance », « 0 séance ».
 *
 * Zero has its own wording rather than falling through to the plural, because a
 * week with no session is a reading this screen prints on purpose — not an
 * absence to be phrased around.
 */
export function weeklySessionsReading(count: number): string {
  if (count === 0) return t('weekly.sessionsNone');
  if (count === 1) return t('weekly.sessionsOne');
  return t('weekly.sessions', { count });
}

/**
 * « 48 séries », « 1 série », « 0 série ».
 *
 * Zero has its own wording for the same reason the weekly one does, and here it
 * matters more: a muscle at zero is the reading milestone G3 exists to print.
 */
export function muscleSetsReading(count: number): string {
  if (count === 0) return t('muscles.setsNone');
  if (count === 1) return t('muscles.setsOne');
  return t('muscles.sets', { count });
}

export const weeklyVolumeMetricLabel = (metric: WeeklyVolumeMetric): string =>
  t(metric === 'tonnage' ? 'volume.metricTonnage' : 'volume.metricDuration');

const weeklyDurationReading = (value: number): string => {
  const roundedToMinute = Math.round(value / 60) * 60;
  return roundedToMinute === 0
    ? `0 ${t('units.minutes')}`
    : formatDuration(roundedToMinute);
};

/** A weekly total, without second-level noise on an hour-scale chart. */
export function weeklyVolumeReading(value: number, metric: WeeklyVolumeMetric): string {
  if (metric === 'duration') return weeklyDurationReading(value);
  const rounded = Math.round(value * 10) / 10;
  return `${rounded.toLocaleString('fr-FR')} ${unitLabel('kg')}`;
}

/** « août 2026 » — the name of a month, wherever a report names one. */
export const monthLabel = (monthStart: number): string =>
  new Date(monthStart).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

/** What a monthly figure is counted in. */
export type MonthlyUnit = 'count' | 'tonnage' | 'duration';

export function monthlyReading(value: number, unit: MonthlyUnit): string {
  if (unit === 'duration') return weeklyVolumeReading(value, 'duration');
  if (unit === 'tonnage') return weeklyVolumeReading(value, 'tonnage');
  return value.toLocaleString('fr-FR');
}

/**
 * « +500 kg », « −2 », « = ».
 *
 * The sign is carried by the reading itself rather than by an arrow: a month
 * that did less is not a failure to be dressed up, and `−` printed plainly is
 * the same information a red arrow gives without the verdict. `=` for an exact
 * tie, because "+0 kg" reads as a rounding error rather than as a match.
 */
export function monthlyDeltaReading(value: number, unit: MonthlyUnit): string {
  if (value === 0) return t('monthly.deltaSame');
  const reading = monthlyReading(Math.abs(value), unit);
  return `${value > 0 ? '+' : '\u2212'}${reading}`;
}

/** The short engraving beside the chart, where a four-digit label would steal the plot. */
export function weeklyVolumeScaleReading(value: number, metric: WeeklyVolumeMetric): string {
  if (metric === 'duration') return weeklyDurationReading(value);
  return new Intl.NumberFormat('fr-FR', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

/**
 * A metric's value as it is read: « 102,5 kg », « 1:30 min », « 5 séries ».
 *
 * Durations go through `formatDuration` rather than printing raw seconds, so a
 * plank reads the same length on the chart, in the session, and in the export —
 * the reason that function was moved here in the first place.
 */
export function metricReading(value: number, unit: MetricUnit, key?: MetricKey): string {
  if (unit === 'seconds') return formatDuration(value);

  const precision = key === 'estimatedOneRepMax' ? 10 : 100;
  const rounded = Math.round(value * precision) / precision;
  const figure = rounded.toLocaleString('fr-FR');

  if (unit === 'sets') return `${figure} ${t(rounded === 1 ? 'units.set' : 'units.sets')}`;
  if (unit === 'meters' && rounded >= 1000) {
    return `${(Math.round((rounded / 1000) * 100) / 100).toLocaleString('fr-FR')} ${t('units.kilometers')}`;
  }

  return `${figure} ${unitLabel(unit)}`;
}

/**
 * A session length as a human reads it: « 45 s », « 12:30 min », « 1 h 12 ».
 *
 * Lives here rather than in the screen that first needed it because the Markdown
 * export prints the same duration. Two implementations would eventually write
 * the same session two different lengths, and the export is precisely the
 * artefact where that would be discovered by someone else.
 */
export function formatDuration(seconds: number): string {
  const rounded = Math.max(0, Math.round(seconds));
  if (rounded < 60) return `${rounded} ${t('units.seconds')}`;

  const minutes = Math.floor(rounded / 60);
  const remainingSeconds = rounded % 60;
  if (minutes < 60) {
    return remainingSeconds === 0
      ? `${minutes} ${t('units.minutes')}`
      : `${minutes}:${String(remainingSeconds).padStart(2, '0')} ${t('units.minutes')}`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes === 0
    ? `${hours} ${t('units.hours')}`
    : `${hours} ${t('units.hours')} ${String(remainingMinutes).padStart(2, '0')}`;
}
