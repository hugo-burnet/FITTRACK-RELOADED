import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_REST_SECONDS } from '@/lib/rest';
import { db } from '@/data/db';
import { resetDb } from '@/test/resetDb';
import { day, seedWorkout } from '@/test/factories';
import { newEntity } from './base';
import { createCustomExercise } from './exercises';
import { addExercisesToRoutine, addRoutineSet, createRoutine, updateRoutineSet } from './routines';
import { getLastPerformance, listSessionsForExercise } from './workoutHistory';
import {
  addSet,
  addWorkoutExercise,
  completeSet,
  deleteSet,
  deleteWorkout,
  discardWorkout,
  duplicateLastSet,
  finishWorkout,
  getActiveWorkout,
  getWorkoutDetail,
  removeWorkoutExercise,
  reorderWorkoutExercises,
  restoreSet,
  startWorkout,
  startWorkoutFromRoutine,
  uncompleteSet,
  updateSetType,
  updateSetValues,
} from './workouts';
import type { Exercise, WorkoutExercise, WorkoutSet } from '@/data/types';

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

const anExercise = (name: string, measurementType: Exercise['measurementType'] = 'weight_reps') =>
  createCustomExercise({
    name,
    primaryMuscle: 'chest',
    secondaryMuscles: [],
    equipment: 'barbell',
    measurementType,
    isUnilateral: 0,
  });

/** Attaches an exercise to a workout, the way the Lot 5 screen will. */
async function addExercise(workoutId: string, exerciseId: string): Promise<WorkoutExercise> {
  const workoutExercise = newEntity<WorkoutExercise>({
    workoutId,
    exerciseId,
    order: 0,
    supersetGroup: 0,
    restSeconds: DEFAULT_REST_SECONDS,
  });
  await db.workoutExercises.add(workoutExercise);
  return workoutExercise;
}

describe('getLastPerformance', () => {
  beforeEach(resetDb);

  it("retourne les séries de la dernière séance où l'exercice a été fait", async () => {
    await seedWorkout({
      exerciseId: 'bench',
      performedAt: day(1),
      sets: [
        [100, 5],
        [100, 5],
      ],
    });
    await seedWorkout({
      exerciseId: 'bench',
      performedAt: day(8),
      sets: [
        [102.5, 5],
        [102.5, 4],
      ],
    });

    const result = await getLastPerformance('bench');

    expect(result).toHaveLength(2);
    expect(result[0]!.weight).toBe(102.5); // la plus récente, pas la première
  });

  it('ne mélange pas les exercices', async () => {
    await seedWorkout({ exerciseId: 'bench', performedAt: day(1), sets: [[100, 5]] });
    await seedWorkout({ exerciseId: 'squat', performedAt: day(2), sets: [[140, 5]] });

    const result = await getLastPerformance('bench');
    expect(result).toHaveLength(1);
    expect(result[0]!.weight).toBe(100);
  });

  it('rend les séries dans leur ordre de saisie', async () => {
    await seedWorkout({
      exerciseId: 'bench',
      performedAt: day(1),
      sets: [
        [60, 10],
        [80, 8],
        [100, 5],
      ],
    });

    const result = await getLastPerformance('bench');
    expect(result.map((set) => set.weight)).toEqual([60, 80, 100]);
  });

  it('ignore les séries non validées', async () => {
    // performedAt = 0 → doit être exclue par la borne basse de l'index
    await seedWorkout({ exerciseId: 'bench', performedAt: day(1), sets: [[100, 5]] });

    const workout = await startWorkout('', 'Séance en cours');
    const we = await addExercise(workout.id, 'bench');
    await db.workoutSets.add(
      newEntity<WorkoutSet>({
        workoutExerciseId: we.id,
        exerciseId: 'bench',
        workoutId: workout.id,
        order: 0,
        setType: 'normal',
        side: 'both',
        weight: 999,
        reps: 1,
        isCompleted: 0,
        performedAt: 0,
      }),
    );

    const result = await getLastPerformance('bench');
    expect(result.every((s) => s.weight !== 999)).toBe(true);
  });

  it("retourne un tableau vide si l'exercice n'a jamais été fait", async () => {
    expect(await getLastPerformance('jamais-fait')).toEqual([]);
  });

  it('ignore les séances supprimées', async () => {
    const workout = await seedWorkout({
      exerciseId: 'bench',
      performedAt: day(1),
      sets: [[100, 5]],
    });
    await deleteWorkout(workout.id);
    expect(await getLastPerformance('bench')).toEqual([]);
  });

  it('retombe sur la séance précédente quand la dernière est supprimée', async () => {
    await seedWorkout({ exerciseId: 'bench', performedAt: day(1), sets: [[100, 5]] });
    const mistake = await seedWorkout({
      exerciseId: 'bench',
      performedAt: day(8),
      sets: [[999, 1]],
    });

    await deleteWorkout(mistake.id);

    // Supprimer une séance mal saisie doit faire réapparaître la précédente,
    // pas vider l'affichage : c'est le geste normal après une faute de frappe.
    const result = await getLastPerformance('bench');
    expect(result).toHaveLength(1);
    expect(result[0]!.weight).toBe(100);
  });
});

describe('listSessionsForExercise', () => {
  beforeEach(resetDb);

  it('rend les séances de la plus récente à la plus ancienne', async () => {
    await seedWorkout({ exerciseId: 'bench', performedAt: day(1), sets: [[100, 5]] });
    await seedWorkout({ exerciseId: 'bench', performedAt: day(8), sets: [[102.5, 5]] });
    await seedWorkout({ exerciseId: 'bench', performedAt: day(15), sets: [[105, 4]] });

    const sessions = await listSessionsForExercise('bench');

    expect(sessions.map((session) => session.performedAt)).toEqual([day(15), day(8), day(1)]);
  });

  it('groupe les séries de chaque séance dans leur ordre de saisie', async () => {
    await seedWorkout({
      exerciseId: 'bench',
      performedAt: day(1),
      sets: [
        [60, 10],
        [80, 8],
        [100, 5],
      ],
    });

    const [session] = await listSessionsForExercise('bench');

    expect(session!.sets.map((set) => set.weight)).toEqual([60, 80, 100]);
  });

  it('ne mélange pas les exercices', async () => {
    await seedWorkout({ exerciseId: 'bench', performedAt: day(1), sets: [[100, 5]] });
    await seedWorkout({ exerciseId: 'squat', performedAt: day(2), sets: [[140, 5]] });

    expect(await listSessionsForExercise('bench')).toHaveLength(1);
  });

  it('sépare deux blocs du même exercice dans une même séance', async () => {
    // Développé couché en début puis en fin de séance : deux blocs, pas un seul
    // dont les `order` se marcheraient dessus.
    const workout = await startWorkout('', 'Séance libre');
    for (const weight of [100, 60]) {
      const we = await addExercise(workout.id, 'bench');
      await db.workoutSets.add(
        newEntity<WorkoutSet>({
          workoutExerciseId: we.id,
          exerciseId: 'bench',
          workoutId: workout.id,
          order: 0,
          setType: 'normal',
          side: 'both',
          weight,
          reps: 5,
          isCompleted: 1,
          performedAt: day(1),
        }),
      );
    }

    expect(await listSessionsForExercise('bench')).toHaveLength(2);
  });

  it('ignore les séances supprimées', async () => {
    const workout = await seedWorkout({
      exerciseId: 'bench',
      performedAt: day(1),
      sets: [[100, 5]],
    });
    await deleteWorkout(workout.id);
    expect(await listSessionsForExercise('bench')).toEqual([]);
  });

  it('ignore les séries non validées', async () => {
    const workout = await startWorkout('', 'Séance en cours');
    const we = await addExercise(workout.id, 'bench');
    await addSet(we.id, { weight: 999, reps: 1 });

    expect(await listSessionsForExercise('bench')).toEqual([]);
  });

  it('rend un tableau vide pour un exercice jamais fait', async () => {
    expect(await listSessionsForExercise('jamais-fait')).toEqual([]);
  });
});

describe('séance active', () => {
  beforeEach(resetDb);

  it("retrouve la séance active après un redémarrage de l'application", async () => {
    const workout = await startWorkout('', 'Séance libre');
    await db.close(); // simule la fermeture de l'app
    await db.open();
    const active = await getActiveWorkout();
    expect(active?.id).toBe(workout.id);
  });

  it("n'a plus de séance active après clôture", async () => {
    const workout = await startWorkout('', 'Séance libre');
    await finishWorkout(workout.id);
    expect(await getActiveWorkout()).toBeUndefined();
  });

  it('ne voit pas une séance active supprimée', async () => {
    const workout = await startWorkout('', 'Séance abandonnée');
    await deleteWorkout(workout.id);
    expect(await getActiveWorkout()).toBeUndefined();
  });

  it('ignore les séances déjà terminées', async () => {
    await seedWorkout({ exerciseId: 'bench', performedAt: day(1), sets: [[100, 5]] });
    expect(await getActiveWorkout()).toBeUndefined();
  });
});

describe('finishWorkout', () => {
  beforeEach(resetDb);

  it('calcule la durée et la date de fin', async () => {
    const workout = await startWorkout('', 'Séance libre');
    await finishWorkout(workout.id);

    const after = await db.workouts.get(workout.id);
    expect(after!.status).toBe('completed');
    expect(after!.endedAt).toBeGreaterThanOrEqual(after!.startedAt);
    expect(after!.durationSeconds).toBeGreaterThanOrEqual(0);
  });
});

describe('addSet', () => {
  beforeEach(resetDb);

  it("dénormalise l'exercice et la séance depuis la ligne parente", async () => {
    const workout = await startWorkout('', 'Séance libre');
    const we = await addExercise(workout.id, 'bench');

    const set = await addSet(we.id);

    expect(set.exerciseId).toBe('bench');
    expect(set.workoutId).toBe(workout.id);
    expect(set.isCompleted).toBe(0);
    expect(set.performedAt).toBe(0);
  });

  it('numérote les séries à la suite', async () => {
    const workout = await startWorkout('', 'Séance libre');
    const we = await addExercise(workout.id, 'bench');

    const first = await addSet(we.id);
    const second = await addSet(we.id);

    expect([first.order, second.order]).toEqual([0, 1]);
  });

  it('refuse une ligne parente inconnue', async () => {
    await expect(addSet('inexistant')).rejects.toThrow();
  });
});

/**
 * Même famille que le piège n°2 plus bas — deux séries au même `order` — mais
 * une autre cause : lire le rang puis écrire, sans transaction, laisse deux
 * ajouts qui se chevauchent lire la même longueur.
 *
 * `Promise.all` reproduit exactement ce qu'un double appui produit sur
 * téléphone : les deux appels partent dans le même tick et s'entrelacent sur
 * leur premier `await`.
 */
describe('rangs concurrents — deux appuis dans le même tick', () => {
  beforeEach(resetDb);

  const liveOrders = async (workoutExerciseId: string): Promise<number[]> =>
    (await db.workoutSets.where('workoutExerciseId').equals(workoutExerciseId).toArray())
      .filter((set) => set.deletedAt === 0)
      .map((set) => set.order)
      .sort((a, b) => a - b);

  it('ne donne jamais le même rang à deux séries ajoutées en même temps', async () => {
    const workout = await startWorkout('', 'Séance libre');
    const we = await addExercise(workout.id, 'bench');

    await Promise.all([addSet(we.id), addSet(we.id)]);

    expect(await liveOrders(we.id)).toEqual([0, 1]);
  });

  it('ne donne jamais le même rang à deux duplications en même temps', async () => {
    const workout = await startWorkout('', 'Séance libre');
    const we = await addExercise(workout.id, 'bench');
    const first = await addSet(we.id);
    await completeSet(first.id, { weight: 100, reps: 5 });

    await Promise.all([duplicateLastSet(we.id), duplicateLastSet(we.id)]);

    expect(await liveOrders(we.id)).toEqual([0, 1, 2]);
  });

  /** Le même trou, une table plus haut : « Ajouter un exercice », deux fois. */
  it('ne donne jamais le même rang à deux exercices ajoutés en même temps', async () => {
    const workout = await startWorkout('', 'Séance libre');

    await Promise.all([
      addWorkoutExercise(workout.id, 'bench'),
      addWorkoutExercise(workout.id, 'squat'),
    ]);

    const detail = await getWorkoutDetail(workout.id);
    expect(detail!.exercises.map((line) => line.row.order)).toEqual([0, 1]);
  });
});

describe('completeSet', () => {
  beforeEach(resetDb);

  it('horodate la série et la rend immédiatement visible comme précédente', async () => {
    const workout = await startWorkout('', 'Séance libre');
    const we = await addExercise(workout.id, 'bench');
    const set = await addSet(we.id);

    await completeSet(set.id, { weight: 102.5, reps: 5 });

    const stored = await db.workoutSets.get(set.id);
    expect(stored!.isCompleted).toBe(1);
    expect(stored!.performedAt).toBeGreaterThan(0);
    expect(stored!.weight).toBe(102.5);

    // Règle non négociable n°4 : écriture à chaque série validée, pas en fin de
    // séance. La série doit donc survivre sans clôture.
    const previous = await getLastPerformance('bench');
    expect(previous).toHaveLength(1);
    expect(previous[0]!.reps).toBe(5);
  });

  it('ne touche pas aux valeurs non fournies', async () => {
    const workout = await startWorkout('', 'Séance libre');
    const we = await addExercise(workout.id, 'bench');
    const set = await addSet(we.id, { weight: 60, reps: 10 });

    await completeSet(set.id, { reps: 12 });

    const stored = await db.workoutSets.get(set.id);
    expect(stored!.weight).toBe(60);
    expect(stored!.reps).toBe(12);
  });
});

describe('deleteWorkout', () => {
  beforeEach(resetDb);

  it('propage la suppression logique aux exercices et aux séries', async () => {
    const workout = await seedWorkout({
      exerciseId: 'bench',
      performedAt: day(1),
      sets: [
        [100, 5],
        [100, 5],
      ],
    });

    await deleteWorkout(workout.id);

    const sets = await db.workoutSets.where('workoutId').equals(workout.id).toArray();
    const exercises = await db.workoutExercises.where('workoutId').equals(workout.id).toArray();

    expect(sets).toHaveLength(2);
    expect(sets.every((set) => set.deletedAt > 0)).toBe(true);
    expect(exercises.every((exercise) => exercise.deletedAt > 0)).toBe(true);
    expect((await db.workouts.get(workout.id))!.deletedAt).toBeGreaterThan(0);
  });

  it('ne touche pas aux autres séances', async () => {
    const kept = await seedWorkout({ exerciseId: 'squat', performedAt: day(1), sets: [[140, 5]] });
    const removed = await seedWorkout({
      exerciseId: 'bench',
      performedAt: day(2),
      sets: [[100, 5]],
    });

    await deleteWorkout(removed.id);

    expect((await db.workouts.get(kept.id))!.deletedAt).toBe(0);
    const keptSets = await db.workoutSets.where('workoutId').equals(kept.id).toArray();
    expect(keptSets.every((set) => set.deletedAt === 0)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Les quatre pièges du Lot 2, invisibles jusqu'ici parce que rien ne créait de
// WorkoutSet. Chacun de ces tests échoue sans son correctif.
// ---------------------------------------------------------------------------

describe('piège n°1 — la valeur précédente et la séance en cours', () => {
  beforeEach(resetDb);

  /**
   * `getLastPerformance` remonte l'index et s'arrête sur la première série
   * validée qu'elle trouve. Dès que la série 1 d'aujourd'hui est cochée, c'est
   * elle : la colonne « précédent » cesse d'être une référence et devient un
   * miroir de ce qu'on vient de taper.
   */
  it('exclut la séance en cours de sa propre valeur précédente', async () => {
    await seedWorkout({ exerciseId: 'bench', performedAt: day(1), sets: [[100, 5]] });

    const today = await startWorkout('', 'Séance du jour');
    const row = await addWorkoutExercise(today.id, 'bench');
    const set = await addSet(row.id);
    await completeSet(set.id, { weight: 105, reps: 3 });

    const naive = await getLastPerformance('bench');
    expect(at(naive, 0).weight).toBe(105); // sans exclusion : le miroir

    const previous = await getLastPerformance('bench', today.id);
    expect(previous).toHaveLength(1);
    expect(at(previous, 0).weight).toBe(100);
  });

  it("n'exclut rien quand l'exercice n'a pas encore été fait aujourd'hui", async () => {
    await seedWorkout({ exerciseId: 'bench', performedAt: day(1), sets: [[100, 5]] });
    const today = await startWorkout('', 'Séance du jour');

    expect(await getLastPerformance('bench', today.id)).toHaveLength(1);
  });
});

describe('piège n°2 — l’ordre des séries après une suppression', () => {
  beforeEach(resetDb);

  /**
   * `.count()` de Dexie ne filtre pas `deletedAt`. Supprimer une série puis en
   * ajouter une produisait deux séries de même `order`, et l'affichage devenait
   * celui du hasard.
   */
  it('ne réutilise jamais un ordre déjà pris', async () => {
    const workout = await startWorkout('', 'Séance libre');
    // Pose déjà la série 1 : un exercice sans ligne à cocher est un cul-de-sac.
    const row = await addWorkoutExercise(workout.id, 'bench');

    const second = await addSet(row.id);
    await addSet(row.id);

    await deleteSet(second.id);
    await addSet(row.id);

    const orders = (await db.workoutSets.where('workoutExerciseId').equals(row.id).toArray())
      .filter((set) => set.deletedAt === 0)
      .map((set) => set.order)
      .sort((a, b) => a - b);

    // Trois séries, moins une supprimée, plus une ajoutée : 0, 1, 2 — et non
    // 0, 1, 2 avec un doublon, ce que produisait le comptage des supprimées.
    expect(orders).toEqual([0, 1, 2]);
  });

  it('renumérote ce qui reste — « série 1, série 3 » se lit à l’écran', async () => {
    const workout = await startWorkout('', 'Séance libre');
    const row = await addWorkoutExercise(workout.id, 'bench');

    const first = at(at((await getWorkoutDetail(workout.id))!.exercises, 0).sets, 0);
    await updateSetValues(first.id, { weight: 60 });
    await addSet(row.id, { weight: 80 });
    await addSet(row.id, { weight: 100 });

    await deleteSet(first.id);

    const rest = (await db.workoutSets.where('workoutExerciseId').equals(row.id).toArray())
      .filter((set) => set.deletedAt === 0)
      .sort((a, b) => a.order - b.order);

    expect(rest.map((set) => [set.order, set.weight])).toEqual([
      [0, 80],
      [1, 100],
    ]);
  });

  /**
   * Le balayage supprime sans confirmation ; il doit donc se reprendre. La
   * suppression étant douce, la série est encore là — ce que la restauration
   * doit retrouver, c'est sa **place**, que `deleteSet` a renumérotée derrière
   * elle.
   */
  it('remet une série supprimée à son rang, pas au bout', async () => {
    const workout = await startWorkout('', 'Séance libre');
    const row = await addWorkoutExercise(workout.id, 'bench');

    const first = at(at((await getWorkoutDetail(workout.id))!.exercises, 0).sets, 0);
    await updateSetValues(first.id, { weight: 60 });
    const second = await addSet(row.id, { weight: 80 });
    await addSet(row.id, { weight: 100 });

    await deleteSet(second.id);
    await restoreSet(second.id);

    const sets = at((await getWorkoutDetail(workout.id))!.exercises, 0).sets;
    expect(sets.map((set) => [set.order, set.weight])).toEqual([
      [0, 60],
      [1, 80],
      [2, 100],
    ]);
  });

  it('rend une série validée avec sa validation', async () => {
    const workout = await startWorkout('', 'Séance libre');
    const row = await addWorkoutExercise(workout.id, 'bench');
    const set = await addSet(row.id);
    await completeSet(set.id, { weight: 100, reps: 5 });

    await deleteSet(set.id);
    await restoreSet(set.id);

    const restored = at(at((await getWorkoutDetail(workout.id))!.exercises, 0).sets, 1);
    expect([restored.isCompleted, restored.weight, restored.reps]).toEqual([1, 100, 5]);
  });

  /**
   * Le compte à rebours du bandeau d'annulation peut expirer pendant qu'un
   * doigt appuie dessus. Restaurer deux fois, ou restaurer une série vivante,
   * ne doit pas la dupliquer ni décaler ses voisines.
   */
  it('ne fait rien sur une série qui n’a pas été supprimée', async () => {
    const workout = await startWorkout('', 'Séance libre');
    const row = await addWorkoutExercise(workout.id, 'bench');
    const second = await addSet(row.id, { weight: 80 });

    await deleteSet(second.id);
    await restoreSet(second.id);
    await restoreSet(second.id);

    const sets = at((await getWorkoutDetail(workout.id))!.exercises, 0).sets;
    expect(sets.map((set) => set.order)).toEqual([0, 1]);
  });
});

describe('piège n°3 — une séance abandonnée alimentait l’historique', () => {
  beforeEach(resetDb);

  it('sort une séance abandonnée de la valeur précédente et de l’historique', async () => {
    await seedWorkout({ exerciseId: 'bench', performedAt: day(1), sets: [[100, 5]] });

    const bad = await startWorkout('', 'Séance ratée');
    const row = await addWorkoutExercise(bad.id, 'bench');
    const set = await addSet(row.id);
    await completeSet(set.id, { weight: 999, reps: 1 });

    await discardWorkout(bad.id);

    const previous = await getLastPerformance('bench');
    expect(previous).toHaveLength(1);
    expect(at(previous, 0).weight).toBe(100);
    expect(await listSessionsForExercise('bench')).toHaveLength(1);
  });

  it('garde la trace de l’abandon sans la laisser compter', async () => {
    const workout = await startWorkout('', 'Séance ratée');
    await discardWorkout(workout.id);

    const stored = await db.workouts.get(workout.id);
    expect(stored!.status).toBe('discarded');
    expect(stored!.deletedAt).toBeGreaterThan(0);
    expect(await getActiveWorkout()).toBeUndefined();
  });
});

describe('piège n°4 — les séries jamais cochées', () => {
  beforeEach(resetDb);

  /**
   * Une routine de 4 séries en crée 4 ; on en fait 2. Les deux autres ne sont
   * pas des séries à zéro, ce sont des séries qui n'ont pas eu lieu.
   */
  it('ne garde que les séries réellement cochées', async () => {
    const workout = await startWorkout('', 'Séance libre');
    const row = await addWorkoutExercise(workout.id, 'bench');

    const done = await addSet(row.id);
    await addSet(row.id);
    await addSet(row.id);
    await completeSet(done.id, { weight: 100, reps: 5 });

    await finishWorkout(workout.id);

    const kept = (await db.workoutSets.where('workoutId').equals(workout.id).toArray()).filter(
      (set) => set.deletedAt === 0,
    );
    expect(kept).toHaveLength(1);
    expect(at(kept, 0).weight).toBe(100);
  });

  it('retire un exercice dont aucune série n’a été faite', async () => {
    const workout = await startWorkout('', 'Séance libre');
    const done = await addWorkoutExercise(workout.id, 'bench');
    const skipped = await addWorkoutExercise(workout.id, 'squat');

    const set = await addSet(done.id);
    await completeSet(set.id, { weight: 100, reps: 5 });
    await addSet(skipped.id);

    await finishWorkout(workout.id);

    const rows = (await db.workoutExercises.where('workoutId').equals(workout.id).toArray()).filter(
      (row) => row.deletedAt === 0,
    );
    expect(rows).toHaveLength(1);
    expect(at(rows, 0).exerciseId).toBe('bench');
  });

  it('clôt sans rien perdre une séance entièrement cochée', async () => {
    const workout = await startWorkout('', 'Séance libre');
    const row = await addWorkoutExercise(workout.id, 'bench');

    for (const weight of [60, 80, 100]) {
      const set = await addSet(row.id);
      await completeSet(set.id, { weight, reps: 5 });
    }

    await finishWorkout(workout.id);

    const kept = (await db.workoutSets.where('workoutId').equals(workout.id).toArray()).filter(
      (set) => set.deletedAt === 0,
    );
    expect(kept).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Démarrer, composer et lire une séance
// ---------------------------------------------------------------------------

describe('startWorkoutFromRoutine', () => {
  beforeEach(resetDb);

  it('recopie la structure de la routine, exercices et séries', async () => {
    const bench = await anExercise('Développé couché');
    const squat = await anExercise('Squat');
    const routine = await createRoutine('Poussée');
    await addExercisesToRoutine(routine.id, [bench.id, squat.id]);

    const workout = await startWorkoutFromRoutine(routine.id);

    expect(workout.routineId).toBe(routine.id);
    expect(workout.name).toBe('Poussée');
    expect(workout.status).toBe('active');

    const detail = await getWorkoutDetail(workout.id);
    expect(detail!.exercises.map((line) => line.exercise?.name)).toEqual([
      'Développé couché',
      'Squat',
    ]);
    expect(detail!.exercises.every((line) => line.sets.length === 1)).toBe(true);
  });

  /**
   * La prescription va dans les champs `target*`, jamais dans `weight`/`reps`.
   *
   * De là découle la règle sur laquelle tient tout l'écran : **rien n'est en
   * encre tant que ce n'est pas tapé**. Et c'est la seule forme qui sait porter
   * une fourchette — 8 – 12 n'est pas un nombre, donc remplir `reps` la faisait
   * disparaître de l'écran, ce qui a été constaté sur la toute première routine
   * réelle.
   */
  it('porte la prescription à part de ce qui a été réalisé', async () => {
    const bench = await anExercise('Développé couché');
    const routine = await createRoutine('Poussée');
    await addExercisesToRoutine(routine.id, [bench.id]);

    const row = at(await db.routineExercises.where('routineId').equals(routine.id).toArray(), 0);
    const fixed = at(await db.routineSets.where('routineExerciseId').equals(row.id).toArray(), 0);
    await updateRoutineSet(fixed.id, { targetReps: 5, targetWeight: 100 });

    const ranged = await addRoutineSet(row.id);
    await updateRoutineSet(ranged.id, { targetReps: 8, targetRepsMax: 12, targetWeight: 80 });

    const workout = await startWorkoutFromRoutine(routine.id);
    const sets = at((await getWorkoutDetail(workout.id))!.exercises, 0).sets;

    expect([at(sets, 0).targetReps, at(sets, 0).targetWeight]).toEqual([5, 100]);
    // Rien n'est réputé réalisé : la séance n'a pas encore commencé.
    expect([at(sets, 0).reps, at(sets, 0).weight]).toEqual([undefined, undefined]);

    // La fourchette survit entière — c'est elle qui n'avait nulle part où aller.
    expect([at(sets, 1).targetReps, at(sets, 1).targetRepsMax]).toEqual([8, 12]);
    expect(at(sets, 1).targetWeight).toBe(80);
  });

  it('reprend le type de série tout en laissant la série à faire', async () => {
    const bench = await anExercise('Développé couché');
    const routine = await createRoutine('Poussée');
    await addExercisesToRoutine(routine.id, [bench.id]);

    const row = at(await db.routineExercises.where('routineId').equals(routine.id).toArray(), 0);
    const set = at(await db.routineSets.where('routineExerciseId').equals(row.id).toArray(), 0);
    await updateRoutineSet(set.id, { setType: 'warmup' });

    const workout = await startWorkoutFromRoutine(routine.id);
    const sets = at((await getWorkoutDetail(workout.id))!.exercises, 0).sets;

    expect(at(sets, 0).setType).toBe('warmup');
    expect(at(sets, 0).isCompleted).toBe(0);
    expect(at(sets, 0).performedAt).toBe(0);
  });

  it('reprend une durée cible', async () => {
    const plank = await anExercise('Planche', 'time_only');
    const routine = await createRoutine('Gainage');
    await addExercisesToRoutine(routine.id, [plank.id]);

    const row = at(await db.routineExercises.where('routineId').equals(routine.id).toArray(), 0);
    const set = at(await db.routineSets.where('routineExerciseId').equals(row.id).toArray(), 0);
    await updateRoutineSet(set.id, { targetDurationSeconds: 45 });

    const workout = await startWorkoutFromRoutine(routine.id);
    const sets = at((await getWorkoutDetail(workout.id))!.exercises, 0).sets;

    expect(at(sets, 0).targetDurationSeconds).toBe(45);
    expect(at(sets, 0).durationSeconds).toBeUndefined();
  });

  it('refuse une routine inconnue', async () => {
    await expect(startWorkoutFromRoutine('inexistante')).rejects.toThrow();
  });
});

describe('getWorkoutDetail', () => {
  beforeEach(resetDb);

  /** `undefined` = pas encore répondu, `null` = absente. Piège du Lot 3. */
  it('rend null et non undefined pour une séance absente', async () => {
    expect(await getWorkoutDetail('inexistante')).toBeNull();
  });

  it('porte la valeur précédente de chaque exercice, hors séance en cours', async () => {
    await seedWorkout({ exerciseId: 'bench', performedAt: day(1), sets: [[100, 5]] });

    const workout = await startWorkout('', 'Séance libre');
    const row = await addWorkoutExercise(workout.id, 'bench');
    const set = await addSet(row.id);
    await completeSet(set.id, { weight: 105, reps: 3 });

    const line = at((await getWorkoutDetail(workout.id))!.exercises, 0);
    expect(line.previous).toHaveLength(1);
    expect(at(line.previous, 0).weight).toBe(100);
  });

  it('ne montre pas les exercices retirés de la séance', async () => {
    const workout = await startWorkout('', 'Séance libre');
    const kept = await addWorkoutExercise(workout.id, 'bench');
    const removed = await addWorkoutExercise(workout.id, 'squat');
    await removeWorkoutExercise(removed.id);

    const detail = await getWorkoutDetail(workout.id);
    expect(detail!.exercises).toHaveLength(1);
    expect(at(detail!.exercises, 0).row.id).toBe(kept.id);
  });
});

describe('composer la séance en cours', () => {
  beforeEach(resetDb);

  it('ajoute un exercice avec une première série — sinon rien à cocher', async () => {
    const workout = await startWorkout('', 'Séance libre');
    const row = await addWorkoutExercise(workout.id, 'bench');

    const line = at((await getWorkoutDetail(workout.id))!.exercises, 0);
    expect(line.row.id).toBe(row.id);
    expect(line.sets).toHaveLength(1);
  });

  it('numérote les exercices ajoutés à la suite', async () => {
    const workout = await startWorkout('', 'Séance libre');
    await addWorkoutExercise(workout.id, 'bench');
    await addWorkoutExercise(workout.id, 'squat');

    const detail = await getWorkoutDetail(workout.id);
    expect(detail!.exercises.map((line) => line.row.order)).toEqual([0, 1]);
  });

  it('retirer un exercice emporte ses séries et referme le trou', async () => {
    const workout = await startWorkout('', 'Séance libre');
    const first = await addWorkoutExercise(workout.id, 'bench');
    await addWorkoutExercise(workout.id, 'squat');

    await removeWorkoutExercise(first.id);

    const sets = await db.workoutSets.where('workoutExerciseId').equals(first.id).toArray();
    expect(sets.every((set) => set.deletedAt > 0)).toBe(true);

    const detail = await getWorkoutDetail(workout.id);
    expect(at(detail!.exercises, 0).row.order).toBe(0);
  });

  it('réorganise les exercices pendant la séance', async () => {
    const workout = await startWorkout('', 'Séance libre');
    await addWorkoutExercise(workout.id, 'bench');
    await addWorkoutExercise(workout.id, 'squat');
    await addWorkoutExercise(workout.id, 'row');

    await reorderWorkoutExercises(workout.id, 2, 0);

    const detail = await getWorkoutDetail(workout.id);
    expect(detail!.exercises.map((line) => line.row.exerciseId)).toEqual(['row', 'bench', 'squat']);
  });

  /**
   * Précédent du Lot 4 : « ajouter une série » repropose la précédente. Ce que
   * la série d'avant a réalisé devient la **prescription** de la nouvelle, pas
   * son résultat — une série qui arriverait déjà remplie serait une série que
   * l'app prétend que tu as faite.
   */
  it('repropose la série précédente sans la déclarer faite', async () => {
    const workout = await startWorkout('', 'Séance libre');
    const row = await addWorkoutExercise(workout.id, 'bench');
    const first = at(at((await getWorkoutDetail(workout.id))!.exercises, 0).sets, 0);

    await completeSet(first.id, { weight: 102.5, reps: 5 });
    const copy = await duplicateLastSet(row.id);

    expect(copy.targetWeight).toBe(102.5);
    expect(copy.targetReps).toBe(5);
    expect(copy.weight).toBeUndefined();
    expect(copy.reps).toBeUndefined();
    expect(copy.isCompleted).toBe(0);
    expect(copy.performedAt).toBe(0);
  });

  /** Une fourchette non encore réalisée reste une fourchette à la série suivante. */
  it('repropose une fourchette telle quelle tant qu’elle n’est pas faite', async () => {
    const bench = await anExercise('Développé couché');
    const routine = await createRoutine('Poussée');
    await addExercisesToRoutine(routine.id, [bench.id]);

    const routineRow = at(
      await db.routineExercises.where('routineId').equals(routine.id).toArray(),
      0,
    );
    const plan = at(
      await db.routineSets.where('routineExerciseId').equals(routineRow.id).toArray(),
      0,
    );
    await updateRoutineSet(plan.id, { targetReps: 8, targetRepsMax: 12, targetWeight: 80 });

    const workout = await startWorkoutFromRoutine(routine.id);
    const row = at((await getWorkoutDetail(workout.id))!.exercises, 0).row;
    const copy = await duplicateLastSet(row.id);

    expect([copy.targetReps, copy.targetRepsMax]).toEqual([8, 12]);
  });
});

describe('saisie et correction d’une série', () => {
  beforeEach(resetDb);

  /**
   * On écrit plus tôt que la règle non négociable n°4 ne l'exige : chaque frappe
   * pose la valeur, `isCompleted` reste 0. Un kill de l'app ne coûte donc même
   * pas les trois caractères en cours, et rien n'entre dans l'historique pour
   * autant.
   */
  it('écrit une valeur sans faire entrer la série dans l’historique', async () => {
    const workout = await startWorkout('', 'Séance libre');
    const row = await addWorkoutExercise(workout.id, 'bench');
    const set = at(at((await getWorkoutDetail(workout.id))!.exercises, 0).sets, 0);

    await updateSetValues(set.id, { weight: 102.5 });

    const stored = await db.workoutSets.get(set.id);
    expect(stored!.weight).toBe(102.5);
    expect(stored!.isCompleted).toBe(0);
    expect(stored!.performedAt).toBe(0);
    expect(await getLastPerformance('bench')).toEqual([]);
    expect(row.id).toBe(set.workoutExerciseId);
  });

  it('efface une valeur au lieu de la garder à l’ancienne', async () => {
    const workout = await startWorkout('', 'Séance libre');
    await addWorkoutExercise(workout.id, 'bench');
    const set = at(at((await getWorkoutDetail(workout.id))!.exercises, 0).sets, 0);

    await updateSetValues(set.id, { weight: 100 });
    await updateSetValues(set.id, { weight: undefined });

    expect((await db.workoutSets.get(set.id))!.weight).toBeUndefined();
  });

  it('décocher sort la série de l’historique sans effacer la saisie', async () => {
    const workout = await startWorkout('', 'Séance libre');
    await addWorkoutExercise(workout.id, 'bench');
    const set = at(at((await getWorkoutDetail(workout.id))!.exercises, 0).sets, 0);

    await completeSet(set.id, { weight: 100, reps: 5 });
    expect(await getLastPerformance('bench')).toHaveLength(1);

    await uncompleteSet(set.id);

    const stored = await db.workoutSets.get(set.id);
    expect(stored!.isCompleted).toBe(0);
    expect(stored!.performedAt).toBe(0);
    // Décocher corrige un geste, ça n'efface pas ce qui a été tapé.
    expect(stored!.weight).toBe(100);
    expect(await getLastPerformance('bench')).toEqual([]);
  });

  /**
   * RF-20. Requalifier une série ne touche pas à ce qui a été soulevé : on
   * change ce que la série *est*, pas ce qu'elle dit. La conséquence passe par
   * `isWorkingSet`, une seule règle pour le volume et les records.
   */
  it('change le type d’une série sans toucher aux chiffres ni à la validation', async () => {
    const workout = await startWorkout('', 'Séance libre');
    await addWorkoutExercise(workout.id, 'bench');
    const set = at(at((await getWorkoutDetail(workout.id))!.exercises, 0).sets, 0);

    await completeSet(set.id, { weight: 60, reps: 12 });
    await updateSetType(set.id, 'warmup');

    const stored = await db.workoutSets.get(set.id);
    expect(stored!.setType).toBe('warmup');
    expect(stored!.weight).toBe(60);
    expect(stored!.reps).toBe(12);
    expect(stored!.isCompleted).toBe(1);
    // Elle reste dans l'historique — c'est le scoring qui l'écarte, pas la base.
    expect(await getLastPerformance('bench')).toHaveLength(1);
  });

  it('valide une durée et une distance, pas seulement des kilos', async () => {
    const workout = await startWorkout('', 'Séance libre');
    await addWorkoutExercise(workout.id, 'rower');
    const set = at(at((await getWorkoutDetail(workout.id))!.exercises, 0).sets, 0);

    await completeSet(set.id, { distanceMeters: 1000, durationSeconds: 240 });

    const stored = await db.workoutSets.get(set.id);
    expect(stored!.distanceMeters).toBe(1000);
    expect(stored!.durationSeconds).toBe(240);
    expect(stored!.isCompleted).toBe(1);
  });
});
