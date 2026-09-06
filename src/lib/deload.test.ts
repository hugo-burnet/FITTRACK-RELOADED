import { describe, expect, it } from 'vitest';
import { calculateDeloadWeight, isDeloadEligibleMeasurement } from './deload';

describe('calculateDeloadWeight', () => {
  it.each([
    [100, 80],
    [82.5, 65],
    [102.5, 82.5],
    [60, 47.5],
  ])('reduces %s kg to %s kg', (weightKg, expected) => {
    expect(calculateDeloadWeight(weightKg)).toBe(expected);
  });

  /*
   * L'arrondi au pas de 2,5 kg suppose des charges où 2,5 kg est petit. En bas
   * de l'échelle il retournait l'intention : 2 kg devenaient 2,5 — un
   * allègement qui *alourdit* — et 5 kg restaient 5. Sous le pas, la réduction
   * exacte vaut mieux qu'un arrondi qui ment, et le libellé le dit.
   */
  it.each([
    [2, 1.6],
    [5, 4],
    [1, 0.8],
  ])('réduit %s kg à %s kg plutôt que d’arrondir vers le haut', (weightKg, expected) => {
    expect(calculateDeloadWeight(weightKg)).toBe(expected);
  });
});

describe('isDeloadEligibleMeasurement', () => {
  it.each(['weight_reps', 'reps_only', 'weight_time', undefined] as const)(
    'accepts a reducible load for %s',
    (measurementType) => {
      expect(isDeloadEligibleMeasurement(measurementType)).toBe(true);
    },
  );

  it.each(['time_only', 'distance_time', 'assisted_weight_reps'] as const)(
    'rejects a non-reducible load for %s',
    (measurementType) => {
      expect(isDeloadEligibleMeasurement(measurementType)).toBe(false);
    },
  );
});
