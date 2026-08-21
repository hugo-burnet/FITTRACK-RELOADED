import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/data/db';
import { saveBodyWeight } from '@/data/repositories/bodyMeasurements';
import { createCustomExercise } from '@/data/repositories/exercises';
import {
  addSet,
  addWorkoutExercise,
  completeSet,
  getWorkoutDetail,
  startWorkout,
} from '@/data/repositories/workouts';
import { resetDb } from '@/test/resetDb';
import { WorkoutFinishScreen } from './WorkoutFinishScreen';
import { forgetWorkoutRecaps } from './workoutRecapVoice';

const { speakWorkoutRecapMock } = vi.hoisted(() => ({
  speakWorkoutRecapMock: vi.fn(),
}));

// `claimWorkoutRecap` reste le vrai : c'est lui qui garantit qu'un aller-retour
// sur cet écran ne fait pas relire la séance, et c'est ce que le test vérifie.
vi.mock('./workoutRecapVoice', async () => {
  const actual = await vi.importActual<typeof import('./workoutRecapVoice')>(
    './workoutRecapVoice',
  );
  return { ...actual, speakWorkoutRecap: speakWorkoutRecapMock };
});

function renderFinishScreen() {
  return render(
    <MemoryRouter initialEntries={['/workout/finish']}>
      <Routes>
        <Route path="/workout/finish" element={<WorkoutFinishScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('WorkoutFinishScreen', () => {
  beforeEach(async () => {
    speakWorkoutRecapMock.mockReset();
    forgetWorkoutRecaps();
    await resetDb();
  });

  it('affiche le tonnage effectif des exercices au poids du corps', async () => {
    const pushUp = await createCustomExercise({
      name: 'Pompes',
      primaryMuscle: 'chest',
      secondaryMuscles: ['triceps'],
      equipment: 'bodyweight',
      measurementType: 'reps_only',
      isUnilateral: 0,
      bodyweightLoadFactor: 0.7,
    });
    const workout = await startWorkout('', 'Poids du corps');
    await saveBodyWeight(80, workout.startedAt);
    await addWorkoutExercise(workout.id, pushUp.id);
    const initial = (await getWorkoutDetail(workout.id))?.exercises[0]?.sets[0];
    if (initial === undefined) throw new Error('série initiale absente');
    await completeSet(initial.id, { reps: 8 });

    renderFinishScreen();

    expect(await screen.findByText('448 kg')).toBeInTheDocument();
  });

  it("attend le calcul du coach avant d'annoncer le récapitulatif", async () => {
    const exercise = await createCustomExercise({
      name: 'Traction pronation',
      primaryMuscle: 'lats',
      secondaryMuscles: ['biceps'],
      equipment: 'cable',
      measurementType: 'weight_reps',
      isUnilateral: 0,
    });
    const workout = await startWorkout('', 'Dos');
    const row = await addWorkoutExercise(workout.id, exercise.id);
    const initial = (await getWorkoutDetail(workout.id))?.exercises[0]?.sets[0];
    if (initial === undefined) throw new Error('série initiale absente');

    const sets = [
      initial,
      await addSet(row.id, { targetReps: 8, targetRepsMax: 10, targetWeight: 15 }),
      await addSet(row.id, { targetReps: 8, targetRepsMax: 10, targetWeight: 15 }),
      await addSet(row.id, { targetReps: 8, targetRepsMax: 10, targetWeight: 15 }),
    ];
    for (const set of sets) {
      if (set.id === initial.id) {
        await db.workoutSets.update(set.id, {
          targetReps: 8,
          targetRepsMax: 10,
          targetWeight: 15,
        });
      }
      await completeSet(set.id, { weight: 15, reps: 10 });
    }

    renderFinishScreen();

    expect(await screen.findByText(/15 → 17,5 kg/)).toBeInTheDocument();
    await waitFor(() =>
      expect(speakWorkoutRecapMock).toHaveBeenCalledWith([
        expect.objectContaining({
          code: 'range_ceiling_reached',
          nextLoadKg: 17.5,
        }),
      ]),
    );
    expect(speakWorkoutRecapMock).not.toHaveBeenCalledWith([]);
  });

  it('ne relit pas le bilan quand on revient sur l’écran', async () => {
    const exercise = await createCustomExercise({
      name: 'Rowing',
      primaryMuscle: 'lats',
      secondaryMuscles: [],
      equipment: 'cable',
      measurementType: 'weight_reps',
      isUnilateral: 0,
    });
    const workout = await startWorkout('', 'Dos');
    await addWorkoutExercise(workout.id, exercise.id);
    const initial = (await getWorkoutDetail(workout.id))?.exercises[0]?.sets[0];
    if (initial === undefined) throw new Error('série initiale absente');
    await completeSet(initial.id, { weight: 15, reps: 10 });

    const first = renderFinishScreen();
    await waitFor(() => expect(speakWorkoutRecapMock).toHaveBeenCalledTimes(1));
    first.unmount();

    const second = renderFinishScreen();
    await screen.findByText(/Enregistrer/);
    await waitFor(() => expect(speakWorkoutRecapMock).toHaveBeenCalledTimes(1));
    second.unmount();
  });
});
