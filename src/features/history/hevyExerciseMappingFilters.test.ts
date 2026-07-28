import { describe, expect, it } from 'vitest';
import type { Exercise, Syncable } from '@/data/types';
import { filterHevyMappingExercises } from './hevyExerciseMappingFilters';
import type { HevyMappingDraftRow } from './hevyImportDraft';

const exercise = (name: string, over: Partial<Omit<Exercise, keyof Syncable>> = {}): Exercise => ({
  id: name,
  createdAt: 1,
  updatedAt: 1,
  deletedAt: 0,
  name,
  primaryMuscle: 'chest',
  secondaryMuscles: [],
  equipment: 'cable',
  measurementType: 'weight_reps',
  isCustom: 0,
  isUnilateral: 0,
  ...over,
});

const row = (sourceTitle: string): HevyMappingDraftRow => ({
  source: { sourceTitle, measurementType: 'weight_reps', equipment: 'cable' },
});

describe('filterHevyMappingExercises', () => {
  it('met le candidat le plus vraisemblable en tête de liste', () => {
    // La vraisemblance garde un rôle — mais celui-ci, et pas celui de réponse.
    // L'app dit « voilà l'ordre le plus probable », pas « c'est celui-là » :
    // le geste reste à l'utilisateur, et les alternatives sont sous ses yeux.
    const catalogue = [
      exercise('Crunch à la poulie haute', { primaryMuscle: 'abs' }),
      exercise('Rotation externe (poulie)', { primaryMuscle: 'shoulders' }),
      exercise('Curl à la poulie basse', { primaryMuscle: 'biceps' }),
    ];

    const list = filterHevyMappingExercises(catalogue, row('Rotation Externe Poulie'), '');

    expect(list[0]!.name).toBe('Rotation externe (poulie)');
    expect(list).toHaveLength(3);
  });

  it('n’écarte jamais un candidat compatible, il ne fait que les ordonner', () => {
    const catalogue = [exercise('Sans rapport'), exercise('Rotation externe (poulie)')];

    const list = filterHevyMappingExercises(catalogue, row('Rotation Externe Poulie'), '');

    expect(list.map((entry) => entry.name)).toContain('Sans rapport');
  });

  it('respecte la recherche, le muscle et le matériel', () => {
    const catalogue = [
      exercise('Rotation externe (poulie)', { primaryMuscle: 'shoulders' }),
      exercise('Rotation externe (élastique)', { primaryMuscle: 'shoulders', equipment: 'band' }),
    ];

    expect(
      filterHevyMappingExercises(catalogue, row('Rotation Externe Poulie'), 'elast'),
    ).toHaveLength(1);
    expect(
      filterHevyMappingExercises(catalogue, row('Rotation Externe Poulie'), '', 'shoulders', 'band'),
    ).toHaveLength(1);
  });

  it('écarte une mesure incompatible', () => {
    const catalogue = [exercise('Gainage', { measurementType: 'time_only' })];

    expect(filterHevyMappingExercises(catalogue, row('Rotation Externe Poulie'), '')).toEqual([]);
  });
});
