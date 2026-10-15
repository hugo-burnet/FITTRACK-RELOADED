import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import type { Exercise, WorkoutExercise, WorkoutSet } from '@/data/types';
import { resetDb } from '@/test/resetDb';
import { createCustomExercise, deleteExercise } from './exercises';
import {
  addSet,
  addWorkoutExercise,
  completeSet,
  finishWorkout,
  getWorkoutDetail,
  replaceWorkoutExercise,
  startWorkout,
  updateSetValues,
  updateWorkoutExercise,
} from './workouts';

/**
 * « La machine est prise » : l'exercice de la séance en cours remplacé par un autre.
 *
 * On remplace **ce qu'il reste à faire**, jamais ce qui est fait : une série validée dit ce qui a
 * été soulevé sur une machine précise, et la réattribuer à une autre réécrirait la séance — et les
 * records, qui se calculent sur ce que l'exercice a réellement fait.
 */

function at<T>(list: readonly T[], index: number): T {
  const found = list[index];
  if (found === undefined) throw new Error(`élément ${index} absent (${list.length} au total)`);
  return found;
}

const newExercise = (overrides: Partial<Exercise> & { name: string }) =>
  createCustomExercise({
    primaryMuscle: 'chest',
    secondaryMuscles: [],
    equipment: 'barbell',
    measurementType: 'weight_reps',
    isUnilateral: 0,
    ...overrides,
  });

async function rowsOf(workoutId: string): Promise<WorkoutExercise[]> {
  return (await db.workoutExercises.where('workoutId').equals(workoutId).toArray())
    .filter((row) => row.deletedAt === 0)
    .sort((a, b) => a.order - b.order);
}

async function setsOf(rowId: string): Promise<WorkoutSet[]> {
  return (await db.workoutSets.where('workoutExerciseId').equals(rowId).toArray())
    .filter((set) => set.deletedAt === 0)
    .sort((a, b) => a.order - b.order);
}

/** Une ligne de séance avec `count` séries, la première posée par `addWorkoutExercise`. */
async function liveRow(
  workoutId: string,
  exercise: Exercise,
  count: number,
  targets: { targetReps?: number; targetRepsMax?: number; targetWeight?: number } = {},
): Promise<WorkoutExercise> {
  const row = await addWorkoutExercise(workoutId, exercise.id);
  const first = at(await setsOf(row.id), 0);
  await db.workoutSets.update(first.id, targets);
  for (let index = 1; index < count; index += 1) await addSet(row.id, targets);
  return row;
}

describe('replaceWorkoutExercise', () => {
  let press: Exercise;
  let machine: Exercise;
  let workoutId: string;

  beforeEach(async () => {
    await resetDb();
    press = await newExercise({
      name: 'Développé couché',
      secondaryMuscles: ['triceps'],
      defaultRestSeconds: 150,
    });
    machine = await newExercise({
      name: 'Presse pectorale à la machine',
      equipment: 'machine',
      defaultRestSeconds: 90,
    });
    workoutId = (await startWorkout('', 'Séance')).id;
  });

  describe('aucune série validée : la ligne devient l’autre exercice', () => {
    it('change l’exercice, son instantané et son repos, et garde la place', async () => {
      const x = await liveRow(workoutId, await newExercise({ name: 'X' }), 1);
      const row = await liveRow(workoutId, press, 3, { targetReps: 8, targetRepsMax: 12 });
      await updateWorkoutExercise(row.id, { notes: 'siège position 4', repSeconds: 4 });
      const y = await liveRow(workoutId, await newExercise({ name: 'Y' }), 1);

      await expect(replaceWorkoutExercise(row.id, machine.id)).resolves.toBe('replaced');

      const rows = await rowsOf(workoutId);
      expect(rows.map((r) => r.id)).toEqual([x.id, row.id, y.id]);
      expect(rows.map((r) => r.order)).toEqual([0, 1, 2]);
      const replaced = at(rows, 1);
      expect(replaced).toMatchObject({
        exerciseId: machine.id,
        exerciseName: 'Presse pectorale à la machine',
        exerciseMeasurementType: 'weight_reps',
        exerciseEquipment: 'machine',
        restSeconds: 90,
        notes: 'siège position 4',
      });
      expect(replaced.exerciseSecondaryMuscles).toBeUndefined();
      expect(replaced.repSeconds).toBeUndefined();
    });

    it('garde le nombre de séries, leur type et la fourchette de répétitions, sans les chiffres', async () => {
      const row = await liveRow(workoutId, press, 3, {
        targetReps: 8,
        targetRepsMax: 12,
        targetWeight: 100,
      });
      const sets = await setsOf(row.id);
      await updateSetValues(at(sets, 0).id, { weight: 100, reps: 9 });
      await db.workoutSets.update(at(sets, 1).id, { setType: 'warmup' });

      await replaceWorkoutExercise(row.id, machine.id);

      const after = await setsOf(row.id);
      expect(after).toHaveLength(3);
      expect(after.map((set) => set.order)).toEqual([0, 1, 2]);
      expect(after.map((set) => set.setType)).toEqual(['normal', 'warmup', 'normal']);
      for (const set of after) {
        expect(set.exerciseId).toBe(machine.id);
        expect(set.workoutExerciseId).toBe(row.id);
        expect(set.isCompleted).toBe(0);
        expect(set.weight).toBeUndefined();
        expect(set.reps).toBeUndefined();
        expect(set.targetWeight).toBeUndefined();
        expect(set).toMatchObject({ targetReps: 8, targetRepsMax: 12 });
      }
    });

    it('abandonne les répétitions visées pour un exercice qui se chronomètre', async () => {
      const plank = await newExercise({
        name: 'Gainage',
        measurementType: 'time_only',
        equipment: 'bodyweight',
        primaryMuscle: 'abs',
      });
      const row = await liveRow(workoutId, press, 2, { targetReps: 8, targetRepsMax: 12 });

      await replaceWorkoutExercise(row.id, plank.id);

      expect(at(await rowsOf(workoutId), 0)).toMatchObject({
        exerciseMeasurementType: 'time_only',
      });
      for (const set of await setsOf(row.id)) {
        expect(set.targetReps).toBeUndefined();
        expect(set.targetRepsMax).toBeUndefined();
      }
    });

    it('relit le « Précédent » du nouvel exercice, pas celui de l’ancien', async () => {
      // Une séance passée sur la presse : c'est elle que la ligne doit proposer, plus le développé.
      // La séance de `beforeEach` en tient lieu, terminée, avant d'en lancer une autre.
      const pastRow = await addWorkoutExercise(workoutId, machine.id);
      await completeSet(at(await setsOf(pastRow.id), 0).id, { weight: 60, reps: 12 });
      await finishWorkout(workoutId);
      const today = (await startWorkout('', 'Aujourd’hui')).id;

      const row = await liveRow(today, press, 1);
      await replaceWorkoutExercise(row.id, machine.id);

      const detail = await getWorkoutDetail(today);
      const line = at(detail!.exercises, 0);
      expect(line.previous.map((set) => [set.weight, set.reps])).toEqual([[60, 12]]);
    });
  });

  describe('des séries déjà validées : l’autre exercice reprend derrière', () => {
    it('garde les séries faites sur l’ancien exercice et déplace le reste vers le nouveau', async () => {
      const x = await liveRow(workoutId, await newExercise({ name: 'X' }), 1);
      const row = await liveRow(workoutId, press, 4, { targetReps: 8, targetRepsMax: 12 });
      const y = await liveRow(workoutId, await newExercise({ name: 'Y' }), 1);
      const sets = await setsOf(row.id);
      await completeSet(at(sets, 0).id, { weight: 100, reps: 8 });
      await completeSet(at(sets, 1).id, { weight: 100, reps: 8 });
      const doneIds = [at(sets, 0).id, at(sets, 1).id];

      await expect(replaceWorkoutExercise(row.id, machine.id)).resolves.toBe('continued');

      const rows = await rowsOf(workoutId);
      expect(rows.map((r) => r.exerciseId)).toEqual([
        x.exerciseId,
        press.id,
        machine.id,
        y.exerciseId,
      ]);
      expect(rows.map((r) => r.order)).toEqual([0, 1, 2, 3]);

      // Les séries faites n'ont pas bougé : même ligne, même exercice, toujours validées.
      const oldSets = await setsOf(row.id);
      expect(oldSets.map((s) => s.id)).toEqual(doneIds);
      expect(oldSets.every((s) => s.exerciseId === press.id && s.isCompleted === 1)).toBe(true);
      expect(oldSets.map((s) => s.weight)).toEqual([100, 100]);

      // Le reste est parti, à faire, derrière : la ligne de l'autre exercice.
      const continuation = at(rows, 2);
      const moved = await setsOf(continuation.id);
      expect(moved).toHaveLength(2);
      expect(moved.map((s) => s.order)).toEqual([0, 1]);
      expect(moved.every((s) => s.exerciseId === machine.id && s.isCompleted === 0)).toBe(true);
      expect(moved.every((s) => s.workoutId === workoutId)).toBe(true);
      expect(continuation).toMatchObject({
        exerciseName: 'Presse pectorale à la machine',
        restSeconds: 90,
      });
    });

    it('ne touche pas aux records : ce qui a été fait reste fait', async () => {
      const row = await liveRow(workoutId, press, 3);
      const sets = await setsOf(row.id);
      await completeSet(at(sets, 0).id, { weight: 100, reps: 8 });
      const before = await db.personalRecords.toArray();
      expect(before.length).toBeGreaterThan(0);

      await replaceWorkoutExercise(row.id, machine.id);

      const after = await db.personalRecords.toArray();
      expect(after.map((r) => [r.exerciseId, r.type, r.value]).sort()).toEqual(
        before.map((r) => [r.exerciseId, r.type, r.value]).sort(),
      );
      expect(after.every((r) => r.exerciseId === press.id)).toBe(true);
    });

    it('reste dans le superset de la ligne qu’il continue', async () => {
      const row = await liveRow(workoutId, press, 3);
      const partner = await liveRow(workoutId, await newExercise({ name: 'Y' }), 2);
      await db.workoutExercises.bulkUpdate([
        { key: row.id, changes: { supersetGroup: 1 } },
        { key: partner.id, changes: { supersetGroup: 1 } },
      ]);
      await completeSet(at(await setsOf(row.id), 0).id, { weight: 100, reps: 8 });

      await replaceWorkoutExercise(row.id, machine.id);

      const rows = await rowsOf(workoutId);
      expect(rows.map((r) => r.supersetGroup)).toEqual([1, 1, 1]);
    });
  });

  describe('ce qu’elle refuse', () => {
    it('ne remplace rien quand toutes les séries sont validées', async () => {
      const row = await liveRow(workoutId, press, 2);
      for (const set of await setsOf(row.id)) await completeSet(set.id, { weight: 100, reps: 8 });

      await expect(replaceWorkoutExercise(row.id, machine.id)).resolves.toBe('nothing_left');

      expect(await rowsOf(workoutId)).toHaveLength(1);
      expect(at(await rowsOf(workoutId), 0).exerciseId).toBe(press.id);
    });

    it('ne fait rien quand l’exercice est le même', async () => {
      const row = await liveRow(workoutId, press, 2);
      const before = await setsOf(row.id);

      await expect(replaceWorkoutExercise(row.id, press.id)).resolves.toBe('same_exercise');

      expect(await setsOf(row.id)).toEqual(before);
    });

    it('refuse un exercice absent ou supprimé, et une ligne absente', async () => {
      const row = await liveRow(workoutId, press, 2);
      const gone = await newExercise({ name: 'Supprimé' });
      await deleteExercise(gone.id);

      await expect(replaceWorkoutExercise(row.id, 'inconnu')).resolves.toBe('unknown');
      await expect(replaceWorkoutExercise(row.id, gone.id)).resolves.toBe('unknown');
      await expect(replaceWorkoutExercise('inconnue', machine.id)).resolves.toBe('unknown');
      expect(at(await rowsOf(workoutId), 0).exerciseId).toBe(press.id);
    });
  });
});
