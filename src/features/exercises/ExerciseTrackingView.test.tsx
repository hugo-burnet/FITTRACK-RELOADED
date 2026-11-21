import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { newEntity } from '@/data/repositories/base';
import type {
  Exercise,
  PersonalRecord,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '@/data/types';
import { resetDb } from '@/test/resetDb';
import { ExerciseDetailScreen } from './ExerciseDetailScreen';

const SLOW = { timeout: 5_000 };

const makeExercise = (over: Partial<Exercise> = {}): Exercise => ({
  ...newEntity<Exercise>({
    name: 'Développé couché',
    primaryMuscle: 'chest',
    secondaryMuscles: [],
    equipment: 'barbell',
    measurementType: 'weight_reps',
    isCustom: 0,
    isUnilateral: 0,
  }),
  id: 'ex',
  ...over,
});

async function seedWorkout(
  exercise: Exercise,
  id: string,
  startedAt: number,
  sets: Array<[number, number]>,
  kind?: Workout['kind'],
) {
  await db.workouts.add({
    ...newEntity<Workout>({
      routineId: '',
      name: id,
      status: 'completed',
      startedAt,
      endedAt: startedAt + 3_600_000,
      durationSeconds: 3_600,
      ...(kind === undefined ? {} : { kind }),
    }),
    id,
  });
  await db.workoutExercises.add({
    ...newEntity<WorkoutExercise>({
      workoutId: id,
      exerciseId: exercise.id,
      order: 0,
      supersetGroup: 0,
      restSeconds: 120,
      exerciseName: exercise.name,
      exerciseMeasurementType: exercise.measurementType,
    }),
    id: `${id}-row`,
  });
  await db.workoutSets.bulkAdd(
    sets.map(([weight, reps], order) => ({
      ...newEntity<WorkoutSet>({
        workoutExerciseId: `${id}-row`,
        exerciseId: exercise.id,
        workoutId: id,
        order,
        setType: 'normal',
        side: 'both',
        weight,
        reps,
        isCompleted: 1,
        performedAt: startedAt,
      }),
      id: `${id}-set-${order}`,
    })),
  );
}

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="URL courante">{`${location.pathname}${location.search}`}</output>;
}

const renderScreen = () =>
  render(
    <MemoryRouter initialEntries={['/exercises/ex']}>
      <LocationProbe />
      <Routes>
        <Route path="/exercises/:id" element={<ExerciseDetailScreen />} />
        <Route path="/analytics/exercises/:exerciseId" element={<p>Vue plein écran</p>} />
      </Routes>
    </MemoryRouter>,
  );

describe('ExerciseTrackingView', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('la tuile « Meilleure série » dit le tonnage dans son détail, pas la série', async () => {
    const exercise = makeExercise();
    await db.exercises.add(exercise);
    await seedWorkout(exercise, 'w1', Date.UTC(2026, 10, 16, 18), [[80, 8]]);
    await db.personalRecords.add({
      ...newEntity<PersonalRecord>({
        exerciseId: exercise.id,
        type: 'max_volume_set',
        value: 640,
        weight: 80,
        reps: 8,
        achievedAt: Date.UTC(2026, 10, 16, 18),
        workoutId: 'w1',
      }),
      id: 'r1',
    });
    renderScreen();

    const tile = await screen.findByRole('button', { name: /^Meilleure série/ }, SLOW);
    expect(tile).toHaveTextContent('80 kg × 8');
    expect(tile).toHaveTextContent(/: 640 kg,/);
    expect(tile).not.toHaveTextContent(/: 80 kg × 8,/);
  });

  it('« La dernière fois » ignore les séances test', async () => {
    const exercise = makeExercise();
    await db.exercises.add(exercise);
    await seedWorkout(exercise, 'normal', Date.UTC(2026, 10, 10, 18), [[80, 8]]);
    await seedWorkout(exercise, 'test', Date.UTC(2026, 10, 16, 18), [[90, 14]], 'benchmark');
    renderScreen();

    const tile = await screen.findByRole('button', { name: /^La dernière fois/ }, SLOW);
    expect(tile).toHaveTextContent('80');
    expect(tile).not.toHaveTextContent('90');
    // La liste des séances, elle, garde la séance test.
    const sessions = screen.getByText('Séances').closest('section')!;
    expect(within(sessions).getAllByRole('button')).toHaveLength(2);
  });

  it('« La dernière fois » écrit l’assistance comme une assistance', async () => {
    const exercise = makeExercise({ measurementType: 'assisted_weight_reps', name: 'Tractions' });
    await db.exercises.add(exercise);
    await seedWorkout(exercise, 'w1', Date.UTC(2026, 10, 16, 18), [
      [20, 6],
      [20, 5],
    ]);
    renderScreen();

    const tile = await screen.findByRole('button', { name: /^La dernière fois/ }, SLOW);
    expect(tile).toHaveTextContent(/20\s*kg d’assistance/);
  });

  it('nomme la série que montrent les lignes « Séances »', async () => {
    const exercise = makeExercise();
    await db.exercises.add(exercise);
    await seedWorkout(exercise, 'w1', Date.UTC(2026, 10, 16, 18), [
      [85, 3],
      [70, 10],
    ]);
    renderScreen();

    const sessions = (await screen.findByText('Séances', undefined, SLOW)).closest('section')!;
    expect(within(sessions).getByText(/la plus lourde/)).toBeVisible();
    expect(within(sessions).getByText('85 kg × 3')).toBeVisible();
  });

  it('la mini-courbe ouvre une vue plein écran dont la période contient ses séances', async () => {
    const user = userEvent.setup();
    const exercise = makeExercise();
    await db.exercises.add(exercise);
    // Vieille de ~30 semaines : hors des 12 semaines par défaut.
    await seedWorkout(exercise, 'old', Date.now() - 30 * 7 * 86_400_000, [[80, 8]]);
    renderScreen();

    await user.click(await screen.findByRole('button', { name: /^Charge max · 1 séance/ }, SLOW));
    await waitFor(() =>
      expect(screen.getByLabelText('URL courante')).toHaveTextContent(
        '/analytics/exercises/ex?periode=52w',
      ),
    );
  });
});
