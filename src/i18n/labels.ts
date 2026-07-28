import type { Equipment, Exercise, MeasurementType, MuscleGroup, SetType, Side } from '@/data/types';
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
