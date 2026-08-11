import { describe, expect, it } from 'vitest';
import { estimateOneRepMax } from './oneRepMax';

describe('estimateOneRepMax', () => {
  it.each([
    ['epley', 116.66666666666667],
    ['brzycki', 112.5],
    ['lombardi', 117.4618943088019],
  ] as const)('estimates 100 kg x 5 with %s', (formula, expected) => {
    expect(estimateOneRepMax(100, 5, formula)).toBeCloseTo(expected, 10);
  });

  it.each(['epley', 'brzycki', 'lombardi'] as const)(
    'returns the exact load for one rep with %s',
    (formula) => expect(estimateOneRepMax(137.5, 1, formula)).toBe(137.5),
  );

  it.each([
    [0, 5],
    [-1, 5],
    [Number.NaN, 5],
    [100, 0],
    [100, 13],
    [100, 2.5],
  ])('rejects weight %s and reps %s', (weight, reps) => {
    expect(estimateOneRepMax(weight, reps, 'epley')).toBeUndefined();
  });
});
