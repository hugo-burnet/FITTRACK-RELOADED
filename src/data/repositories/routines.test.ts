import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { resetDb } from '@/test/resetDb';
import { createCustomExercise, deleteExercise } from './exercises';
import {
  addExercisesToRoutine,
  addRoutineSet,
  applyToAllSets,
  countRoutinesInFolder,
  createFolder,
  createRoutine,
  deleteFolder,
  deleteRoutine,
  deleteRoutineSet,
  duplicateRoutine,
  getRoutineDetail,
  groupWithPrevious,
  listFolders,
  listRoutineSummaries,
  removeRoutineExercise,
  reorderRoutineExercises,
  reorderRoutines,
  ungroupSuperset,
  updateRoutine,
  updateRoutineSet,
} from './routines';
import type { RoutineDetail, RoutineExerciseDetail } from './routines';
import type { Exercise } from '@/data/types';

/**
 * Nth element, loudly. `noUncheckedIndexedAccess` is on, and answering it with
 * `?.` everywhere would turn a broken setup into a test that quietly asserts
 * `undefined === undefined`.
 */
function at<T>(list: readonly T[], index: number): T {
  const found = list[index];
  if (found === undefined) throw new Error(`élément ${index} absent (${list.length} au total)`);
  return found;
}

const exercise = (name: string): Promise<Exercise> =>
  createCustomExercise({
    name,
    primaryMuscle: 'chest',
    secondaryMuscles: [],
    equipment: 'barbell',
    measurementType: 'weight_reps',
    isUnilateral: 0,
  });

/** A routine holding `labels.length` exercises, one blank set each. */
async function routineWith(name: string, labels: string[]) {
  const routine = await createRoutine(name);
  const exercises: Exercise[] = [];
  for (const label of labels) exercises.push(await exercise(label));
  await addExercisesToRoutine(
    routine.id,
    exercises.map((row) => row.id),
  );
  return { routine, exercises };
}

async function detail(id: string): Promise<RoutineDetail> {
  const found = await getRoutineDetail(id);
  if (found === null) throw new Error('routine introuvable');
  return found;
}

/** Nth exercise line of a routine, re-read from the database. */
const line = async (routineId: string, index: number): Promise<RoutineExerciseDetail> =>
  at((await detail(routineId)).exercises, index);

const names = async (id: string) => (await detail(id)).exercises.map((e) => e.exercise?.name);
const groups = async (id: string) => (await detail(id)).exercises.map((e) => e.row.supersetGroup);
const orders = async (id: string) => (await detail(id)).exercises.map((e) => e.row.order);

beforeEach(resetDb);

describe('dossiers', () => {
  it('trie par ordre de création', async () => {
    await createFolder('Push / Pull / Legs');
    await createFolder('Bloc force');
    expect((await listFolders()).map((f) => f.name)).toEqual(['Push / Pull / Legs', 'Bloc force']);
  });

  it('compte les routines qu’il contient', async () => {
    const folder = await createFolder('PPL');
    await createRoutine('Poussée', folder.id);
    await createRoutine('Tirage', folder.id);
    await createRoutine('Hors dossier');
    expect(await countRoutinesInFolder(folder.id)).toBe(2);
  });

  // Ranger et détruire sont deux gestes différents.
  it('supprimer un dossier ne supprime pas ses routines : elles remontent à la racine', async () => {
    const folder = await createFolder('PPL');
    await createRoutine('Poussée', folder.id);

    await deleteFolder(folder.id);

    expect(await listFolders()).toEqual([]);
    const summaries = await listRoutineSummaries();
    expect(summaries).toHaveLength(1);
    expect(at(summaries, 0).routine.name).toBe('Poussée');
    expect(at(summaries, 0).routine.folderId).toBe('');
  });
});

describe('reorderRoutines', () => {
  it('classe et range en une seule écriture', async () => {
    const folder = await createFolder('PPL');
    const push = await createRoutine('Poussée');
    const pull = await createRoutine('Tirage');

    // "Tirage" passe devant ET entre dans le dossier.
    await reorderRoutines([
      { id: pull.id, folderId: folder.id },
      { id: push.id, folderId: '' },
    ]);

    const rows = (await listRoutineSummaries()).map((r) => r.routine);
    expect(rows.map((r) => [r.name, r.folderId, r.order])).toEqual([
      ['Tirage', folder.id, 0],
      ['Poussée', '', 1],
    ]);
  });

  it('ignore une routine absente sans casser le reste', async () => {
    const push = await createRoutine('Poussée');
    await reorderRoutines([{ id: 'inconnue', folderId: '' }, { id: push.id, folderId: '' }]);
    expect(at(await listRoutineSummaries(), 0).routine.name).toBe('Poussée');
  });
});

describe('listRoutineSummaries', () => {
  it('compte les exercices et les séries de chaque routine', async () => {
    const { routine } = await routineWith('Poussée', ['Développé', 'Écarté']);
    const first = await line(routine.id, 0);
    await addRoutineSet(first.row.id);
    await addRoutineSet(first.row.id);

    const summary = at(await listRoutineSummaries(), 0);
    expect(summary.exerciseCount).toBe(2);
    expect(summary.setCount).toBe(4); // 3 + 1
  });

  it('ne compte pas les séries d’un exercice retiré', async () => {
    const { routine } = await routineWith('Poussée', ['Développé', 'Écarté']);
    await removeRoutineExercise((await line(routine.id, 0)).row.id);

    const summary = at(await listRoutineSummaries(), 0);
    expect(summary.exerciseCount).toBe(1);
    expect(summary.setCount).toBe(1);
  });

  it('renvoie une routine vide avec des compteurs à zéro', async () => {
    await createRoutine('Neuve');
    expect(await listRoutineSummaries()).toEqual([
      expect.objectContaining({ exerciseCount: 0, setCount: 0 }),
    ]);
  });
});

describe('getRoutineDetail', () => {
  it('renvoie null — et non undefined — pour une routine absente', async () => {
    expect(await getRoutineDetail('inconnue')).toBeNull();
  });

  it('renvoie null pour une routine supprimée', async () => {
    const routine = await createRoutine('Poussée');
    await deleteRoutine(routine.id);
    expect(await getRoutineDetail(routine.id)).toBeNull();
  });

  // Le Lot 3 permet de supprimer un exercice personnalisé qu'une routine cite.
  it('reste lisible quand un exercice a été supprimé de la bibliothèque', async () => {
    const { routine, exercises } = await routineWith('Poussée', ['Développé', 'Écarté']);
    await deleteExercise(at(exercises, 0).id);

    const found = await detail(routine.id);
    expect(found.exercises).toHaveLength(2);
    expect(at(found.exercises, 0).exercise).toBeUndefined();
    expect(at(found.exercises, 1).exercise?.name).toBe('Écarté');
  });
});

describe('duplicateRoutine', () => {
  const identifiers = (found: RoutineDetail): string[] => [
    found.routine.id,
    ...found.exercises.flatMap((e) => [e.row.id, ...e.sets.map((s) => s.id)]),
  ];

  it('copie les exercices et les séries, sans partager un seul identifiant', async () => {
    const { routine } = await routineWith('Poussée', ['Développé', 'Écarté']);
    await addRoutineSet((await line(routine.id, 0)).row.id);

    const copy = await duplicateRoutine(routine.id, 'Poussée (copie)');
    expect(copy).toBeDefined();

    const copied = await detail(at([copy], 0)!.id);
    expect(copied.routine.name).toBe('Poussée (copie)');
    expect(copied.exercises.map((e) => e.exercise?.name)).toEqual(['Développé', 'Écarté']);
    expect(at(copied.exercises, 0).sets).toHaveLength(2);

    const original = await detail(routine.id);
    const shared = identifiers(copied).filter((id) => identifiers(original).includes(id));
    expect(shared).toEqual([]);
  });

  // Le checkpoint du lot, littéralement.
  it('modifier la copie ne touche pas à l’original', async () => {
    const { routine } = await routineWith('Poussée', ['Développé', 'Écarté']);
    const source = await line(routine.id, 0);
    await updateRoutineSet(at(source.sets, 0).id, { targetWeight: 80, targetReps: 8 });

    const copy = await duplicateRoutine(routine.id, 'Poussée (copie)');
    const copyId = copy?.id ?? '';
    const copied = await detail(copyId);

    await updateRoutine(copyId, { name: 'Autre chose' });
    await updateRoutineSet(at(at(copied.exercises, 0).sets, 0).id, { targetWeight: 100 });
    await removeRoutineExercise(at(copied.exercises, 1).row.id);
    await addRoutineSet(at(copied.exercises, 0).row.id);

    const after = await detail(routine.id);
    expect(after.routine.name).toBe('Poussée');
    expect(after.exercises).toHaveLength(2);
    expect(at(after.exercises, 0).sets).toHaveLength(1);
    expect(at(at(after.exercises, 0).sets, 0).targetWeight).toBe(80);
    expect(at(at(after.exercises, 0).sets, 0).targetReps).toBe(8);
  });

  it('ne revendique aucune filiation : originRoutineId reste vide', async () => {
    const { routine } = await routineWith('Poussée', ['Développé']);
    const copy = await duplicateRoutine(routine.id, 'Poussée (copie)');
    expect(copy?.originRoutineId).toBeUndefined();
  });

  it('renvoie undefined pour une routine absente', async () => {
    expect(await duplicateRoutine('inconnue', 'x')).toBeUndefined();
  });
});

describe('deleteRoutine', () => {
  it('supprime en cascade les exercices et les séries', async () => {
    const { routine } = await routineWith('Poussée', ['Développé', 'Écarté']);

    await deleteRoutine(routine.id);

    expect(await listRoutineSummaries()).toEqual([]);
    expect(await getRoutineDetail(routine.id)).toBeNull();
    // Les lignes existent toujours en base (soft delete) mais plus rien ne les remonte.
    const rows = await db.routineExercises.where('routineId').equals(routine.id).toArray();
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.deletedAt !== 0)).toBe(true);
    const sets = await db.routineSets.toArray();
    expect(sets.every((set) => set.deletedAt !== 0)).toBe(true);
  });
});

describe('ordre des exercices', () => {
  it('déplace un exercice et renumérote sans trou', async () => {
    const { routine } = await routineWith('Poussée', ['A', 'B', 'C']);

    await reorderRoutineExercises(routine.id, 2, 0);

    expect(await names(routine.id)).toEqual(['C', 'A', 'B']);
    expect(await orders(routine.id)).toEqual([0, 1, 2]);
  });

  it('retirer un exercice referme le trou dans l’ordre', async () => {
    const { routine } = await routineWith('Poussée', ['A', 'B', 'C']);

    await removeRoutineExercise((await line(routine.id, 0)).row.id);

    expect(await names(routine.id)).toEqual(['B', 'C']);
    expect(await orders(routine.id)).toEqual([0, 1]);
  });

  it('retirer un exercice supprime aussi ses séries', async () => {
    const { routine } = await routineWith('Poussée', ['A']);
    const row = (await line(routine.id, 0)).row;

    await removeRoutineExercise(row.id);

    const sets = await db.routineSets.where('routineExerciseId').equals(row.id).toArray();
    expect(sets.every((set) => set.deletedAt !== 0)).toBe(true);
  });
});

describe('supersets', () => {
  it('groupe un exercice avec le précédent', async () => {
    const { routine } = await routineWith('Poussée', ['A', 'B', 'C']);

    await groupWithPrevious(routine.id, (await line(routine.id, 1)).row.id);

    expect(await groups(routine.id)).toEqual([1, 1, 0]);
  });

  it('un troisième exercice rejoint le groupe existant', async () => {
    const { routine } = await routineWith('Poussée', ['A', 'B', 'C']);
    await groupWithPrevious(routine.id, (await line(routine.id, 1)).row.id);
    await groupWithPrevious(routine.id, (await line(routine.id, 2)).row.id);

    expect(await groups(routine.id)).toEqual([1, 1, 1]);
  });

  it('dissocier dissout le groupe entier, pas un membre', async () => {
    const { routine } = await routineWith('Poussée', ['A', 'B', 'C']);
    await groupWithPrevious(routine.id, (await line(routine.id, 1)).row.id);
    await groupWithPrevious(routine.id, (await line(routine.id, 2)).row.id);

    await ungroupSuperset(routine.id, (await line(routine.id, 1)).row.id);

    expect(await groups(routine.id)).toEqual([0, 0, 0]);
  });

  it('sortir un exercice d’un superset de deux dissout le groupe orphelin', async () => {
    const { routine } = await routineWith('Poussée', ['A', 'B', 'C', 'D']);
    await groupWithPrevious(routine.id, (await line(routine.id, 1)).row.id); // A+B groupés

    await reorderRoutineExercises(routine.id, 0, 3); // A part à la fin

    expect(await names(routine.id)).toEqual(['B', 'C', 'D', 'A']);
    expect(await groups(routine.id)).toEqual([0, 0, 0, 0]);
  });

  it('retirer un membre d’un superset de deux dissout le groupe', async () => {
    const { routine } = await routineWith('Poussée', ['A', 'B', 'C']);
    await groupWithPrevious(routine.id, (await line(routine.id, 1)).row.id);

    await removeRoutineExercise((await line(routine.id, 0)).row.id);

    expect(await groups(routine.id)).toEqual([0, 0]);
  });
});

describe('séries prévues', () => {
  it('ajoute une série recopiée de la précédente', async () => {
    const { routine } = await routineWith('Poussée', ['Développé']);
    const row = await line(routine.id, 0);
    await updateRoutineSet(at(row.sets, 0).id, {
      targetReps: 8,
      targetRepsMax: 12,
      targetWeight: 80,
    });

    await addRoutineSet(row.row.id);

    const sets = (await line(routine.id, 0)).sets;
    expect(sets).toHaveLength(2);
    expect(at(sets, 1)).toMatchObject({
      order: 1,
      targetReps: 8,
      targetRepsMax: 12,
      targetWeight: 80,
    });
  });

  it('la première série d’un exercice neuf est libre', async () => {
    const { routine } = await routineWith('Poussée', ['Développé']);
    const set = at((await line(routine.id, 0)).sets, 0);
    expect(set.targetReps).toBeUndefined();
    expect(set.targetWeight).toBeUndefined();
    expect(set.setType).toBe('normal');
  });

  it('applique une charge à toutes les séries sans toucher au reste', async () => {
    const { routine } = await routineWith('Poussée', ['Développé']);
    const row = await line(routine.id, 0);
    await updateRoutineSet(at(row.sets, 0).id, { targetReps: 5, targetWeight: 80 });
    await addRoutineSet(row.row.id);
    await addRoutineSet(row.row.id);

    await applyToAllSets(row.row.id, { targetWeight: 85 });

    const sets = (await line(routine.id, 0)).sets;
    expect(sets.map((s) => s.targetWeight)).toEqual([85, 85, 85]);
    expect(sets.map((s) => s.targetReps)).toEqual([5, 5, 5]);
    expect(sets.map((s) => s.order)).toEqual([0, 1, 2]);
  });

  it('supprimer une série renumérote les suivantes', async () => {
    const { routine } = await routineWith('Poussée', ['Développé']);
    const row = await line(routine.id, 0);
    await addRoutineSet(row.row.id);
    await addRoutineSet(row.row.id);

    await deleteRoutineSet(at((await line(routine.id, 0)).sets, 0).id);

    const rest = (await line(routine.id, 0)).sets;
    expect(rest).toHaveLength(2);
    expect(rest.map((s) => s.order)).toEqual([0, 1]);
  });
});
