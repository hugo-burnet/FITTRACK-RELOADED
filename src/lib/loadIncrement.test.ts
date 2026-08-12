import { describe, expect, it } from 'vitest';
import { EQUIPMENT, type Equipment, MEASUREMENT_TYPES } from '@/data/types';
import {
  DEFAULT_LOAD_INCREMENT_KG,
  defaultLoadIncrementKg,
  nextLoad,
  previousLoad,
  resolveLoadIncrementKg,
} from './loadIncrement';

describe('DEFAULT_LOAD_INCREMENT_KG', () => {
  it('covers every equipment so a new enum value fails the typecheck and this table', () => {
    for (const equipment of EQUIPMENT) {
      expect(DEFAULT_LOAD_INCREMENT_KG[equipment]).toBeGreaterThan(0);
    }
  });
});

describe('defaultLoadIncrementKg', () => {
  it('returns the table value for each equipment', () => {
    for (const equipment of EQUIPMENT) {
      expect(defaultLoadIncrementKg(equipment)).toBe(DEFAULT_LOAD_INCREMENT_KG[equipment]);
    }
  });
});

describe('resolveLoadIncrementKg', () => {
  it('uses the exercise override when present', () => {
    expect(
      resolveLoadIncrementKg({ equipment: 'barbell', loadIncrementKg: 1.25 }),
    ).toBe(1.25);
  });

  it('falls back to the equipment default when the override is absent', () => {
    expect(resolveLoadIncrementKg({ equipment: 'dumbbell' })).toBe(
      DEFAULT_LOAD_INCREMENT_KG.dumbbell,
    );
  });

  it('falls back when the override is not a positive finite number', () => {
    expect(
      resolveLoadIncrementKg({ equipment: 'machine', loadIncrementKg: 0 }),
    ).toBe(DEFAULT_LOAD_INCREMENT_KG.machine);
    expect(
      resolveLoadIncrementKg({ equipment: 'machine', loadIncrementKg: -2.5 }),
    ).toBe(DEFAULT_LOAD_INCREMENT_KG.machine);
    expect(
      resolveLoadIncrementKg({ equipment: 'machine', loadIncrementKg: Number.NaN }),
    ).toBe(DEFAULT_LOAD_INCREMENT_KG.machine);
  });
});

describe('nextLoad', () => {
  it.each(MEASUREMENT_TYPES)(
    'returns a finite non-negative number for measurement type %s',
    (measurementType) => {
      const result = nextLoad(50, 2.5, measurementType);
      expect(Number.isFinite(result)).toBe(true);
      expect(result).toBeGreaterThanOrEqual(0);
    },
  );

  it('raises load on weight_reps (load role)', () => {
    expect(nextLoad(100, 2.5, 'weight_reps')).toBe(102.5);
  });

  it('raises load on reps_only (added role)', () => {
    expect(nextLoad(10, 2.5, 'reps_only')).toBe(12.5);
  });

  it('raises load on weight_time (load role)', () => {
    expect(nextLoad(20, 5, 'weight_time')).toBe(25);
  });

  it('lowers assistance on assisted_weight_reps (assist role)', () => {
    expect(nextLoad(40, 5, 'assisted_weight_reps')).toBe(35);
  });

  it('does not go below zero when assisting', () => {
    expect(nextLoad(2.5, 5, 'assisted_weight_reps')).toBe(0);
  });

  it('rounds to the increment multiple after the step', () => {
    // 100.4 + 2.5 = 102.9 → nearest 2.5 multiple is 102.5.
    expect(nextLoad(100.4, 2.5, 'weight_reps')).toBe(102.5);
    // Off-grid start: 47 + 2.5 = 49.5 → nearest 2.5 multiple is 50.
    expect(nextLoad(47, 2.5, 'weight_reps')).toBe(50);
  });

  it('leaves time_only and distance_time unchanged (no weight role)', () => {
    expect(nextLoad(60, 2.5, 'time_only')).toBe(60);
    expect(nextLoad(1000, 2.5, 'distance_time')).toBe(1000);
  });

  it('uses a positive increment even if a bad value is passed', () => {
    expect(nextLoad(100, 0, 'weight_reps')).toBe(100);
    expect(nextLoad(100, -2.5, 'weight_reps')).toBe(100);
  });
});

describe('equipment defaults are gym-credible', () => {
  const expected: Record<Equipment, number> = {
    barbell: 2.5,
    dumbbell: 2,
    machine: 5,
    cable: 2.5,
    smith: 2.5,
    bodyweight: 2.5,
    band: 1,
    kettlebell: 4,
    plate: 2.5,
    other: 2.5,
  };

  it.each(EQUIPMENT)('%s', (equipment) => {
    expect(DEFAULT_LOAD_INCREMENT_KG[equipment]).toBe(expected[equipment]);
  });
});

describe('previousLoad', () => {
  it('steps one increment down on a loaded bar', () => {
    expect(previousLoad(100, 2.5, 'weight_reps')).toBe(97.5);
  });

  it('adds assistance instead of removing it, because more help is easier', () => {
    expect(previousLoad(40, 5, 'assisted_weight_reps')).toBe(45);
  });

  it('never goes under zero on added load', () => {
    expect(previousLoad(2.5, 5, 'reps_only')).toBe(0);
  });

  it('rounds back onto the increment grid like its twin', () => {
    expect(previousLoad(100.4, 2.5, 'weight_reps')).toBe(97.5);
  });

  it('leaves a type with no weight field alone', () => {
    expect(previousLoad(60, 2.5, 'time_only')).toBe(60);
  });

  it('is the exact inverse of nextLoad on the grid', () => {
    const start = 80;
    expect(previousLoad(nextLoad(start, 2.5, 'weight_reps'), 2.5, 'weight_reps')).toBe(start);
    expect(
      previousLoad(nextLoad(start, 5, 'assisted_weight_reps'), 5, 'assisted_weight_reps'),
    ).toBe(start);
  });
});
