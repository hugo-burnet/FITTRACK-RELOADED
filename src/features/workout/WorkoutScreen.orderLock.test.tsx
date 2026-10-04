import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { createCustomExercise } from '@/data/repositories/exercises';
import { addExercisesToRoutine, createRoutine } from '@/data/repositories/routines';
import { startWorkoutFromRoutine } from '@/data/repositories/workouts';
import { useExerciseOrderLock } from '@/stores/exerciseOrderLock';
import { resetDb } from '@/test/resetDb';
import { WorkoutScreen } from './WorkoutScreen';

const UNLOCK = 'Déverrouiller l’ordre des exercices';
const LOCK = 'Verrouiller l’ordre des exercices';

/** Une séance de deux exercices : c'est le minimum pour qu'il y ait un ordre à garder. */
async function seedTwoExerciseWorkout(): Promise<string> {
  const bench = await createCustomExercise({
    name: 'Développé couché',
    primaryMuscle: 'chest',
    secondaryMuscles: [],
    equipment: 'barbell',
    measurementType: 'weight_reps',
    isUnilateral: 0,
  });
  const row = await createCustomExercise({
    name: 'Tirage horizontal',
    primaryMuscle: 'upper_back',
    secondaryMuscles: [],
    equipment: 'cable',
    measurementType: 'weight_reps',
    isUnilateral: 0,
  });
  const routine = await createRoutine('Haut du corps');
  await addExercisesToRoutine(routine.id, [bench.id, row.id]);
  return (await startWorkoutFromRoutine(routine.id)).id;
}

function renderWorkout() {
  return render(
    <MemoryRouter initialEntries={['/workout']}>
      <Routes>
        <Route path="/workout" element={<WorkoutScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

/**
 * Le cadenas d'ordre de la séance en cours.
 *
 * Il avait quitté le bandeau pour le menu « Options de la séance » : un geste
 * qu'on fait rarement n'avait pas à occuper la barre qu'on lit entre deux séries.
 * Mais il y est utile précisément **pendant** la séance — on s'aperçoit en cours
 * de route qu'on a pris les exercices dans le mauvais ordre — et le chercher dans
 * un menu, c'est ne plus savoir qu'il existe. Il est revenu à sa place, entre
 * l'état « 80 % » et le bouton de repli.
 */
describe('WorkoutScreen — le cadenas d’ordre dans le bandeau', () => {
  beforeEach(async () => {
    useExerciseOrderLock.getState().reset();
    await resetDb();
  });

  it('montre le cadenas fermé dès l’ouverture de la séance, sans passer par le menu', async () => {
    await seedTwoExerciseWorkout();
    renderWorkout();

    expect(await screen.findByRole('button', { name: UNLOCK })).toBeVisible();
    expect(screen.queryByRole('button', { name: /^Déplacer / })).not.toBeInTheDocument();
  });

  it('un appui fait apparaître les poignées, le suivant les retire', async () => {
    await seedTwoExerciseWorkout();
    const user = userEvent.setup();
    renderWorkout();

    await user.click(await screen.findByRole('button', { name: UNLOCK }));

    expect(screen.getByRole('button', { name: 'Déplacer Développé couché' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Déplacer Tirage horizontal' })).toBeVisible();
    expect(useExerciseOrderLock.getState().unlocked.workout).toBe(true);

    await user.click(screen.getByRole('button', { name: LOCK }));

    expect(screen.queryByRole('button', { name: /^Déplacer / })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: UNLOCK })).toBeVisible();
    expect(useExerciseOrderLock.getState().unlocked.workout).toBe(false);
  });

  it('ne touche pas au cadenas de l’éditeur de routine', async () => {
    await seedTwoExerciseWorkout();
    const user = userEvent.setup();
    renderWorkout();

    await user.click(await screen.findByRole('button', { name: UNLOCK }));

    expect(useExerciseOrderLock.getState().unlocked).toEqual({ routine: false, workout: true });
  });

  it('reste aussi dans le menu de séance : les deux commandent le même verrou', async () => {
    await seedTwoExerciseWorkout();
    const user = userEvent.setup();
    renderWorkout();

    await user.click(await screen.findByRole('button', { name: 'Options de la séance' }));
    const menu = screen.getByRole('dialog', { name: 'Options de la séance' });
    await user.click(within(menu).getByRole('button', { name: new RegExp(UNLOCK) }));

    expect(useExerciseOrderLock.getState().unlocked.workout).toBe(true);
    // Le cadenas du bandeau lit le même verrou : il propose maintenant de le refermer.
    expect(await screen.findByRole('button', { name: LOCK })).toBeVisible();
  });

  it('reste à côté de l’état « 80 % » quand la décharge est appliquée', async () => {
    const workoutId = await seedTwoExerciseWorkout();
    await db.workouts.update(workoutId, { deloadPercent: 80 });
    renderWorkout();

    expect(await screen.findByRole('switch', { name: 'Deload actif à 80 %' })).toBeVisible();
    expect(screen.getByRole('button', { name: UNLOCK })).toBeVisible();
  });
});
