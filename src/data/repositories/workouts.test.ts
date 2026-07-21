import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { resetDb } from '@/test/resetDb';
import { day, seedWorkout } from '@/test/factories';
import { newEntity } from './base';
import {
  addSet,
  completeSet,
  deleteWorkout,
  finishWorkout,
  getActiveWorkout,
  getLastPerformance,
  startWorkout,
} from './workouts';
import type { WorkoutExercise, WorkoutSet } from '@/data/types';

/** Attaches an exercise to a workout, the way the Lot 5 screen will. */
async function addExercise(workoutId: string, exerciseId: string): Promise<WorkoutExercise> {
  const workoutExercise = newEntity<WorkoutExercise>({
    workoutId,
    exerciseId,
    order: 0,
    supersetGroup: 0,
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
