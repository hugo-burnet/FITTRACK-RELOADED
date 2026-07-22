import type { Equipment, Exercise, MeasurementType, MuscleGroup, SetType } from '@/data/types';
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

/** "Pectoraux · Barre" — the one line under every exercise name in the app. */
export const exerciseSubtitle = (exercise: Exercise): string =>
  `${muscleLabel(exercise.primaryMuscle)} · ${equipmentLabel(exercise.equipment)}`;
