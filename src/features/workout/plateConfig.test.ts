import { describe, expect, it } from 'vitest';
import type { Exercise } from '@/data/types';
import { platesConfigFor } from './plateConfig';

const exercise = (overrides: Partial<Exercise> = {}): Exercise => ({
  id: 'exercise',
  name: 'Développé couché',
  primaryMuscle: 'chest',
  secondaryMuscles: [],
  equipment: 'barbell',
  measurementType: 'weight_reps',
  isCustom: 0,
  isUnilateral: 0,
  createdAt: 1,
  updatedAt: 1,
  deletedAt: 0,
  ...overrides,
});

describe('platesConfigFor', () => {
  it.each(['barbell', 'smith'] as const)(
    'autorise le réglage du poids de barre pour %s',
    (equipment) => {
      expect(platesConfigFor(exercise({ equipment }))).toEqual({
        barWeight: 20,
        sides: 2,
        barWeightAdjustable: true,
      });
    },
  );

  it('garde la machine à plaques sur une base fixe sans faux réglage de barre', () => {
    expect(platesConfigFor(exercise({ equipment: 'plate' }))).toEqual({
      barWeight: 0,
      sides: 2,
      barWeightAdjustable: false,
    });
  });

  it('refuse une charge ajoutée même avec un équipement de barre', () => {
    expect(
      platesConfigFor(exercise({ equipment: 'barbell', measurementType: 'reps_only' })),
    ).toBeNull();
  });
});
