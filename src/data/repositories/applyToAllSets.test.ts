import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import type { SetType } from '@/data/types';
import { resetDb } from '@/test/resetDb';
import { createCustomExercise } from './exercises';
import {
  addExercisesToRoutine,
  addRoutineSet,
  applyToAllSets,
  createRoutine,
  updateRoutineSet,
} from './routines';
import type { RoutineSetTargets } from './routines';

/**
 * « Appliquer à toutes les séries » reçoit **tout le brouillon de la feuille**, type
 * compris, et l'écrivait sur chaque série de l'exercice. Depuis une série de
 * travail à 105 kg, l'échauffement planifié devenait une série de travail à
 * 105 kg : `[échauffement 40 × 5, travail 100 × 8]` donnait deux séries normales
 * à 105 × 8.
 *
 * Monter un exercice de 100 à 105 kg ne doit pas toucher l'échauffement ; et
 * appliquer les chiffres d'un échauffement ne doit pas en faire des séries de
 * travail.
 */

function at<T>(list: readonly T[], index: number): T {
  const found = list[index];
  if (found === undefined) throw new Error(`élément ${index} absent (${list.length} au total)`);
  return found;
}

type Planned = { setType: SetType; weight: number; reps: number };

/** Un exercice de routine dont les séries prévues sont exactement celles du plan. */
async function exerciseWith(plan: Planned[]): Promise<string> {
  const exercise = await createCustomExercise({
    name: 'Squat',
    primaryMuscle: 'quads',
    secondaryMuscles: [],
    equipment: 'barbell',
    measurementType: 'weight_reps',
    isUnilateral: 0,
  });
  const routine = await createRoutine('Jambes');
  await addExercisesToRoutine(routine.id, [exercise.id]);
  const row = at(await db.routineExercises.where('routineId').equals(routine.id).toArray(), 0);
  const first = at(await db.routineSets.where('routineExerciseId').equals(row.id).toArray(), 0);

  for (const [index, set] of plan.entries()) {
    const id = index === 0 ? first.id : (await addRoutineSet(row.id)).id;
    await updateRoutineSet(id, {
      setType: set.setType,
      targetWeight: set.weight,
      targetReps: set.reps,
    });
  }
  return row.id;
}

/** Le plan relu en base, lisible d'un coup d'œil dans un diff : `type:chargexreps`. */
const planOf = async (rowId: string): Promise<string[]> =>
  (await db.routineSets.where('routineExerciseId').equals(rowId).sortBy('order')).map(
    (set) => `${set.setType}:${set.targetWeight}x${set.targetReps}`,
  );

/** Ce que la feuille envoie : le brouillon de la série ouverte, champ vide compris. */
const fromSheet = (setType: SetType, weight: number, reps: number): RoutineSetTargets => ({
  setType,
  targetReps: reps,
  targetRepsMax: undefined,
  targetWeight: weight,
  targetDurationSeconds: undefined,
  targetDistanceMeters: undefined,
});

describe('applyToAllSets', () => {
  beforeEach(resetDb);

  it('monte les séries de travail sans toucher à l’échauffement planifié', async () => {
    const rowId = await exerciseWith([
      { setType: 'warmup', weight: 40, reps: 5 },
      { setType: 'normal', weight: 100, reps: 8 },
      { setType: 'normal', weight: 100, reps: 8 },
    ]);

    await applyToAllSets(rowId, fromSheet('normal', 105, 8));

    expect(await planOf(rowId)).toEqual(['warmup:40x5', 'normal:105x8', 'normal:105x8']);
  });

  it('ne réécrit jamais le type d’une série', async () => {
    const rowId = await exerciseWith([
      { setType: 'normal', weight: 100, reps: 8 },
      { setType: 'dropset', weight: 80, reps: 6 },
    ]);

    await applyToAllSets(rowId, fromSheet('normal', 105, 8));

    expect(await planOf(rowId)).toEqual(['normal:105x8', 'dropset:105x8']);
  });

  it('depuis un échauffement, ne touche que les autres échauffements', async () => {
    const rowId = await exerciseWith([
      { setType: 'warmup', weight: 40, reps: 5 },
      { setType: 'warmup', weight: 60, reps: 3 },
      { setType: 'normal', weight: 100, reps: 8 },
    ]);

    await applyToAllSets(rowId, fromSheet('warmup', 50, 5));

    expect(await planOf(rowId)).toEqual(['warmup:50x5', 'warmup:50x5', 'normal:100x8']);
  });

  it('prend des chiffres sans type pour des chiffres de travail', async () => {
    const rowId = await exerciseWith([
      { setType: 'warmup', weight: 40, reps: 5 },
      { setType: 'normal', weight: 100, reps: 8 },
      { setType: 'normal', weight: 100, reps: 8 },
    ]);

    await applyToAllSets(rowId, { targetWeight: 85 });

    expect(await planOf(rowId)).toEqual(['warmup:40x5', 'normal:85x8', 'normal:85x8']);
  });

  it('recopie aussi l’absence d’une fourchette que la feuille ne montre plus', async () => {
    const rowId = await exerciseWith([
      { setType: 'normal', weight: 100, reps: 8 },
      { setType: 'normal', weight: 100, reps: 8 },
    ]);
    for (const set of await db.routineSets.where('routineExerciseId').equals(rowId).toArray()) {
      await updateRoutineSet(set.id, { targetRepsMax: 12 });
    }

    await applyToAllSets(rowId, fromSheet('normal', 100, 8));

    const sets = await db.routineSets.where('routineExerciseId').equals(rowId).toArray();
    expect(sets.map((set) => set.targetRepsMax)).toEqual([undefined, undefined]);
  });
});
