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
  const rounded = Math.round(raw / increment) * increment;
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
