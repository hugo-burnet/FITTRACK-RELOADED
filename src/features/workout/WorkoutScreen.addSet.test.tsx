import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { createCustomExercise } from '@/data/repositories/exercises';
import { addExercisesToRoutine, createRoutine } from '@/data/repositories/routines';
import {
  completeSet,
  getWorkoutDetail,
  startWorkoutFromRoutine,
  updateSetType,
} from '@/data/repositories/workouts';
import { day, seedWorkout } from '@/test/factories';
import { resetDb } from '@/test/resetDb';
import { WorkoutScreen } from './WorkoutScreen';

/**
 * Ce que l'écran de séance laisse voir quand on ajoute une série juste après
 * l'échauffement.
 *
 * « Ajouter une série » recopiait l'échauffement : type et chiffres. Les chiffres
 * s'affichaient en gris comme la suggestion de la série suivante — 40 × 5 offerts
 * pour un travail à 100 × 8 — et ils passaient devant la seule suggestion juste,
 * celle de la séance précédente. Les dépôts le testent série par série ; ceci est
 * ce que la personne lit.
 */
describe('WorkoutScreen — « Ajouter une série » après un échauffement', () => {
  beforeEach(resetDb);

  it('suggère les chiffres de la séance précédente, pas ceux de l’échauffement', async () => {
    const exercise = await createCustomExercise({
      name: 'Développé couché',
      primaryMuscle: 'chest',
      secondaryMuscles: [],
      equipment: 'barbell',
      measurementType: 'weight_reps',
      isUnilateral: 0,
    });

    // La séance d'avant : un échauffement à 40 × 5, puis deux séries à 100 × 8.
    const previous = await seedWorkout({
      exerciseId: exercise.id,
      performedAt: day(1),
      sets: [
        [40, 5],
        [100, 8],
        [100, 8],
      ],
    });
    const earlier = await db.workoutSets.where('workoutId').equals(previous.id).sortBy('order');
    await db.workoutSets.update(earlier[0]!.id, { setType: 'warmup' });

    // Celle du jour : une série, marquée échauffement et validée à 40 × 5.
    const routine = await createRoutine('Poussée');
    await addExercisesToRoutine(routine.id, [exercise.id]);
    const workout = await startWorkoutFromRoutine(routine.id);
    const first = (await getWorkoutDetail(workout.id))?.exercises[0]?.sets[0];
    if (first === undefined) throw new Error('série de séance absente');
    await updateSetType(first.id, 'warmup');
    await completeSet(first.id, { weight: 40, reps: 5 });

    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/workout']}>
        <Routes>
          <Route path="/workout" element={<WorkoutScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    // Tout est validé : la carte s'est repliée, on la rouvre comme sur le téléphone.
    await user.click(
      await screen.findByRole('button', { name: /Développé couché/, expanded: false }),
    );
    await user.click(screen.getByRole('button', { name: 'Ajouter une série' }));

    const weight = await screen.findByRole('textbox', { name: 'Série 2 — kg' });
    expect(weight).toHaveAttribute('placeholder', '100');
    expect(screen.getByRole('textbox', { name: 'Série 2 — reps' })).toHaveAttribute(
      'placeholder',
      '8',
    );

    // Et la nouvelle série est une série normale, pas un second échauffement.
    await waitFor(async () => {
      const sets = (await getWorkoutDetail(workout.id))?.exercises[0]?.sets ?? [];
      expect(sets.map((set) => set.setType)).toEqual(['warmup', 'normal']);
    });
  });
});
