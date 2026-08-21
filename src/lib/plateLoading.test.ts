import { describe, expect, it } from 'vitest';
import type { Exercise } from '@/data/types';
import {
  defaultPlateBaseWeightKg,
  defaultPlateLoading,
  plateBaseWeightMatters,
  platesConfigFor,
  resolvePlateBaseWeightKg,
  resolvePlateLoading,
  sidesOf,
} from './plateLoading';

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

describe('defaultPlateLoading', () => {
  it.each(['barbell', 'smith'] as const)('met %s sur une barre', (equipment) => {
    expect(defaultPlateLoading(exercise({ equipment }))).toBe('barbell');
  });

  it('met la machine à plaques sur deux côtés sans barre', () => {
    expect(defaultPlateLoading(exercise({ equipment: 'plate' }))).toBe('two_sided');
  });

  it.each(['machine', 'cable', 'dumbbell', 'bodyweight', 'band', 'other'] as const)(
    'ne devine aucun chargement pour %s',
    (equipment) => {
      expect(defaultPlateLoading(exercise({ equipment }))).toBe('none');
    },
  );

  it('ne devine rien pour une charge ajoutée, même sur une barre', () => {
    expect(
      defaultPlateLoading(exercise({ equipment: 'barbell', measurementType: 'reps_only' })),
    ).toBe('none');
  });
});

describe('resolvePlateLoading', () => {
  it('préfère le réglage de la fiche à la déduction du matériel', () => {
    expect(
      resolvePlateLoading(exercise({ equipment: 'bodyweight', plateLoading: 'single_sided' })),
    ).toBe('single_sided');
  });

  it('respecte un « aucun » explicite sur une barre', () => {
    expect(resolvePlateLoading(exercise({ equipment: 'barbell', plateLoading: 'none' }))).toBe(
      'none',
    );
  });
});

describe('resolvePlateBaseWeightKg', () => {
  it('retient le poids de barre saisi sur la fiche', () => {
    expect(resolvePlateBaseWeightKg(exercise({ plateBaseWeightKg: 15 }))).toBe(15);
  });

  it('retombe sur 20 kg pour une barre, 0 ailleurs', () => {
    expect(resolvePlateBaseWeightKg(exercise())).toBe(20);
    expect(resolvePlateBaseWeightKg(exercise({ equipment: 'plate' }))).toBe(0);
  });

  it('accepte une barre à vide de 0 kg sans la remplacer par le défaut', () => {
    expect(resolvePlateBaseWeightKg(exercise({ plateBaseWeightKg: 0 }))).toBe(0);
  });
});

describe('sidesOf / plateBaseWeightMatters / defaultPlateBaseWeightKg', () => {
  it('ne compte qu’un côté sur un seul point de chargement', () => {
    expect(sidesOf('single_sided')).toBe(1);
    expect(sidesOf('two_sided')).toBe(2);
    expect(sidesOf('barbell')).toBe(2);
  });

  it('ne propose de régler la barre que là où il y en a une', () => {
    expect(plateBaseWeightMatters('barbell')).toBe(true);
    expect(plateBaseWeightMatters('two_sided')).toBe(false);
    expect(plateBaseWeightMatters('single_sided')).toBe(false);
  });

  it('donne 20 kg à une barre et rien aux autres', () => {
    expect(defaultPlateBaseWeightKg('barbell')).toBe(20);
    expect(defaultPlateBaseWeightKg('two_sided')).toBe(0);
    expect(defaultPlateBaseWeightKg('single_sided')).toBe(0);
    expect(defaultPlateBaseWeightKg('none')).toBe(0);
  });
});

describe('platesConfigFor', () => {
  it.each(['barbell', 'smith'] as const)('ouvre une barre de 20 kg pour %s', (equipment) => {
    expect(platesConfigFor(exercise({ equipment }))).toEqual({
      loading: 'barbell',
      barWeight: 20,
      sides: 2,
    });
  });

  it('garde la machine à plaques sur une base à vide', () => {
    expect(platesConfigFor(exercise({ equipment: 'plate' }))).toEqual({
      loading: 'two_sided',
      barWeight: 0,
      sides: 2,
    });
  });

  it('ne calcule rien tant que rien n’est réglé sur une traction', () => {
    expect(
      platesConfigFor(exercise({ equipment: 'bodyweight', measurementType: 'reps_only' })),
    ).toBeNull();
  });

  it('calcule le lest d’une traction dès que la fiche le dit', () => {
    expect(
      platesConfigFor(
        exercise({
          equipment: 'bodyweight',
          measurementType: 'reps_only',
          plateLoading: 'single_sided',
        }),
      ),
    ).toEqual({ loading: 'single_sided', barWeight: 0, sides: 1 });
  });

  it('se tait quand la fiche dit « aucun », même sur une barre', () => {
    expect(platesConfigFor(exercise({ plateLoading: 'none' }))).toBeNull();
  });
});
