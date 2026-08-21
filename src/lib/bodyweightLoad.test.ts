import { describe, expect, it } from 'vitest';
import {
  defaultBodyweightLoadFactor,
  factorToPercent,
  isValidBodyweightFactorPercent,
  percentToFactor,
  supportsBodyweightLoad,
} from './bodyweightLoad';

describe('supportsBodyweightLoad', () => {
  it('ne retient que les types où les kilos côtoient un corps', () => {
    expect(supportsBodyweightLoad('reps_only')).toBe(true);
    expect(supportsBodyweightLoad('assisted_weight_reps')).toBe(true);
    expect(supportsBodyweightLoad('weight_reps')).toBe(false);
    expect(supportsBodyweightLoad('time_only')).toBe(false);
    expect(supportsBodyweightLoad('distance_time')).toBe(false);
  });
});

describe('defaultBodyweightLoadFactor', () => {
  it('compte tout le corps sur une traction au poids du corps', () => {
    expect(defaultBodyweightLoadFactor('reps_only', 'bodyweight')).toBe(1);
  });

  it('compte tout le corps sur une machine assistée, quel que soit le matériel', () => {
    expect(defaultBodyweightLoadFactor('assisted_weight_reps', 'machine')).toBe(1);
  });

  it.each(['band', 'cable', 'machine'] as const)(
    'ne suppose aucun corps quand la résistance vient de %s',
    (equipment) => {
      expect(defaultBodyweightLoadFactor('reps_only', equipment)).toBeUndefined();
    },
  );

  it('compte le corps sur une traction faite à une barre fixe classée « autre »', () => {
    expect(defaultBodyweightLoadFactor('reps_only', 'other')).toBe(1);
  });

  it('ne suppose aucun corps derrière une charge classique', () => {
    expect(defaultBodyweightLoadFactor('weight_reps', 'bodyweight')).toBeUndefined();
  });
});

describe('factorToPercent / percentToFactor', () => {
  it('fait l’aller-retour sans fantôme flottant', () => {
    expect(factorToPercent(0.7)).toBe(70);
    expect(percentToFactor(70)).toBe(0.7);
    expect(factorToPercent(percentToFactor(35))).toBe(35);
  });
});

describe('isValidBodyweightFactorPercent', () => {
  it('accepte de plus de 0 jusqu’à 100', () => {
    expect(isValidBodyweightFactorPercent(0.1)).toBe(true);
    expect(isValidBodyweightFactorPercent(100)).toBe(true);
    expect(isValidBodyweightFactorPercent(0)).toBe(false);
    expect(isValidBodyweightFactorPercent(120)).toBe(false);
    expect(isValidBodyweightFactorPercent(Number.NaN)).toBe(false);
  });
});
