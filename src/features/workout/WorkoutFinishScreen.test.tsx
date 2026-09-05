import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
import * as workoutsRepository from '@/data/repositories/workouts';
import { TutorialContext } from '@/features/tutorial/tutorialContext';
import { resetDb } from '@/test/resetDb';
import { WorkoutFinishScreen } from './WorkoutFinishScreen';
import { forgetWorkoutRecaps } from './workoutRecapVoice';

const { speakWorkoutRecapMock } = vi.hoisted(() => ({
  speakWorkoutRecapMock: vi.fn(),
}));

// `claimWorkoutRecap` reste le vrai : c'est lui qui garantit qu'un aller-retour
// sur cet écran ne fait pas relire la séance, et c'est ce que le test vérifie.
vi.mock('./workoutRecapVoice', async () => {
  const actual = await vi.importActual<typeof import('./workoutRecapVoice')>('./workoutRecapVoice');
  return { ...actual, speakWorkoutRecap: speakWorkoutRecapMock };
});

function LocationProbe() {
  return <output data-testid="location-probe">{useLocation().pathname}</output>;
}

function renderFinishScreen(report = vi.fn()) {
  return render(
    <TutorialContext.Provider
      value={{ openHelp: vi.fn(), startMission: vi.fn(), offerMission: vi.fn(), report }}
    >
      <MemoryRouter initialEntries={['/workout/finish']}>
        <Routes>
          <Route path="/workout/finish" element={<WorkoutFinishScreen />} />
          <Route path="/" element={<p>Destination accueil</p>} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    </TutorialContext.Provider>,
  );
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('WorkoutFinishScreen', () => {
  it('does not save an empty workout', async () => {
    const workout = await startWorkout('', 'Empty');
    renderFinishScreen();
    const save = await screen.findByRole('button', { name: 'Enregistrer la séance' });
    expect(save).toBeDisabled();
    await userEvent.click(save);
    expect((await db.workouts.get(workout.id))?.status).toBe('active');
  });

  it('identifies the last set without pretending heterogeneous sets were identical', async () => {
    const exercise = await createCustomExercise({
      name: 'Pyramide',
      primaryMuscle: 'chest',
      secondaryMuscles: [],
      equipment: 'barbell',
      measurementType: 'weight_reps',
      isUnilateral: 0,
    });
    const workout = await startWorkout('', 'Pyramide');
    const row = await addWorkoutExercise(workout.id, exercise.id);
    const first = await addSet(row.id);
    const second = await addSet(row.id);
    await completeSet(first.id, { weight: 20, reps: 8 });
    await completeSet(second.id, { weight: 30, reps: 6 });
    renderFinishScreen();
    expect(await screen.findByText('2 série(s) · dernière : 6 reps · 30 kg')).toBeVisible();
    expect(screen.getByText('340 kg')).toBeVisible();
  });

  beforeEach(async () => {
    speakWorkoutRecapMock.mockReset();
    forgetWorkoutRecaps();
    await resetDb();
  });

  afterEach(() => vi.restoreAllMocks());

  it('reports workout-saved only after completion is durable and exposes the save anchor', async () => {
    const workout = await startWorkout('', 'Séance sûre');
    const exercise = await createCustomExercise({
      name: 'Audit',
      primaryMuscle: 'chest',
      secondaryMuscles: [],
      equipment: 'barbell',
      measurementType: 'weight_reps',
      isUnilateral: 0,
    });
    const row = await addWorkoutExercise(workout.id, exercise.id);
    const set = await addSet(row.id);
    await completeSet(set.id, { weight: 20, reps: 8 });
    const gate = deferred<void>();
    const realFinish = workoutsRepository.finishWorkout;
    vi.spyOn(workoutsRepository, 'finishWorkout').mockImplementation(async (workoutId) => {
      await gate.promise;
      return realFinish(workoutId);
    });
    const report = vi.fn();
    renderFinishScreen(report);

    expect(screen.getByTestId('location-probe')).toHaveTextContent('/workout/finish');

    await screen.findByText('Enregistrer la séance');
    const saveAnchors = document.querySelectorAll('[data-tutorial-id="workout-save"]');
    expect(saveAnchors).toHaveLength(1);
    await userEvent.click(saveAnchors[0] as HTMLButtonElement);

    expect(report).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'workout-saved' }));
    expect((await db.workouts.get(workout.id))?.status).toBe('active');

    gate.resolve();
    await waitFor(() =>
      expect(report).toHaveBeenCalledWith({ type: 'workout-saved', workoutId: workout.id }),
    );
    expect((await db.workouts.get(workout.id))?.status).toBe('completed');
  });

  it('never reports workout-saved when finishWorkout rejects', async () => {
    const workout = await startWorkout('', 'Séance en erreur');
    const exercise = await createCustomExercise({
      name: 'Audit',
      primaryMuscle: 'chest',
      secondaryMuscles: [],
      equipment: 'barbell',
      measurementType: 'weight_reps',
      isUnilateral: 0,
    });
    const row = await addWorkoutExercise(workout.id, exercise.id);
    const set = await addSet(row.id);
    await completeSet(set.id, { weight: 20, reps: 8 });
    const finish = vi
      .spyOn(workoutsRepository, 'finishWorkout')
      .mockRejectedValueOnce(new Error('IndexedDB unavailable'));
    const report = vi.fn();
    renderFinishScreen(report);

    expect(screen.getByTestId('location-probe')).toHaveTextContent('/workout/finish');

    await userEvent.click(
      (await screen.findByText('Enregistrer la séance')).closest('button') as HTMLButtonElement,
    );
    await waitFor(() => expect(finish).toHaveBeenCalledOnce());
    await Promise.resolve();

    expect(report).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'workout-saved' }));
    expect((await db.workouts.get(workout.id))?.status).toBe('active');
    expect(screen.getByTestId('location-probe')).toHaveTextContent('/workout/finish');
    expect(screen.queryByText('Destination accueil')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('n’a pas pu être enregistrée');
  });

  it('never reports workout-saved from the explicit discard path', async () => {
    const workout = await startWorkout('', 'Séance abandonnée');
    const report = vi.fn();
    renderFinishScreen(report);

    await userEvent.click(await screen.findByRole('button', { name: 'Abandonner la séance' }));
    await userEvent.click(screen.getByRole('button', { name: 'Abandonner' }));
    await waitFor(async () =>
      expect((await db.workouts.get(workout.id))?.deletedAt).toBeGreaterThan(0),
    );

    expect(report).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'workout-saved' }));
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
