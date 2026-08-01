import type { MeasurementType } from '@/data/types';
import { measurementShape } from './measurement';

export const DELOAD_PERCENT = 80;
export const DELOAD_INCREMENT_KG = 2.5;

export function isDeloadEligibleMeasurement(
  measurementType: MeasurementType | undefined,
): boolean {
  const role = measurementShape(measurementType ?? 'weight_reps').weightRole;
  return role !== undefined && role !== 'assist';
}

export function calculateDeloadWeight(weightKg: number): number {
  const reduced = weightKg * (DELOAD_PERCENT / 100);
  const rounded = Math.round(reduced / DELOAD_INCREMENT_KG) * DELOAD_INCREMENT_KG;
  return Number(rounded.toFixed(10));
}
