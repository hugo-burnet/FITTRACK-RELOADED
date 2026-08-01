import { describe, expect, it } from 'vitest';
import { calculateDeloadWeight } from './deload';

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
