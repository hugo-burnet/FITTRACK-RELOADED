import { describe, expect, it } from 'vitest';
import type { Exercise } from '@/data/types';
import catalogueRows from '@/data/seed/exercises.json';
import type { CatalogueExercise } from '@/data/seed/seedDatabase';
import { externalExerciseIdentityKey } from '@/lib/externalExerciseIdentity';
import { filterHevyMappingExercises } from './hevyExerciseMappingFilters';
import type { HevyMappingDraftRow } from './hevyImportDraft';

const exercise = (name: string, over: Partial<Exercise> = {}): Exercise => ({
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

const catalogue = (catalogueRows as CatalogueExercise[]).map(
  (entry): Exercise => ({
    ...entry,
    id: entry.slug,
    createdAt: 1,
    updatedAt: 1,
    deletedAt: 0,
    isCustom: 0,
  }),
);

function catalogueExercise(slug: string): Exercise {
  const found = catalogue.find((candidate) => candidate.slug === slug);
  if (found === undefined) throw new Error(`Missing catalogue slug: ${slug}`);
  return found;
}

const row = (
  sourceTitle: string,
  suggestions: readonly Exercise[] = [],
): HevyMappingDraftRow => ({
  source: { sourceTitle, measurementType: 'weight_reps', equipment: 'cable' },
  review: {
    status: 'needs_confirmation',
    identityKey: externalExerciseIdentityKey(sourceTitle),
    observation: {
      source: 'hevy_csv',
      sourceTitle,
      measurementType: 'weight_reps',
      equipmentHint: 'cable',
      sessionCount: 0,
      setCount: 0,
      examples: [],
    },
    suggestions: suggestions.map((candidate) => ({
      exercise: candidate,
    })),
  },
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

  it('préserve les suggestions du registre avant le classement lexical avec le vrai catalogue', () => {
    const pallof = catalogueExercise('pallof-press');
    const shoulderPress = catalogueExercise('cable-shoulder-press');
    const sourceRow = row(
      'Développé Debout Poulie Centrée',
      [pallof, shoulderPress],
    );

    const list = filterHevyMappingExercises(
      catalogue,
      sourceRow,
      '',
    );

    expect(list[0]?.slug).toBe('pallof-press');
    expect(list.indexOf(pallof)).toBeLessThan(
      list.indexOf(shoulderPress),
    );
    expect(new Set(list.map((candidate) => candidate.id)).size).toBe(
      list.length,
    );
  });

  it('exclut toujours les exercices supprimés', () => {
    const deleted = exercise('Ancienne presse', { deletedAt: 2 });
    const alive = exercise('Presse active');

    expect(
      filterHevyMappingExercises(
        [deleted, alive],
        row('Presse', [deleted]),
        '',
      ).map((candidate) => candidate.id),
    ).toEqual([alive.id]);
  });
});
