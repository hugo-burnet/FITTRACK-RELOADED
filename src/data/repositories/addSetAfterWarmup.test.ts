import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import type { RoutineSet, SetType, WorkoutSet } from '@/data/types';
import { resetDb } from '@/test/resetDb';
import { createCustomExercise } from './exercises';
import { addExercisesToRoutine, addRoutineSet, createRoutine, updateRoutineSet } from './routines';
import {
  addSet,
  addWorkoutExercise,
  completeSet,
  duplicateLastSet,
  getWorkoutDetail,
  startWorkout,
  updateSetType,
} from './workouts';

/**
 * « Ajouter une série » repropose la précédente — sauf quand la précédente est un
 * échauffement. Ce qui vient après une série d'échauffement est une série de
 * travail, à une autre charge : la nouvelle héritait pourtant du type **et** des
 * chiffres de l'échauffement, et ces chiffres s'affichaient en gris comme la
 * suggestion d'une série normale — 40 × 5 proposés pour un travail à 100 × 8.
 *
 * Même défaut dans l'éditeur de routine, où la copie s'écrit en base et se rejoue
 * à chaque séance : elle passe devant ce que la séance précédente aurait proposé.
 */

function at<T>(list: readonly T[], index: number): T {
  const found = list[index];
  if (found === undefined) throw new Error(`élément ${index} absent (${list.length} au total)`);
  return found;
}

/** Tout ce qu'une série peut proposer, pour dire « rien » d'un seul `toEqual`. */
const prescriptionOf = (set: WorkoutSet | RoutineSet) => ({
  targetReps: set.targetReps,
  targetRepsMax: set.targetRepsMax,
  targetWeight: set.targetWeight,
  targetDurationSeconds: set.targetDurationSeconds,
  targetDistanceMeters: set.targetDistanceMeters,
});

const NOTHING_PROPOSED = {
  targetReps: undefined,
  targetRepsMax: undefined,
  targetWeight: undefined,
  targetDurationSeconds: undefined,
  targetDistanceMeters: undefined,
};

describe('ajouter une série en séance, après un échauffement', () => {
  beforeEach(resetDb);

  /** Un exercice de séance libre, avec sa première série encore vierge. */
  async function liveExercise(): Promise<{ rowId: string; firstSetId: string }> {
    const workout = await startWorkout('', 'Séance libre');
    const row = await addWorkoutExercise(workout.id, 'bench');
    const first = at(at((await getWorkoutDetail(workout.id))!.exercises, 0).sets, 0);
    return { rowId: row.id, firstSetId: first.id };
  }

  /** La première série, réalisée comme `type` — posée sans passer par ce qu'on teste. */
  async function performFirst(
    setId: string,
    type: SetType,
    weight: number,
    reps: number,
  ): Promise<void> {
    await updateSetType(setId, type);
    await completeSet(setId, { weight, reps });
  }

  /** Une série de plus, déjà réalisée, par l'ajout simple et non par la copie. */
  const performAnother = (rowId: string, setType: SetType, weight: number, reps: number) =>
    addSet(rowId, { setType, weight, reps, isCompleted: 1, performedAt: Date.now() });

  it('ne reprend ni le type ni les chiffres de l’échauffement', async () => {
    const { rowId, firstSetId } = await liveExercise();
    await performFirst(firstSetId, 'warmup', 40, 5);

    const added = await duplicateLastSet(rowId);

    expect(added.setType).toBe('normal');
    expect(prescriptionOf(added)).toEqual(NOTHING_PROPOSED);
    expect(added.order).toBe(1);
    expect(added.isCompleted).toBe(0);
  });

  it('ne reprend rien d’une rampe d’échauffement entière', async () => {
    const { rowId, firstSetId } = await liveExercise();
    await performFirst(firstSetId, 'warmup', 40, 5);
    await performAnother(rowId, 'warmup', 60, 3);

    const added = await duplicateLastSet(rowId);

    expect(added.setType).toBe('normal');
    expect(prescriptionOf(added)).toEqual(NOTHING_PROPOSED);
    expect(added.order).toBe(2);
  });

  it('repropose la série de travail qui suit l’échauffement, comme avant', async () => {
    const { rowId, firstSetId } = await liveExercise();
    await performFirst(firstSetId, 'warmup', 40, 5);
    await performAnother(rowId, 'normal', 100, 8);

    const added = await duplicateLastSet(rowId);

    expect(added.setType).toBe('normal');
    expect([added.targetWeight, added.targetReps]).toEqual([100, 8]);
  });

  it('saute l’échauffement posé après le travail pour reproposer le travail', async () => {
    const { rowId, firstSetId } = await liveExercise();
    await performFirst(firstSetId, 'normal', 100, 8);
    await performAnother(rowId, 'warmup', 40, 5);

    const added = await duplicateLastSet(rowId);

    expect(added.setType).toBe('normal');
    expect([added.targetWeight, added.targetReps]).toEqual([100, 8]);
  });

  /** Seul l'échauffement est écarté : une série dégressive s'enchaîne toujours. */
  it('garde le type d’une série de travail autre que normale', async () => {
    const { rowId, firstSetId } = await liveExercise();
    await performFirst(firstSetId, 'normal', 100, 8);
    await performAnother(rowId, 'dropset', 80, 8);

    const added = await duplicateLastSet(rowId);

    expect(added.setType).toBe('dropset');
    expect([added.targetWeight, added.targetReps]).toEqual([80, 8]);
  });
});

describe('ajouter une série à une routine, après un échauffement', () => {
  beforeEach(resetDb);

  /** Une routine d'un exercice, avec sa première série prévue encore vierge. */
  async function plannedExercise(): Promise<{ rowId: string; firstSetId: string }> {
    const exercise = await createCustomExercise({
      name: 'Développé couché',
      primaryMuscle: 'chest',
      secondaryMuscles: [],
      equipment: 'barbell',
      measurementType: 'weight_reps',
      isUnilateral: 0,
    });
    const routine = await createRoutine('Poussée');
    await addExercisesToRoutine(routine.id, [exercise.id]);
    const row = at(await db.routineExercises.where('routineId').equals(routine.id).toArray(), 0);
    const first = at(await db.routineSets.where('routineExerciseId').equals(row.id).toArray(), 0);
    return { rowId: row.id, firstSetId: first.id };
  }

  it('ne recopie ni le type ni les cibles de l’échauffement, effort compris', async () => {
    const { rowId, firstSetId } = await plannedExercise();
    await updateRoutineSet(firstSetId, {
      setType: 'warmup',
      targetWeight: 40,
      targetReps: 5,
      targetRpe: 5,
    });

    const added = await addRoutineSet(rowId);

    expect(added.setType).toBe('normal');
    expect(prescriptionOf(added)).toEqual(NOTHING_PROPOSED);
    expect(added.targetRpe).toBeUndefined();
    expect(added.order).toBe(1);
  });

  it('ne recopie rien de plusieurs échauffements d’affilée', async () => {
    const { rowId, firstSetId } = await plannedExercise();
    await updateRoutineSet(firstSetId, { setType: 'warmup', targetWeight: 40, targetReps: 5 });
    const second = await addRoutineSet(rowId);
    await updateRoutineSet(second.id, { setType: 'warmup', targetWeight: 60, targetReps: 3 });

    const added = await addRoutineSet(rowId);

    expect(added.setType).toBe('normal');
    expect(prescriptionOf(added)).toEqual(NOTHING_PROPOSED);
    expect(added.order).toBe(2);
  });

  it('recopie la série de travail qui suit l’échauffement, fourchette et effort compris', async () => {
    const { rowId, firstSetId } = await plannedExercise();
    await updateRoutineSet(firstSetId, { setType: 'warmup', targetWeight: 40, targetReps: 5 });
    const work = await addRoutineSet(rowId);
    await updateRoutineSet(work.id, {
      setType: 'normal',
      targetWeight: 100,
      targetReps: 8,
      targetRepsMax: 10,
      targetRpe: 7,
    });

    const added = await addRoutineSet(rowId);

    expect(added).toMatchObject({
      setType: 'normal',
      targetWeight: 100,
      targetReps: 8,
      targetRepsMax: 10,
      targetRpe: 7,
    });
  });

  it('saute l’échauffement placé après le travail pour recopier le travail', async () => {
    const { rowId, firstSetId } = await plannedExercise();
    await updateRoutineSet(firstSetId, { targetWeight: 100, targetReps: 8 });
    const trailing = await addRoutineSet(rowId);
    await updateRoutineSet(trailing.id, { setType: 'warmup', targetWeight: 40, targetReps: 5 });

    const added = await addRoutineSet(rowId);

    expect(added).toMatchObject({ setType: 'normal', targetWeight: 100, targetReps: 8 });
  });
});
