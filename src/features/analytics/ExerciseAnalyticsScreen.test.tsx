import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { newEntity } from '@/data/repositories/base';
import type { Exercise, Workout, WorkoutExercise, WorkoutSet } from '@/data/types';
import { resetDb } from '@/test/resetDb';
import { ExerciseAnalyticsScreen } from './ExerciseAnalyticsScreen';

const now = Date.now() - 24 * 60 * 60 * 1_000;

const exercise: Exercise = {
  ...newEntity<Exercise>({
    name: 'Développé couché',
    primaryMuscle: 'chest',
    secondaryMuscles: [],
    equipment: 'barbell',
    measurementType: 'weight_reps',
    isCustom: 0,
    isUnilateral: 0,
  }),
  id: 'bench',
};

const workout: Workout = {
  ...newEntity<Workout>({
    routineId: '',
    name: 'Haut du corps',
    status: 'completed',
    startedAt: now,
    endedAt: now + 3_600_000,
    durationSeconds: 3_600,
  }),
  id: 'workout',
};

const row: WorkoutExercise = {
  ...newEntity<WorkoutExercise>({
    workoutId: workout.id,
    exerciseId: exercise.id,
    order: 0,
    supersetGroup: 0,
    restSeconds: 120,
    exerciseName: exercise.name,
    exerciseMeasurementType: exercise.measurementType,
  }),
  id: 'row',
};

const set: WorkoutSet = {
  ...newEntity<WorkoutSet>({
    workoutExerciseId: row.id,
    exerciseId: exercise.id,
    workoutId: workout.id,
    order: 0,
    setType: 'normal',
    side: 'both',
    weight: 100,
    reps: 5,
    isCompleted: 1,
    performedAt: now,
  }),
  id: 'set',
};

const renderScreen = () =>
  render(
    <MemoryRouter initialEntries={['/analytics/exercises/bench']}>
      <Routes>
        <Route path="/analytics/exercises/:exerciseId" element={<ExerciseAnalyticsScreen />} />
      </Routes>
    </MemoryRouter>,
  );

describe('ExerciseAnalyticsScreen estimated 1RM', () => {
  beforeEach(async () => {
    await resetDb();
    await db.transaction(
      'rw',
      db.exercises,
      db.workouts,
      db.workoutExercises,
      db.workoutSets,
      async () => {
        await db.exercises.add(exercise);
        await db.workouts.add(workout);
        await db.workoutExercises.add(row);
        await db.workoutSets.add(set);
      },
    );
  });

  it('does not announce an empty period while formula and history are loading', () => {
    const { container } = renderScreen();

    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    expect(screen.queryByText('Aucune séance sur cette période.')).toBeNull();
  });

  it('redraws raw session estimates when the persisted formula changes', async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(await screen.findByRole('button', { name: 'Charge max' }));
    await user.click(screen.getByRole('radio', { name: '1RM estimé' }));
    expect((await screen.findAllByText('116,7 kg')).length).toBeGreaterThan(0);

    await db.settings.put({ key: 'oneRepMaxFormula', value: 'brzycki', updatedAt: Date.now() });

    await waitFor(() => expect(screen.getAllByText('112,5 kg').length).toBeGreaterThan(0));
    expect(await db.personalRecords.count()).toBe(0);
  });
});
