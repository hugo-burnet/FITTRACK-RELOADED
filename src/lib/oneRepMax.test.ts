import { describe, expect, it } from 'vitest';
import { estimateOneRepMax, repsToAbsorbStep } from './oneRepMax';

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

describe('repsToAbsorbStep', () => {
  it('donne les répétitions qui retombent au plancher après le cran (Epley)', () => {
    // Curl haltères : 10 kg, cran de 2 kg, fourchette 10–12.
    expect(repsToAbsorbStep(10, 12, 10)).toBe(18);
    // Élévations à la poulie : 5 kg, cran de 2,5 kg, 12–15 — le cran pèse +50 %.
    expect(repsToAbsorbStep(5, 7.5, 12)).toBe(33);
  });

  it('reste sous le plafond sur une charge lourde', () => {
    expect(repsToAbsorbStep(100, 102.5, 8)).toBe(9);
    expect(repsToAbsorbStep(70, 72.5, 10)).toBe(11);
  });

  it('tolère une demi-répétition, la précision d’Epley', () => {
    // Leg curl : 45 × 12 annonce 9,8 répétitions à 47,5 kg.
    expect(repsToAbsorbStep(45, 47.5, 10)).toBe(12);
    // Développé incliné, historique réel : 18 × 12 × 3 puis 20 × 8 × 3 — pile le plancher.
    expect(repsToAbsorbStep(18, 20, 8)).toBe(12);
  });

  it('ne gonfle pas un compte rond par un écart flottant', () => {
    // 30 × (1,2 × 4/3 − 1) vaut 18,000000000000004 en flottants.
    expect(repsToAbsorbStep(10, 12, 10)).toBe(18);
  });

  it('refuse une entrée sans sens', () => {
    expect(repsToAbsorbStep(0, 2, 10)).toBeUndefined();
    expect(repsToAbsorbStep(10, 10, 10)).toBeUndefined();
    expect(repsToAbsorbStep(10, 8, 10)).toBeUndefined();
  });
});
