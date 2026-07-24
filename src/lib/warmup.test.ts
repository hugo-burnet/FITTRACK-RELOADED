import { describe, expect, it } from 'vitest';
import {
  calculateWarmupSets,
  DEFAULT_WARMUP_INCREMENT_KG,
  DEFAULT_WARMUP_STEPS,
} from './warmup';

describe('calculateWarmupSets', () => {
  it('calcule la rampe par défaut', () => {
    expect(
      calculateWarmupSets({
        targetWeightKg: 100,
        incrementKg: DEFAULT_WARMUP_INCREMENT_KG,
        steps: DEFAULT_WARMUP_STEPS,
      }),
    ).toEqual([
      { weightKg: 40, reps: 10 },
      { weightKg: 60, reps: 5 },
      { weightKg: 80, reps: 3 },
    ]);
  });

  it('arrondit chaque charge vers le bas au pas disponible', () => {
    expect(
      calculateWarmupSets({
        targetWeightKg: 102.5,
        incrementKg: 2.5,
        steps: DEFAULT_WARMUP_STEPS,
      }),
    ).toEqual([
      { weightKg: 40, reps: 10 },
      { weightKg: 60, reps: 5 },
      { weightKg: 80, reps: 3 },
    ]);
  });

  it('garde des décimales exactes sans fantôme flottant', () => {
    expect(
      calculateWarmupSets({
        targetWeightKg: 82.5,
        incrementKg: 0.5,
        steps: DEFAULT_WARMUP_STEPS,
      }),
    ).toEqual([
      { weightKg: 33, reps: 10 },
      { weightKg: 49.5, reps: 5 },
      { weightKg: 66, reps: 3 },
    ]);
  });

  it('respecte la charge physique minimale', () => {
    expect(
      calculateWarmupSets({
        targetWeightKg: 40,
        incrementKg: 2.5,
        minimumWeightKg: 20,
        steps: DEFAULT_WARMUP_STEPS,
      }),
    ).toEqual([
      { weightKg: 20, reps: 10 },
      { weightKg: 22.5, reps: 5 },
      { weightKg: 30, reps: 3 },
    ]);
  });

  it('écarte les résultats nuls ou qui atteignent la charge de travail', () => {
    expect(
      calculateWarmupSets({
        targetWeightKg: 20,
        incrementKg: 2.5,
        minimumWeightKg: 20,
        steps: DEFAULT_WARMUP_STEPS,
      }),
    ).toEqual([]);
  });

  it('conserve deux étapes explicitement demandées au même poids', () => {
    expect(
      calculateWarmupSets({
        targetWeightKg: 25,
        incrementKg: 2.5,
        minimumWeightKg: 20,
        steps: DEFAULT_WARMUP_STEPS,
      }),
    ).toEqual([
      { weightKg: 20, reps: 10 },
      { weightKg: 20, reps: 5 },
      { weightKg: 20, reps: 3 },
    ]);
  });

  it('accepte une liste vide et une liste arbitrairement longue', () => {
    expect(calculateWarmupSets({ targetWeightKg: 100, incrementKg: 2.5, steps: [] })).toEqual([]);

    const steps = Array.from({ length: 20 }, (_, index) => ({
      percentage: index + 1,
      reps: 1,
    }));
    expect(
      calculateWarmupSets({ targetWeightKg: 100, incrementKg: 0.5, steps }),
    ).toHaveLength(20);
  });

  it.each([
    [{ targetWeightKg: 0, incrementKg: 2.5, steps: [] }, 'targetWeightKg'],
    [{ targetWeightKg: Number.NaN, incrementKg: 2.5, steps: [] }, 'targetWeightKg'],
    [{ targetWeightKg: 100, incrementKg: 0, steps: [] }, 'incrementKg'],
    [{ targetWeightKg: 100, incrementKg: 2.5, minimumWeightKg: -1, steps: [] }, 'minimumWeightKg'],
    [
      { targetWeightKg: 100, incrementKg: 2.5, steps: [{ percentage: 0, reps: 5 }] },
      'percentage',
    ],
    [
      { targetWeightKg: 100, incrementKg: 2.5, steps: [{ percentage: 100, reps: 5 }] },
      'percentage',
    ],
    [
      { targetWeightKg: 100, incrementKg: 2.5, steps: [{ percentage: 40, reps: 0 }] },
      'reps',
    ],
    [
      { targetWeightKg: 100, incrementKg: 2.5, steps: [{ percentage: 40, reps: 2.5 }] },
      'reps',
    ],
  ])('refuse une entrée invalide : %s', (input, field) => {
    expect(() => calculateWarmupSets(input)).toThrow(new RangeError(field));
  });
});
