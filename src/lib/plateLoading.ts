import type { Equipment, Exercise, PlateLoading } from '@/data/types';
import { measurementShape } from '@/lib/measurement';

/**
 * How an exercise takes loose plates, resolved for the calculator (RF-28).
 *
 * Lives in `lib/` rather than beside the session screen because the exercise
 * sheet is where the answer is now *given* and the session screen is only where
 * it is *used* — a feature importing from another feature is the layering bug
 * §7 of the architecture warns about.
 *
 * Pure by construction (§7): an exercise in, a bar setup out. Nothing here reads
 * Dexie and nothing here speaks French.
 */

export interface PlateConfig {
  /** The resolved mode, so the screen can word "de chaque côté" correctly. */
  loading: Exclude<PlateLoading, 'none'>;
  /** Bar, sled or carriage, in kilograms — 0 when there is nothing to carry. */
  barWeight: number;
  /** 2 for a bar or a two-peg sled, 1 for a belt or a single peg. */
  sides: number;
}

/** What each mode weighs before the first plate, absent an exercise's own figure. */
const BASE_WEIGHT_KG: Record<Exclude<PlateLoading, 'none'>, number> = {
  barbell: 20,
  two_sided: 0,
  single_sided: 0,
};

export function defaultPlateBaseWeightKg(loading: PlateLoading): number {
  return loading === 'none' ? 0 : BASE_WEIGHT_KG[loading];
}

/** 2 for a symmetric setup, 1 for a single loading point. */
export function sidesOf(loading: Exclude<PlateLoading, 'none'>): number {
  return loading === 'single_sided' ? 1 : 2;
}

/**
 * Only a bar has a weight the lifter can swap today. A sled or a belt has a
 * fixed base, and offering to "adjust" it would invite a figure to be typed
 * where the honest answer is zero — though the sheet still lets it be corrected,
 * which is the whole point of `plateBaseWeightKg`.
 */
export function plateBaseWeightMatters(loading: Exclude<PlateLoading, 'none'>): boolean {
  return loading === 'barbell';
}

/**
 * The mode an exercise falls back to when nobody has said.
 *
 * The equipment table from Lot 8, kept exactly as it was: only hardware that
 * actually takes loose plates gets a diagram, and the weight has to be a genuine
 * **load** — a belt hung off a pull-up or a machine's assistance is not a bar.
 * Everything else answers `none` and waits to be told otherwise on its sheet,
 * which is the point of the whole feature: the app stops guessing.
 */
const LOADABLE: Partial<Record<Equipment, Exclude<PlateLoading, 'none'>>> = {
  barbell: 'barbell',
  smith: 'barbell',
  plate: 'two_sided',
};

export function defaultPlateLoading(
  exercise: Pick<Exercise, 'equipment' | 'measurementType'>,
): PlateLoading {
  if (measurementShape(exercise.measurementType).weightRole !== 'load') return 'none';
  return LOADABLE[exercise.equipment] ?? 'none';
}

/**
 * What this exercise is set to — its own answer, then the equipment's.
 *
 * An explicit `none` is an answer like any other: an exercise the user has
 * silenced must stay silent, and reading it as "unset" would resurrect the
 * diagram at every launch.
 */
export function resolvePlateLoading(
  exercise: Pick<Exercise, 'equipment' | 'measurementType' | 'plateLoading'>,
): PlateLoading {
  return exercise.plateLoading ?? defaultPlateLoading(exercise);
}

/** The exercise's base weight — its own figure, then the mode's default. */
export function resolvePlateBaseWeightKg(
  exercise: Pick<Exercise, 'equipment' | 'measurementType' | 'plateLoading' | 'plateBaseWeightKg'>,
): number {
  return exercise.plateBaseWeightKg ?? defaultPlateBaseWeightKg(resolvePlateLoading(exercise));
}

/**
 * The bar setup for an exercise, or null when there is nothing to load.
 *
 * The session screen calls this to decide whether the "Plaques" menu entry
 * appears at all. Unlike the equipment-only rule it replaces, an exercise that
 * says it takes plates gets them **whatever its measurement type**: 25 kg on a
 * dip belt is 25 kg of iron to fetch, and refusing to break it down because the
 * kilos are an *added* load rather than a *bar* load was the calculator being
 * pedantic about a distinction the rack does not have.
 */
export function platesConfigFor(
  exercise: Pick<Exercise, 'equipment' | 'measurementType' | 'plateLoading' | 'plateBaseWeightKg'>,
): PlateConfig | null {
  const loading = resolvePlateLoading(exercise);
  if (loading === 'none') return null;

  return {
    loading,
    barWeight: resolvePlateBaseWeightKg(exercise),
    sides: sidesOf(loading),
  };
}
