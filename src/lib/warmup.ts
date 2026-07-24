export interface WarmupStep {
  percentage: number;
  reps: number;
}

export interface WarmupInput {
  targetWeightKg: number;
  incrementKg: number;
  minimumWeightKg?: number;
  steps: readonly WarmupStep[];
}

export interface WarmupSetSuggestion {
  weightKg: number;
  reps: number;
}

export const DEFAULT_WARMUP_INCREMENT_KG = 2.5;

export const DEFAULT_WARMUP_STEPS: readonly WarmupStep[] = [
  { percentage: 40, reps: 10 },
  { percentage: 60, reps: 5 },
  { percentage: 80, reps: 3 },
];

const CENTS_PER_KG = 100;

function positiveFinite(value: number, field: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(field);
}

/**
 * RF-29 — an explicit ramp, never a hidden prescription.
 *
 * Weights are reduced to integer hundredths before they are rounded down to the
 * available increment. Downward is deliberate: a suggestion never exceeds the
 * percentage the user asked for.
 */
export function calculateWarmupSets(input: WarmupInput): WarmupSetSuggestion[] {
  positiveFinite(input.targetWeightKg, 'targetWeightKg');
  positiveFinite(input.incrementKg, 'incrementKg');

  const minimum = input.minimumWeightKg ?? 0;
  if (!Number.isFinite(minimum) || minimum < 0) throw new RangeError('minimumWeightKg');

  const targetCents = Math.round(input.targetWeightKg * CENTS_PER_KG);
  const incrementCents = Math.round(input.incrementKg * CENTS_PER_KG);
  const minimumCents = Math.round(minimum * CENTS_PER_KG);

  return input.steps.flatMap((step) => {
    if (!Number.isFinite(step.percentage) || step.percentage <= 0 || step.percentage >= 100) {
      throw new RangeError('percentage');
    }
    if (!Number.isInteger(step.reps) || step.reps <= 0) throw new RangeError('reps');

    const rawCents = Math.floor((targetCents * step.percentage) / 100);
    const roundedCents = Math.floor(rawCents / incrementCents) * incrementCents;
    const weightCents = Math.max(roundedCents, minimumCents);

    if (weightCents <= 0 || weightCents >= targetCents) return [];
    return [{ weightKg: weightCents / CENTS_PER_KG, reps: step.reps }];
  });
}
