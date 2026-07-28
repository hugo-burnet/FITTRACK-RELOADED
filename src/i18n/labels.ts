import type { Equipment, Exercise, MeasurementType, MuscleGroup, SetType, Side } from '@/data/types';
import type { MetricKey, MetricUnit } from '@/lib/analytics/metrics';
import type { PeriodKey } from '@/lib/analytics/periods';
import type { WeeklyVolumeMetric } from '@/lib/analytics/volume';
import type { TargetUnit } from '@/lib/measurement';
import type { RecordKind } from '@/lib/records';
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

export const equipmentLabel = (equipment: Equipment): string => t(`equipment.${equipment}`);

export const measurementLabel = (measurement: MeasurementType): string =>
  t(`measurement.${measurement}`);

export const measurementHint = (measurement: MeasurementType): string =>
  t(`measurementHint.${measurement}`);

export const setTypeLabel = (setType: SetType): string => t(`setType.${setType}`);

export const setTypeHint = (setType: SetType): string => t(`setTypeHint.${setType}`);

/**
 * « Charge max » — the name of a record, wherever it is read.
 *
 * The exercise sheet lists the three, the live session congratulates them
 * (RF-23): naming them twice is how the same fact ends up with two names.
 */
export const recordLabel = (kind: RecordKind): string => t(`record.${kind}`);

/** "Pectoraux · Barre" — the one line under every exercise name in the app. */
export const exerciseSubtitle = (exercise: Exercise): string =>
  `${muscleLabel(exercise.primaryMuscle)} · ${equipmentLabel(exercise.equipment)}`;

/**
 * The unit keys of `lib/measurement` become words only here — the routine card
 * and the live grid must not spell them out twice and drift apart.
 */
export const unitLabel = (unit: TargetUnit): string => t(`units.${unit}`);

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
export function metricReading(value: number, unit: MetricUnit): string {
  if (unit === 'seconds') return formatDuration(value);

  const rounded = Math.round(value * 100) / 100;
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
