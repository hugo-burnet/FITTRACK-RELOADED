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
