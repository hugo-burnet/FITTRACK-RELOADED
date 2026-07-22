import { beforeEach, describe, expect, it } from 'vitest';
import { getRoutineDetail, listRoutineSummaries } from '@/data/repositories/routines';
import { resetDb } from '@/test/resetDb';
import catalogue from './exercises.json';
import { ROUTINE_TEMPLATES, instantiateTemplate } from './routineTemplates';
import { seedDatabase } from './seedDatabase';
import type { RoutineTemplate } from './routineTemplates';

const CATALOGUE_SLUGS = new Set((catalogue as { slug: string }[]).map((row) => row.slug));

const template = (key: string): RoutineTemplate => {
  const found = ROUTINE_TEMPLATES.find((row) => row.key === key);
  if (found === undefined) throw new Error(`modèle ${key} absent`);
  return found;
};

describe('ROUTINE_TEMPLATES', () => {
  /**
   * The Lot 2 lesson, transposed: a typo in a slug produces a routine that is
   * silently missing an exercise, and nothing in the stack reports it.
   */
  it('ne cite que des slugs qui existent au catalogue', () => {
    const unknown = ROUTINE_TEMPLATES.flatMap((row) =>
      row.exercises.map((entry) => entry.slug).filter((slug) => !CATALOGUE_SLUGS.has(slug)),
    );
    expect(unknown).toEqual([]);
  });

  it('a des clés uniques', () => {
    const keys = ROUTINE_TEMPLATES.map((row) => row.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('ne propose aucune charge cible', () => {
    const withWeight = ROUTINE_TEMPLATES.flatMap((row) =>
      row.exercises.filter((entry) => 'targetWeight' in entry),
    );
    expect(withWeight).toEqual([]);
  });

  it('ne déclare que des supersets d’au moins deux exercices consécutifs', () => {
    for (const row of ROUTINE_TEMPLATES) {
      const groups = row.exercises.map((entry) => entry.superset ?? 0);
      for (const group of new Set(groups.filter((value) => value !== 0))) {
        const first = groups.indexOf(group);
        const last = groups.lastIndexOf(group);
        expect(last - first + 1, `${row.key} groupe ${group}`).toBeGreaterThan(1);
        // Contigu : aucune autre valeur entre le premier et le dernier membre.
        expect(groups.slice(first, last + 1).every((value) => value === group)).toBe(true);
      }
    }
  });
});

describe('instantiateTemplate', () => {
  beforeEach(async () => {
    await resetDb();
    await seedDatabase();
  });

  it('produit une routine complète, avec ses séries et ses fourchettes', async () => {
    const routine = await instantiateTemplate(template('five-by-five-a'));
    const detail = await getRoutineDetail(routine.id);

    expect(detail?.routine.name).toBe('5×5 — A');
    expect(detail?.exercises).toHaveLength(3);
    expect(detail?.exercises.map((line) => line.sets.length)).toEqual([5, 5, 5]);
    expect(detail?.exercises.map((line) => line.exercise?.name)).toEqual([
      'Squat (barre, nuque)',
      'Développé couché (barre)',
      'Rowing barre',
    ]);
    expect(detail?.exercises[0]?.sets[0]).toMatchObject({ targetReps: 5, order: 0 });
    expect(detail?.exercises[0]?.sets[0]?.targetWeight).toBeUndefined();
  });

  it('conserve le superset du modèle', async () => {
    const routine = await instantiateTemplate(template('ppl-push'));
    const detail = await getRoutineDetail(routine.id);
    expect(detail?.exercises.map((line) => line.row.supersetGroup)).toEqual([0, 0, 0, 0, 1, 1]);
  });

  // Un modèle est un point de départ : la routine produite appartient à l'utilisateur.
  it('produit une routine ordinaire, que rien ne fait revenir', async () => {
    await instantiateTemplate(template('full-body'));
    expect(await listRoutineSummaries()).toHaveLength(1);

    // Le seed du catalogue retourne : il ne recrée aucune routine.
    await seedDatabase();
    expect(await listRoutineSummaries()).toHaveLength(1);
  });

  it('instancier deux fois donne deux routines indépendantes', async () => {
    const first = await instantiateTemplate(template('full-body'));
    const second = await instantiateTemplate(template('full-body'));

    expect(first.id).not.toBe(second.id);
    const summaries = await listRoutineSummaries();
    expect(summaries).toHaveLength(2);
    expect(summaries.map((row) => row.routine.order)).toEqual([0, 1]);
  });
});
