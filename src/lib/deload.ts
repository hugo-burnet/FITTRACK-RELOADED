import type { MeasurementType } from '@/data/types';
import { measurementShape } from './measurement';

export const DELOAD_PERCENT = 80;
const DELOAD_INCREMENT_KG = 2.5;

export function isDeloadEligibleMeasurement(measurementType: MeasurementType | undefined): boolean {
  const role = measurementShape(measurementType ?? 'weight_reps').weightRole;
  return role !== undefined && role !== 'assist';
}

export function calculateDeloadWeight(weightKg: number): number {
  const reduced = weightKg * (DELOAD_PERCENT / 100);
  const rounded = Math.round(reduced / DELOAD_INCREMENT_KG) * DELOAD_INCREMENT_KG;
  // Small loads may round up or remain unchanged: retain the actual reduction.
  return Number(
    (rounded >= weightKg || (rounded === 0 && reduced > 0) ? reduced : rounded).toFixed(10),
  );
}
