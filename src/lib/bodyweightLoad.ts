import type { Equipment, MeasurementType } from '@/data/types';
import { measurementShape } from '@/lib/measurement';

/**
 * The share of the body an exercise actually lifts (`Exercise.bodyweightLoadFactor`).
 *
 * The coefficient has existed since the tonnage work: a pull-up lifts 100 % of
 * the lifter, a push-up about 70 %, a bodyweight squat about 90 %. What was
 * missing is what happens when **nobody fills it in** — and the answer was
 * silence. `effectiveLoadKg` reads an absent coefficient as "no body involved",
 * so an unweighted pull-up on a self-made exercise weighed exactly zero
 * kilograms: fourteen repetitions, no tonnage, no session record, nothing.
 * Reported from the phone, twice.
 *
 * So the default stops being "nothing" and starts being the movement's own
 * arithmetic, and — this is the part that matters — the figure is **written to
 * the exercise and shown on its sheet** rather than applied invisibly at
 * reading time. A coefficient you can see is a coefficient you can correct.
 *
 * Pure by construction (architecture §7).
 */

/** Whether the kilos of this measurement type sit next to a body at all. */
export function supportsBodyweightLoad(measurementType: MeasurementType): boolean {
  const role = measurementShape(measurementType).weightRole;
  return role === 'added' || role === 'assist';
}

/**
 * Where the resistance comes from something other than the lifter.
 *
 * "Répétitions seules" is the shape of a bodyweight movement — the picker's own
 * example is "tractions, pompes, dips au poids du corps" — but three pieces of
 * hardware borrow that shape while supplying their own resistance: a band, a
 * cable and a pin-loaded machine. Those are the exercises whose coefficient must
 * stay empty; everything else in that shape is a body being moved.
 */
const EXTERNAL_RESISTANCE: ReadonlySet<Equipment> = new Set<Equipment>([
  'band',
  'cable',
  'machine',
]);

/**
 * The coefficient a brand-new exercise starts on.
 *
 * 100 % wherever the body is what is being moved, and nothing at all where it is
 * not. An assisted machine is always the whole body minus what the machine gives
 * back, so it is 100 % by construction.
 *
 * The value is a *starting point*, not a verdict: a crunch is not 100 % of a
 * body and the sheet says so in one tap. What it must never be again is absent
 * by accident — that absence is the whole bug, and it is silent by nature,
 * because nothing on any screen printed a zero to be suspicious about.
 */
export function defaultBodyweightLoadFactor(
  measurementType: MeasurementType,
  equipment: Equipment,
): number | undefined {
  if (!supportsBodyweightLoad(measurementType)) return undefined;
  if (measurementShape(measurementType).weightRole === 'assist') return 1;
  return EXTERNAL_RESISTANCE.has(equipment) ? undefined : 1;
}

/** The presets the sheet offers, heaviest first. Percentages, as they are read. */
export const BODYWEIGHT_FACTOR_PRESETS = [100, 90, 70, 50] as const;

/** kg factor → the whole percent the field shows, without a float ghost. */
export function factorToPercent(factor: number): number {
  return Number((factor * 100).toFixed(2));
}

/** The percent typed back into a stored factor. */
export function percentToFactor(percent: number): number {
  return Number((percent / 100).toFixed(4));
}

/** More than nothing and no more than a whole body. */
export function isValidBodyweightFactorPercent(percent: number): boolean {
  return Number.isFinite(percent) && percent > 0 && percent <= 100;
}
