import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { DEFAULT_REST_SECONDS } from '@/lib/rest';
import type { WorkoutExercise } from '@/data/types';
import { resetDb } from '@/test/resetDb';
import { sideStageFor } from '@/features/workout/sideProgress';
import { newEntity } from './base';
import { addSet, completeFirstSide, completeSet, uncompleteSet } from './workoutSets';
import { startWorkout } from './workouts';

async function pendingSet(setType: 'normal' | 'warmup' = 'normal') {
  const workout = await startWorkout('', 'Séance de test');
  const workoutExercise = newEntity<WorkoutExercise>({
    workoutId: workout.id,
    exerciseId: 'bench',
    order: 0,
    supersetGroup: 0,
    restSeconds: DEFAULT_REST_SECONDS,
  });
  await db.workoutExercises.add(workoutExercise);
  return addSet(workoutExercise.id, { setType });
}

describe('progression des côtés', () => {
  beforeEach(resetDb);

  /*
   * Finir un côté n'est pas finir la série. Écrire `isCompleted` ici aurait
   * enregistré la moitié d'une série comme une série entière — et déclenché
   * les records sur elle.
   */
  it('persiste le premier côté sans valider la série', async () => {
    const set = await pendingSet();

    expect(await completeFirstSide(set.id, 1_000)).toEqual({ kind: 'started', startsAt: 11_000 });
    expect(await db.workoutSets.get(set.id)).toMatchObject({
      isCompleted: 0,
      performedAt: 0,
      unilateralSecondSideStartsAt: 11_000,
    });
  });

  /*
   * Idempotent : un second appui pendant la transition ne redémarre pas les dix
   * secondes. Sans cette garde, taper deux fois repoussait le second côté.
   */
  it('ne redémarre pas la transition sur un second appui', async () => {
    const set = await pendingSet();
    await completeFirstSide(set.id, 1_000);

    expect(await completeFirstSide(set.id, 4_000)).toEqual({ kind: 'existing', startsAt: 11_000 });
  });

  it('ignore un échauffement', async () => {
    const set = await pendingSet('warmup');

    expect(await completeFirstSide(set.id, 1_000)).toEqual({ kind: 'ignored' });
    expect((await db.workoutSets.get(set.id))?.unilateralSecondSideStartsAt).toBeUndefined();
  });

  /*
   * La progression intermédiaire ne survit ni à la validation ni à la décoche.
   * Une série décochée revient au premier côté : c'est la seule lecture qui ne
   * ment pas sur ce qu'il reste à faire.
   */
  it('efface la progression à la validation et à la décoche', async () => {
    const set = await pendingSet();
    await completeFirstSide(set.id, 1_000);
    await completeSet(set.id, { reps: 10 });

    expect((await db.workoutSets.get(set.id))?.unilateralSecondSideStartsAt).toBeUndefined();

    await uncompleteSet(set.id);
    const reopened = await db.workoutSets.get(set.id);
    expect(reopened).toBeDefined();
    expect(sideStageFor(reopened!, true, 20_000)).toBe('first');
  });

  /*
   * Le champ n'est pas indexé et n'a donc demandé aucune version Dexie. Il doit
   * malgré tout traverser une sauvegarde : exporter au milieu d'une transition
   * et réimporter ne doit pas renvoyer au premier côté.
   */
  it('traverse un aller-retour JSON', async () => {
    const set = await pendingSet();
    await completeFirstSide(set.id, 1_000);

    const stored = await db.workoutSets.get(set.id);
    const roundTripped = JSON.parse(JSON.stringify(stored)) as typeof stored;

    expect(roundTripped?.unilateralSecondSideStartsAt).toBe(11_000);
  });
});
