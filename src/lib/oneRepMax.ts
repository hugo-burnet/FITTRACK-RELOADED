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

/**
 * Reps at `load` that, by Epley, carry over to the `floor` reps at `next`
 * (spec coach v2, R3.2).
 *
 * The step is the gym's — +2 kg on dumbbells, there is no choosing. What adapts
 * is how many reps the lifter needs before taking it: on a heavy bar the answer
 * sits under the ceiling of the range, on a 10 kg curl it is 18. Epley only,
 * whatever the user's display formula: it is the one whose inverse stays
 * readable, and this is a product rule, not a measurement.
 */
export function repsToAbsorbStep(load: number, next: number, floor: number): number | undefined {
  if (!(load > 0) || !(next > load) || !(floor > 0)) return undefined;
  const needed = 30 * ((next / load) * (1 + floor / 30) - 1);
  // À une demi-répétition près, pas au-delà : Epley ne prédit pas mieux. 45 × 12
  // au leg curl annonce 9,8 répétitions à 47,5 kg — un « 10 » —, et l'arrondi
  // supérieur réclamait une treizième répétition pour deux dixièmes. L'arrondi au
  // plus proche absorbe aussi l'écart flottant (18,000000000000004 pour un 18).
  return Math.round(needed);
}
