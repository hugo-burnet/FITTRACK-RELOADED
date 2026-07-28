import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { EQUIPMENT, MEASUREMENT_TYPES, MUSCLE_GROUPS } from '@/data/types';
import type { Exercise } from '@/data/types';
import { newEntity } from '@/data/repositories/base';
import { resetDb } from '@/test/resetDb';
import { seedDatabase } from './seedDatabase';
import catalogue from './exercises.json';

describe('seedDatabase', () => {
  beforeEach(resetDb);

  it('insère le catalogue au premier lancement', async () => {
    await seedDatabase();
    expect(await db.exercises.count()).toBeGreaterThan(50);
  });

  it("ne duplique rien lorsqu'il est relancé", async () => {
    await seedDatabase();
    const first = await db.exercises.count();
    await seedDatabase();
    expect(await db.exercises.count()).toBe(first);
  });

  it("préserve les modifications de l'utilisateur", async () => {
    await seedDatabase();
    const exercise = await db.exercises.orderBy('name').first();
    await db.exercises.update(exercise!.id, { userNotes: 'siège position 4' });

    await seedDatabase();

    const after = await db.exercises.get(exercise!.id);
    expect(after!.userNotes).toBe('siège position 4');
  });

  it("n'écrase pas les exercices personnalisés", async () => {
    await seedDatabase();
    await db.exercises.add(
      newEntity<Exercise>({
        name: 'Mon exercice à moi',
        primaryMuscle: 'chest',
        secondaryMuscles: [],
        equipment: 'machine',
        measurementType: 'weight_reps',
        isCustom: 1,
        isUnilateral: 0,
      }),
    );

    await seedDatabase();

    // Works because isCustom is a 0 | 1 and not a boolean: with `true` this very
    // query would throw a DataError. Architecture §3 in action.
    const custom = await db.exercises.where('isCustom').equals(1).toArray();
    expect(custom).toHaveLength(1);
  });

  it('ne ressuscite pas un exercice du catalogue supprimé par l’utilisateur', async () => {
    await seedDatabase();
    const exercise = await db.exercises.orderBy('name').first();
    await db.exercises.update(exercise!.id, { deletedAt: Date.now() });
    const countAfterDelete = await db.exercises.count();

    await seedDatabase();

    expect(await db.exercises.count()).toBe(countAfterDelete);
  });

  it('marque tout le catalogue comme non personnalisé', async () => {
    await seedDatabase();
    const custom = await db.exercises.where('isCustom').equals(1).count();
    expect(custom).toBe(0);
  });
});

describe('catalogue exercises.json', () => {
  it('a des slugs uniques', () => {
    const slugs = catalogue.map((entry) => entry.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('a des noms uniques', () => {
    const names = catalogue.map((entry) => entry.name);
    expect(new Set(names).size).toBe(names.length);
  });

  // A typo in a muscle or an equipment produces an exercise that no filter of
  // Lot 3 can ever reach. Nothing else in the stack catches it: JSON is not
  // typechecked.
  it("n'utilise que des valeurs connues", () => {
    for (const entry of catalogue) {
      expect(MUSCLE_GROUPS, entry.slug).toContain(entry.primaryMuscle);
      expect(EQUIPMENT, entry.slug).toContain(entry.equipment);
      expect(MEASUREMENT_TYPES, entry.slug).toContain(entry.measurementType);
      expect([0, 1], entry.slug).toContain(entry.isUnilateral);
      for (const muscle of entry.secondaryMuscles) {
        expect(MUSCLE_GROUPS, entry.slug).toContain(muscle);
      }
    }
  });

  it('couvre tous les groupes musculaires', () => {
    const covered = new Set(catalogue.map((entry) => entry.primaryMuscle));
    expect([...MUSCLE_GROUPS].filter((muscle) => !covered.has(muscle))).toEqual([]);
  });

  it('couvre tous les équipements', () => {
    const covered = new Set(catalogue.map((entry) => entry.equipment));
    expect([...EQUIPMENT].filter((equipment) => !covered.has(equipment))).toEqual([]);
  });

  it('couvre tous les types de mesure', () => {
    const covered = new Set(catalogue.map((entry) => entry.measurementType));
    expect([...MEASUREMENT_TYPES].filter((type) => !covered.has(type))).toEqual([]);
  });
});

describe('réconciliation de la classification', () => {
  beforeEach(resetDb);

  it('réaligne le muscle d’une fiche du catalogue livrée avec une erreur', async () => {
    // Le défaut trouvé en usage : le semis n'ajoutait que les slugs manquants,
    // donc la correction d'un muscle mal classé n'atteignait JAMAIS un
    // téléphone où l'app était déjà installée. Et « Réparer l'historique »
    // relisant cette bibliothèque, il recopiait consciencieusement l'erreur.
    await seedDatabase();
    const row = (await db.exercises.toArray()).find((e) => e.slug === 'seated-cable-row');
    await db.exercises.update(row!.id, { primaryMuscle: 'lats', updatedAt: 1 });

    await seedDatabase();

    const fixed = await db.exercises.get(row!.id);
    expect(fixed!.primaryMuscle).toBe('upper_back');
    // La ligne a vraiment changé : la synchronisation future doit la voir.
    expect(fixed!.updatedAt).toBeGreaterThan(1);
  });

  it('ne touche ni au nom, ni aux notes, ni au repos par défaut', async () => {
    // La classification appartient à l'app ; le reste appartient à
    // l'utilisateur. « Siège position 4 » est l'exemple même du Lot 3.
    await seedDatabase();
    const row = (await db.exercises.toArray()).find((e) => e.slug === 'seated-cable-row');
    await db.exercises.update(row!.id, {
      primaryMuscle: 'lats',
      name: 'Mon tirage à moi',
      userNotes: 'Siège position 4',
      defaultRestSeconds: 210,
    });

    await seedDatabase();

    const kept = await db.exercises.get(row!.id);
    expect(kept!.primaryMuscle).toBe('upper_back');
    expect(kept!.name).toBe('Mon tirage à moi');
    expect(kept!.userNotes).toBe('Siège position 4');
    expect(kept!.defaultRestSeconds).toBe(210);
  });

  it('laisse les exercices personnalisés entièrement tranquilles', async () => {
    const mine = newEntity<Exercise>({
      name: 'Machine de ma salle',
      primaryMuscle: 'chest',
      secondaryMuscles: [],
      equipment: 'machine',
      measurementType: 'weight_reps',
      isCustom: 1,
      isUnilateral: 0,
    });
    await db.exercises.add(mine);

    await seedDatabase();

    expect((await db.exercises.get(mine.id))!.primaryMuscle).toBe('chest');
  });

  it('n’écrit rien quand tout est déjà d’accord', async () => {
    await seedDatabase();
    const before = (await db.exercises.toArray()).find((e) => e.slug === 'seated-cable-row');

    await seedDatabase();

    expect((await db.exercises.get(before!.id))!.updatedAt).toBe(before!.updatedAt);
  });

  it('réaligne aussi une fiche supprimée, qui reste celle qui a été pratiquée', async () => {
    await seedDatabase();
    const row = (await db.exercises.toArray()).find((e) => e.slug === 'seated-cable-row');
    await db.exercises.update(row!.id, { primaryMuscle: 'lats', deletedAt: 5_000 });

    await seedDatabase();

    const fixed = await db.exercises.get(row!.id);
    expect(fixed!.primaryMuscle).toBe('upper_back');
    expect(fixed!.deletedAt).toBe(5_000);
  });
});
