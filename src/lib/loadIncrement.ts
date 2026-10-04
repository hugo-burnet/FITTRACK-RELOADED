import type { Equipment, MeasurementType } from '@/data/types';
import { measurementShape } from '@/lib/measurement';

/**
 * Smallest load jump that is realistic for each equipment, in kilograms.
 *
 * Typed as `Record<Equipment, number>` so adding an equipment without an
 * increment fails typecheck — the same seam `MUSCLE_SCOPE` uses for drawable
 * regions. These are product defaults; the user can override per exercise.
 */
export const DEFAULT_LOAD_INCREMENT_KG: Record<Equipment, number> = {
  barbell: 2.5,
  dumbbell: 2,
  machine: 5,
  cable: 2.5,
  smith: 2.5,
  bodyweight: 2.5,
  band: 1,
  kettlebell: 4,
  plate: 2.5,
  other: 2.5,
};

export function defaultLoadIncrementKg(equipment: Equipment): number {
  return DEFAULT_LOAD_INCREMENT_KG[equipment];
}

/** Prefer a stored override; otherwise the equipment table. */
export function resolveLoadIncrementKg(exercise: {
  equipment: Equipment;
  loadIncrementKg?: number;
}): number {
  const override = exercise.loadIncrementKg;
  if (typeof override === 'number' && Number.isFinite(override) && override > 0) {
    return override;
  }
  return defaultLoadIncrementKg(exercise.equipment);
}

/** Under half a kilo, a "step" is more likely a typo or a float than a plate. */
const MIN_INFERRED_INCREMENT_KG = 0.5;

/**
 * The step a gym really offers, read from the loads actually lifted
 * (spec coach v2, R3.1): the smallest gap between consecutive distinct loads,
 * provided it shows up at least twice.
 *
 * The equipment table says 5 kg for a machine; a lifter who has loaded 10,
 * 12,5 and 15 kg on it has proved there is a 2,5 kg step. Twice, because one
 * odd load (6,125 kg on a cable stack) is not a grid, and inventing a +1,125 kg
 * step from it would be worse than the table.
 */
export function inferLoadIncrementKg(loads: readonly number[]): number | undefined {
  const distinct = [...new Set(loads.filter((load) => Number.isFinite(load) && load > 0))]
    .map((load) => Math.round(load * 1000) / 1000)
    .sort((a, b) => a - b)
    .filter((load, index, sorted) => index === 0 || load !== sorted[index - 1]);

  const gaps: number[] = [];
  for (let i = 1; i < distinct.length; i += 1) {
    gaps.push(Math.round((distinct[i]! - distinct[i - 1]!) * 1000) / 1000);
  }
  if (gaps.length === 0) return undefined;

  const smallest = Math.min(...gaps);
  if (smallest < MIN_INFERRED_INCREMENT_KG) return undefined;
  if (gaps.filter((gap) => gap === smallest).length < 2) return undefined;
  return smallest;
}

/**
 * Rounds a proposed load to the nearest available gym increment.
 *
 * This is deliberately independent of measurement type: callers that may put
 * a load on the bar have already established that the movement supports one.
 */
export function roundLoadToIncrement(load: number, increment: number): number | undefined {
  if (!Number.isFinite(load) || !Number.isFinite(increment) || increment <= 0) {
    return undefined;
  }

  const ratio = load / increment;
  // A mathematical half step can arrive just below .5 (8.6 / 0.4 is
  // 21.499999999999996), so scale the smallest representable nudge with the
  // quotient before applying the ordinary nearest-grid rule.
  const nearest = Math.round(ratio + Number.EPSILON * Math.max(1, Math.abs(ratio)));
  const rounded = nearest * increment;
  // Keep the result readable without assuming a fixed catalogue of increments.
  return Number.parseFloat(rounded.toPrecision(15));
}

function shiftLoad(
  current: number,
  increment: number,
  measurementType: MeasurementType,
  towards: 'harder' | 'easier',
): number {
  if (!(increment > 0) || !Number.isFinite(increment) || !Number.isFinite(current)) {
    return current;
  }

  const role = measurementShape(measurementType).weightRole;
  if (role === undefined) return current;

  // Assistance inverts twice over: the machine helps you up, so a harder set is
  // *less* weight on it. One sign flip for the role, one for the direction.
  const roleSign = role === 'assist' ? -1 : 1;
  const directionSign = towards === 'harder' ? 1 : -1;
  const raw = current + roleSign * directionSign * increment;
  // Une charge posée sur un demi-pas (12,5 kg sur une machine réglée à 5) fait
  // tomber le pas pile entre deux crans : 17,5 est à égale distance de 15 et 20.
  // `Math.round` tranche toujours vers le haut, donc vers 20 en montant — un pas
  // de 7,5 kg, +60 % sur un oiseau à 12,5 kg. L'égalité se tranche vers la charge
  // de départ : on ne s'éloigne jamais de plus d'un incrément.
  const ratio = raw / increment;
  const lower = Math.floor(ratio);
  const isTie = Math.abs(ratio - lower - 0.5) < 1e-9;
  const steps = isTie ? (raw > current ? lower : lower + 1) : Math.round(ratio);
  const rounded = steps * increment;
  // Float hygiene: 102.5 / 2.5 * 2.5 can still land at 102.50000000000001.
  const cleaned = Math.round(rounded * 1000) / 1000;
  return Math.max(0, cleaned);
}

/**
 * Next load for double progression. Rounds onto the increment grid.
 * Assistance inverts: progressing means taking weight *off* the machine.
 * Types with no weight field leave the value alone.
 */
export function nextLoad(
  current: number,
  increment: number,
  measurementType: MeasurementType,
): number {
  return shiftLoad(current, increment, measurementType, 'harder');
}

/**
 * One increment back down — the other half of double progression, for a range
 * missed twice in a row. Same grid, same rounding, mirrored direction.
 */
export function previousLoad(
  current: number,
  increment: number,
  measurementType: MeasurementType,
): number {
  return shiftLoad(current, increment, measurementType, 'easier');
}
