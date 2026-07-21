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
