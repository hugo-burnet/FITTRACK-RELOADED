import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { parseBackup, serializeBackup } from '@/lib/backup';
import { resetDb } from '@/test/resetDb';
import { buildBackup, restoreBackup } from './backup';
import { createCustomExercise } from './exercises';
import { addExercisesToRoutine, createRoutine } from './routines';
import { completeSet, getWorkoutDetail, startWorkoutFromRoutine } from './workouts';
import { finishWorkout } from './workoutLifecycle';
import { setAvailablePlateWeightsKg, setOneRepMaxFormula } from './settings';

/** Une vie d'app : un exercice perso, une routine, une séance terminée, un réglage. */
async function seedAccount(): Promise<{ exerciseId: string; routineId: string }> {
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
  const workout = await startWorkoutFromRoutine(routine.id);
  const set = (await getWorkoutDetail(workout.id))?.exercises[0]?.sets[0];
  if (set === undefined) throw new Error('série absente');
  await completeSet(set.id, { weight: 80, reps: 8 });
  await finishWorkout(workout.id);
  await setOneRepMaxFormula('brzycki');
  await setAvailablePlateWeightsKg([20, 10, 5]);
  localStorage.setItem('fittrack:theme', 'light');

  return { exerciseId: exercise.id, routineId: routine.id };
}

describe('sauvegarde complète', () => {
  beforeEach(async () => {
    localStorage.clear();
    await resetDb();
  });

  it('emporte les tables, les réglages et les préférences', async () => {
    const { exerciseId, routineId } = await seedAccount();

    const backup = await buildBackup(1_700_000_000_000);

    expect(backup.tables.exercises.some((row) => row.id === exerciseId)).toBe(true);
    expect(backup.tables.routines.some((row) => row.id === routineId)).toBe(true);
    expect(backup.tables.workouts).toHaveLength(1);
    expect(backup.tables.workoutSets).toHaveLength(1);
    // Les records sont projetés à la validation : la sauvegarde les emporte
    // tels quels plutôt que de les faire recalculer à la restauration.
    expect(backup.tables.personalRecords.length).toBeGreaterThan(0);
    expect(
      backup.tables.settings.some((row) => row.key === 'oneRepMaxFormula'),
    ).toBe(true);
    expect(backup.preferences['fittrack:theme']).toBe('light');
    expect(backup.app.schemaVersion).toBeGreaterThan(0);
  });

  it('revient à l’identique après un aller-retour par le fichier', async () => {
    await seedAccount();
    const before = await buildBackup();
    const text = serializeBackup(before);

    // Le téléphone d'après : plus rien, ni base ni préférences.
    await resetDb();
    localStorage.clear();
    expect(await db.workouts.count()).toBe(0);

    const parsed = parseBackup(text);
    if (!parsed.ok) throw new Error(`sauvegarde refusée : ${parsed.problem}`);
    await restoreBackup(parsed.backup);

    const after = await buildBackup(before.exportedAt);
    // Comparé au travers du JSON : un champ posé à `undefined` ne traverse pas
    // un fichier, et n'a pas à le faire — absent et `undefined` se lisent
    // pareil partout dans l'app (`set.reps === undefined`).
    expect(after.tables).toEqual(JSON.parse(text).tables);
    expect(after.preferences).toEqual(before.preferences);
    expect(localStorage.getItem('fittrack:theme')).toBe('light');
  });

  it('remplace ce qui est là plutôt que de s’y ajouter', async () => {
    await seedAccount();
    const backup = await buildBackup();

    await resetDb();
    localStorage.clear();
    await seedAccount();
    const otherRoutine = await createRoutine('Séance d’un autre téléphone');

    await restoreBackup(backup);

    expect(await db.routines.get(otherRoutine.id)).toBeUndefined();
    expect(await db.workouts.count()).toBe(backup.tables.workouts.length);
  });

  it('ne laisse pas une préférence hors de son espace de noms entrer', async () => {
    await seedAccount();
    const backup = await buildBackup();
    backup.preferences = { 'fittrack:theme': 'dark', evil: 'oui' };

    await restoreBackup(backup);

    expect(localStorage.getItem('fittrack:theme')).toBe('dark');
    expect(localStorage.getItem('evil')).toBeNull();
  });

  /**
   * Le fichier écrit avant la version 9 du schéma porte des exercices perso
   * sans coefficient — et un coefficient absent vaut zéro au tonnage. Aucune
   * migration Dexie ne passe sur une restauration : le numéro de version de la
   * base ne bouge pas. C'est `restoreBackup` qui doit rattraper, ou personne.
   */
  it('remet à niveau un fichier écrit sous un schéma plus ancien', async () => {
    await seedAccount();
    const backup = await buildBackup();
    const pullUp = {
      id: 'ex-traction',
      createdAt: 1,
      updatedAt: 1,
      deletedAt: 0,
      name: 'Traction',
      primaryMuscle: 'lats',
      secondaryMuscles: ['biceps'],
      equipment: 'bodyweight',
      measurementType: 'reps_only',
      isCustom: 1,
      isUnilateral: 0,
    };
    backup.tables.exercises = [...backup.tables.exercises, pullUp];
    backup.app.schemaVersion = 8;

    await restoreBackup(backup);

    expect((await db.exercises.get('ex-traction'))?.bodyweightLoadFactor).toBe(1);
  });

  it('ne retouche rien quand le fichier vient du schéma courant', async () => {
    await seedAccount();
    const backup = await buildBackup();
    const untouched = structuredClone(backup.tables);

    await restoreBackup(backup);

    const after = await buildBackup(backup.exportedAt);
    expect(after.tables).toEqual(untouched);
  });
});
