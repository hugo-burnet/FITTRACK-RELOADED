import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { seedDatabase } from '@/data/seed/seedDatabase';
import { resetDb } from '@/test/resetDb';
import {
  countExercises,
  createCustomExercise,
  deleteExercise,
  getExercise,
  listExercises,
  normalizeSearch,
  updateExercise,
} from './exercises';
import type { Exercise, Syncable } from '@/data/types';

const custom = (name: string): Omit<Exercise, keyof Syncable | 'isCustom' | 'slug'> => ({
  name,
  primaryMuscle: 'chest',
  secondaryMuscles: [],
  equipment: 'machine',
  measurementType: 'weight_reps',
  isUnilateral: 0,
});

describe('normalizeSearch', () => {
  it('retire les accents et la casse', () => {
    expect(normalizeSearch('Développé Couché')).toBe('developpe couche');
  });

  it('coupe les espaces de bord', () => {
    expect(normalizeSearch('  squat  ')).toBe('squat');
  });

  it('laisse intacte une chaîne déjà normalisée', () => {
    expect(normalizeSearch('rowing barre')).toBe('rowing barre');
  });
});

describe('listExercises', () => {
  beforeEach(resetDb);

  it('trouve un exercice accentué sans saisir les accents', async () => {
    await seedDatabase();
    const results = await listExercises({ search: 'developpe couche' });
    expect(results.some((e) => e.name.includes('Développé couché'))).toBe(true);
  });

  it('ignore la casse', async () => {
    await seedDatabase();
    expect(await listExercises({ search: 'SQUAT' })).not.toHaveLength(0);
  });

  it('exclut les exercices supprimés', async () => {
    const created = await createCustomExercise(custom('Machine à ramer maison'));
    await deleteExercise(created.id);
    const results = await listExercises({ search: created.name });
    expect(results).toHaveLength(0);
  });

  it('filtre par groupe musculaire', async () => {
    await seedDatabase();
    const results = await listExercises({ muscle: 'biceps' });
    expect(results).not.toHaveLength(0);
    expect(results.every((e) => e.primaryMuscle === 'biceps')).toBe(true);
  });

  it('filtre par équipement', async () => {
    await seedDatabase();
    const results = await listExercises({ equipment: 'kettlebell' });
    expect(results).not.toHaveLength(0);
    expect(results.every((e) => e.equipment === 'kettlebell')).toBe(true);
  });

  it('combine les deux filtres', async () => {
    await seedDatabase();
    const results = await listExercises({ muscle: 'chest', equipment: 'barbell' });
    expect(results).not.toHaveLength(0);
    expect(results.every((e) => e.primaryMuscle === 'chest' && e.equipment === 'barbell')).toBe(
      true,
    );
  });

  it('trie par nom en respectant les accents français', async () => {
    await seedDatabase();
    const names = (await listExercises()).map((e) => e.name);
    const sorted = [...names].sort((a, b) => a.localeCompare(b, 'fr'));
    expect(names).toEqual(sorted);
  });

  it('retourne tout le catalogue sans filtre', async () => {
    await seedDatabase();
    expect((await listExercises()).length).toBe(await db.exercises.count());
  });
});

describe('createCustomExercise', () => {
  beforeEach(resetDb);

  it('force isCustom à 1', async () => {
    const created = await createCustomExercise(custom('Tirage maison'));
    expect(created.isCustom).toBe(1);
    expect((await getExercise(created.id))!.isCustom).toBe(1);
  });

  it("n'attribue pas de slug — le slug appartient au catalogue", async () => {
    const created = await createCustomExercise(custom('Presse à cuisses maison'));
    expect(created.slug).toBeUndefined();
  });

  // Règle non négociable n°1 : aucune limite artificielle.
  it("n'impose aucune limite de nombre", async () => {
    for (let i = 0; i < 60; i += 1) await createCustomExercise(custom(`Exercice ${i}`));
    expect(await db.exercises.where('isCustom').equals(1).count()).toBe(60);
  });
});

describe('countExercises', () => {
  beforeEach(resetDb);

  it('compte le catalogue', async () => {
    await seedDatabase();
    expect(await countExercises()).toBe((await listExercises()).length);
  });

  it('ne compte pas les exercices supprimés', async () => {
    const created = await createCustomExercise(custom('À retirer du compte'));
    const before = await countExercises();

    await deleteExercise(created.id);

    expect(await countExercises()).toBe(before - 1);
  });
});

describe('getExercise', () => {
  beforeEach(resetDb);

  it('retourne undefined pour un identifiant inconnu', async () => {
    expect(await getExercise('inexistant')).toBeUndefined();
  });

  it('retourne undefined pour un exercice supprimé', async () => {
    const created = await createCustomExercise(custom('Éphémère'));
    await deleteExercise(created.id);
    expect(await getExercise(created.id)).toBeUndefined();
  });
});

describe('updateExercise', () => {
  beforeEach(resetDb);

  it('enregistre une note et bouge updatedAt sans toucher createdAt', async () => {
    const created = await createCustomExercise(custom('Presse à cuisses'));

    await updateExercise(created.id, { userNotes: 'siège position 4' });

    const after = await getExercise(created.id);
    expect(after!.userNotes).toBe('siège position 4');
    expect(after!.createdAt).toBe(created.createdAt);
    expect(after!.updatedAt).toBeGreaterThanOrEqual(created.updatedAt);
  });

  it('ignore silencieusement un identifiant inconnu', async () => {
    await expect(updateExercise('inexistant', { userNotes: 'x' })).resolves.toBeUndefined();
  });
});

describe('deleteExercise', () => {
  beforeEach(resetDb);

  it('supprime logiquement : la ligne reste en base', async () => {
    const created = await createCustomExercise(custom('À supprimer'));
    await deleteExercise(created.id);

    const row = await db.exercises.get(created.id);
    expect(row).toBeDefined();
    expect(row!.deletedAt).toBeGreaterThan(0);
  });
});
