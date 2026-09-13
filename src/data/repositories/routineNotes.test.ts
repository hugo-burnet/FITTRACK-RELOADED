import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { CURRENT_SCHEMA_VERSION, parseBackup, serializeBackup } from '@/lib/backup';
import { resetDb } from '@/test/resetDb';
import { buildBackup, restoreBackup } from './backup';
import { createCustomExercise } from './exercises';
import {
  addExercisesToRoutine,
  createRoutine,
  getRoutineDetail,
  updateRoutineExercise,
} from './routines';
import { getWorkoutDetail, startWorkoutFromRoutine, updateWorkoutExercise } from './workouts';

/**
 * La consigne de réglage, de la routine jusqu'au banc — et son sens unique.
 *
 * Le champ existait des deux côtés et le report était déjà écrit ; ce qui
 * manquait, c'est ce qui l'empêche de repartir. Ces tests tiennent les deux
 * bouts du contrat : ce que la routine dicte à une séance neuve, et ce que la
 * séance n'a pas le droit de renvoyer à la routine.
 *
 * Le sens inverse est le seul des deux qu'on ne verrait pas casser. Un report
 * qui ne se fait plus se remarque au premier exercice ; une remontée qui
 * s'installe réécrit le programme depuis le banc, en silence, et ne se découvre
 * que des semaines plus tard devant une consigne que personne n'a tapée.
 */

const SETTING = 'Poulie haute, cran 3. Buste incliné, coudes serrés.';

async function aRoutineWithOneExercise(): Promise<{
  routineId: string;
  routineExerciseId: string;
}> {
  const exercise = await createCustomExercise({
    name: 'Extension triceps à la poulie',
    primaryMuscle: 'triceps',
    secondaryMuscles: [],
    equipment: 'cable',
    measurementType: 'weight_reps',
    isUnilateral: 0,
  });
  const routine = await createRoutine('Poussée');
  await addExercisesToRoutine(routine.id, [exercise.id]);

  const line = (await getRoutineDetail(routine.id))?.exercises[0];
  if (line === undefined) throw new Error('ligne de routine absente');

  return { routineId: routine.id, routineExerciseId: line.row.id };
}

describe('la note de réglage d’une ligne de routine', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('naît vide plutôt qu’absente', async () => {
    const { routineExerciseId } = await aRoutineWithOneExercise();

    expect((await db.routineExercises.get(routineExerciseId))?.notes).toBe('');
  });

  describe('le report au démarrage d’une séance', () => {
    it('initialise la note de la séance avec celle de la routine', async () => {
      const { routineId, routineExerciseId } = await aRoutineWithOneExercise();
      await updateRoutineExercise(routineExerciseId, { notes: SETTING });

      const workout = await startWorkoutFromRoutine(routineId);

      const line = (await getWorkoutDetail(workout.id))?.exercises[0];
      expect(line?.row.notes).toBe(SETTING);
    });

    it('ne renvoie pas à la routine la note corrigée pendant la séance', async () => {
      const { routineId, routineExerciseId } = await aRoutineWithOneExercise();
      await updateRoutineExercise(routineExerciseId, { notes: SETTING });

      const workout = await startWorkoutFromRoutine(routineId);
      const line = (await getWorkoutDetail(workout.id))?.exercises[0];
      if (line === undefined) throw new Error('ligne de séance absente');

      await updateWorkoutExercise(line.row.id, { notes: 'Cran 4, finalement.' });

      // La séance a bougé…
      const workoutRow = await db.workoutExercises.get(line.row.id);
      expect(workoutRow?.notes).toBe('Cran 4, finalement.');
      // …et la routine n'a pas bougé avec elle.
      expect((await db.routineExercises.get(routineExerciseId))?.notes).toBe(SETTING);
    });

    it('ne réécrit pas une séance déjà en cours quand la routine change', async () => {
      const { routineId, routineExerciseId } = await aRoutineWithOneExercise();
      await updateRoutineExercise(routineExerciseId, { notes: SETTING });

      const workout = await startWorkoutFromRoutine(routineId);
      await updateRoutineExercise(routineExerciseId, { notes: 'Consigne de la semaine suivante.' });

      const line = (await getWorkoutDetail(workout.id))?.exercises[0];
      expect(line?.row.notes).toBe(SETTING);
    });
  });

  describe('l’aller-retour par le fichier de sauvegarde', () => {
    it('emporte la note et la rend telle quelle (schéma courant)', async () => {
      const { routineExerciseId } = await aRoutineWithOneExercise();
      await updateRoutineExercise(routineExerciseId, { notes: SETTING });

      const text = serializeBackup(await buildBackup());
      await resetDb();

      const parsed = parseBackup(text);
      if (!parsed.ok) throw new Error(`fichier refusé : ${parsed.problem}`);
      expect(parsed.backup.app.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      await restoreBackup(parsed.backup);

      expect((await db.routineExercises.get(routineExerciseId))?.notes).toBe(SETTING);
    });

    it('accepte un fichier en version 12, où la note n’existait pas encore', async () => {
      const { routineExerciseId } = await aRoutineWithOneExercise();

      // Un vrai fichier d'avant : la version 12 dans l'en-tête, et le champ
      // retiré de toutes les lignes — pas seulement le numéro changé.
      const built = await buildBackup();
      const older = {
        ...built,
        app: { ...built.app, schemaVersion: 12 },
        tables: {
          ...built.tables,
          // Recomposée clé par clé, pas déstructurée : la liaison inutilisée
          // que laisse `const { notes, ...rest }` est exactement ce que la
          // règle de lint a raison de refuser — `backfill.ts` le dit déjà pour
          // son propre `omit`.
          routineExercises: built.tables.routineExercises.map((row) =>
            Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'notes')),
          ),
        },
      };
      const text = serializeBackup(older);
      await resetDb();

      const parsed = parseBackup(text);
      if (!parsed.ok) throw new Error(`fichier refusé : ${parsed.problem}`);
      await restoreBackup(parsed.backup);

      // Absent devient chaîne vide, jamais `undefined` : c'est le rattrapage de
      // la version 13 qui s'exécute ici, puisqu'aucun `upgrade()` Dexie ne se
      // déclenche sur une restauration.
      expect((await db.routineExercises.get(routineExerciseId))?.notes).toBe('');
    });

    it('ne confond pas une note effacée avec une note jamais écrite', async () => {
      const { routineExerciseId } = await aRoutineWithOneExercise();
      await updateRoutineExercise(routineExerciseId, { notes: SETTING });
      await updateRoutineExercise(routineExerciseId, { notes: '' });

      const text = serializeBackup(await buildBackup());
      await resetDb();

      const parsed = parseBackup(text);
      if (!parsed.ok) throw new Error(`fichier refusé : ${parsed.problem}`);
      await restoreBackup(parsed.backup);

      expect((await db.routineExercises.get(routineExerciseId))?.notes).toBe('');
    });
  });
});
