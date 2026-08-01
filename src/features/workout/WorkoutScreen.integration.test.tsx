import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { createCustomExercise } from '@/data/repositories/exercises';
import { addExercisesToRoutine, createRoutine } from '@/data/repositories/routines';
import {
  getWorkoutDetail,
  startWorkoutFromRoutine,
} from '@/data/repositories/workouts';
import type { WorkoutSet } from '@/data/types';
import { useRestTimer } from '@/stores/restTimer';
import { resetDb } from '@/test/resetDb';
import { WorkoutScreen } from './WorkoutScreen';

async function seedActiveWorkout(): Promise<string> {
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
  return (await startWorkoutFromRoutine(routine.id)).id;
}

async function firstSet(workoutId: string): Promise<WorkoutSet> {
  const detail = await getWorkoutDetail(workoutId);
  const set = detail?.exercises[0]?.sets[0];
  if (set === undefined) throw new Error('série de séance absente');
  return set;
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

describe('WorkoutScreen — persistance', () => {
  beforeEach(async () => {
    useRestTimer.getState().stop();
    await resetDb();
  });

  afterEach(() => useRestTimer.getState().stop());

  it('persiste la saisie et la validation après un remontage complet', async () => {
    const workoutId = await seedActiveWorkout();
    const user = userEvent.setup();
    const mounted = renderWorkout();

    await screen.findByText('Développé couché');
    await user.type(screen.getByRole('textbox', { name: 'Série 1 — kg' }), '80');
    await user.type(screen.getByRole('textbox', { name: 'Série 1 — reps' }), '10');

    await waitFor(async () => {
      expect(await firstSet(workoutId)).toMatchObject({
        weight: 80,
        reps: 10,
        isCompleted: 0,
        performedAt: 0,
      });
    });

    mounted.unmount();
    renderWorkout();

    expect(await screen.findByRole('textbox', { name: 'Série 1 — kg' })).toHaveValue('80');
    expect(screen.getByRole('textbox', { name: 'Série 1 — reps' })).toHaveValue('10');

    await user.click(screen.getByRole('button', { name: 'Valider la série 1' }));

    await waitFor(async () => {
      const persisted = await firstSet(workoutId);
      expect(persisted).toMatchObject({ weight: 80, reps: 10, isCompleted: 1 });
      expect(persisted.performedAt).toBeGreaterThan(0);
    });
  });

  it('applique le deload depuis le header et garde son état après remontage', async () => {
    const workoutId = await seedActiveWorkout();
    const initial = await firstSet(workoutId);
    await db.workoutSets.update(initial.id, { targetWeight: 100, targetReps: 5 });
    const user = userEvent.setup();
    const mounted = renderWorkout();

    await screen.findByText('Développé couché');
    await user.click(screen.getByRole('button', { name: 'Activer le deload à 80 %' }));
    expect(
      screen.getByText('Les séries restantes passeront à 80 %, arrondies à 2,5 kg.'),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Appliquer' }));

    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'Série 1 — kg' })).toHaveAttribute(
        'placeholder',
        '80',
      );
    });
    expect(screen.getByRole('button', { name: 'Deload actif à 80 %' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Options de la séance' }));
    await user.click(screen.getByRole('button', { name: 'Notes de la séance' }));
    expect(screen.getByRole('textbox', { name: 'Notes de la séance' })).toHaveValue(
      'Deload — charges réduites à 80 %.',
    );

    mounted.unmount();
    renderWorkout();
    expect(await screen.findByRole('button', { name: 'Deload actif à 80 %' })).toBeDisabled();
  });
});
