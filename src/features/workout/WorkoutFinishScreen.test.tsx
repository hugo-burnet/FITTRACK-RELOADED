import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { saveBodyWeight } from '@/data/repositories/bodyMeasurements';
import { createCustomExercise } from '@/data/repositories/exercises';
import {
  addWorkoutExercise,
  completeSet,
  getWorkoutDetail,
  startWorkout,
} from '@/data/repositories/workouts';
import { resetDb } from '@/test/resetDb';
import { WorkoutFinishScreen } from './WorkoutFinishScreen';

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
  beforeEach(resetDb);

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
});
