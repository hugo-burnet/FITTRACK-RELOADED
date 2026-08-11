export type OneRepMaxFormula = 'epley' | 'brzycki' | 'lombardi';

const MAX_ESTIMATED_REPS = 12;

export function estimateOneRepMax(
  weightKg: number,
  reps: number,
  formula: OneRepMaxFormula,
): number | undefined {
  if (
    !Number.isFinite(weightKg) ||
    weightKg <= 0 ||
    !Number.isInteger(reps) ||
    reps < 1 ||
    reps > MAX_ESTIMATED_REPS
  ) {
    return undefined;
  }

  if (reps === 1) {
    return weightKg;
  }

  switch (formula) {
    case 'epley':
      return weightKg * (1 + reps / 30);
    case 'brzycki':
      return (weightKg * 36) / (37 - reps);
    case 'lombardi':
      return weightKg * reps ** 0.1;
  }
}
