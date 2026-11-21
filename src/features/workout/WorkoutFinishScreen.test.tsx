import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/data/db';
import { saveBodyWeight } from '@/data/repositories/bodyMeasurements';
import { startBenchmarkFromRoutine } from '@/data/repositories/benchmark';
import { createCustomExercise } from '@/data/repositories/exercises';
import { addExercisesToRoutine, createRoutine } from '@/data/repositories/routines';
import {
  addSet,
  addWorkoutExercise,
  completeSet,
  getWorkoutDetail,
  startWorkout,
} from '@/data/repositories/workouts';
import * as coachEvaluate from '@/data/repositories/coachEvaluate';
import * as workoutsRepository from '@/data/repositories/workouts';
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

function renderFinishScreen() {
  return render(
    <MemoryRouter initialEntries={['/workout/finish']}>
      <Routes>
        <Route path="/workout/finish" element={<WorkoutFinishScreen />} />
        <Route path="/" element={<p>Destination accueil</p>} />
        <Route path="/benchmark/:workoutId" element={<p>Destination bilan</p>} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
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

  it('stays active until finishWorkout resolves, then completes the workout', async () => {
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
    renderFinishScreen();

    expect(screen.getByTestId('location-probe')).toHaveTextContent('/workout/finish');

    await screen.findByText('Enregistrer la séance');
    await userEvent.click(
      (await screen.findByText('Enregistrer la séance')).closest('button') as HTMLButtonElement,
    );

    expect((await db.workouts.get(workout.id))?.status).toBe('active');

    gate.resolve();
    await waitFor(async () =>
      expect((await db.workouts.get(workout.id))?.status).toBe('completed'),
    );
  });

  it('shows the finish screen and still saves when the coach evaluation rejects', async () => {
    // A rejecting live query rethrows at render and the global error screen replaces this one: the
    // session could no longer be saved because an advisory computation failed.
    const workout = await startWorkout('', 'Coach en panne');
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
    const evaluate = vi
      .spyOn(coachEvaluate, 'evaluateCoachForWorkout')
      .mockRejectedValue(new Error('coach en panne'));
    renderFinishScreen();

    const save = (await screen.findByText('Enregistrer la séance')).closest('button');
    await waitFor(() => expect(evaluate).toHaveBeenCalled());
    await userEvent.click(save as HTMLButtonElement);

    await waitFor(async () =>
      expect((await db.workouts.get(workout.id))?.status).toBe('completed'),
    );
  });

  it('keeps the workout active when finishWorkout rejects', async () => {
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
    renderFinishScreen();

    expect(screen.getByTestId('location-probe')).toHaveTextContent('/workout/finish');

    await userEvent.click(
      (await screen.findByText('Enregistrer la séance')).closest('button') as HTMLButtonElement,
    );
    await waitFor(() => expect(finish).toHaveBeenCalledOnce());
    await Promise.resolve();

    expect((await db.workouts.get(workout.id))?.status).toBe('active');
    expect(screen.getByTestId('location-probe')).toHaveTextContent('/workout/finish');
    expect(screen.queryByText('Destination accueil')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('n’a pas pu être enregistrée');
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

    // 50 kg et non 15 : depuis le coach v2 (R3.2), +2,5 kg sur 15 kg demande
    // 15 répétitions pour retomber à 8, et la carte ne proposerait pas de charge.
    // Le sujet du test est l'attente du calcul, pas le cran.
    const sets = [
      initial,
      await addSet(row.id, { targetReps: 8, targetRepsMax: 10, targetWeight: 50 }),
      await addSet(row.id, { targetReps: 8, targetRepsMax: 10, targetWeight: 50 }),
      await addSet(row.id, { targetReps: 8, targetRepsMax: 10, targetWeight: 50 }),
    ];
    for (const set of sets) {
      if (set.id === initial.id) {
        await db.workoutSets.update(set.id, {
          targetReps: 8,
          targetRepsMax: 10,
          targetWeight: 50,
        });
      }
      await completeSet(set.id, { weight: 50, reps: 10 });
    }

    renderFinishScreen();

    expect(await screen.findByText(/50 → 52,5 kg/)).toBeInTheDocument();
    await waitFor(() =>
      expect(speakWorkoutRecapMock).toHaveBeenCalledWith([
        expect.objectContaining({
          code: 'range_ceiling_reached',
          nextLoadKg: 52.5,
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
  describe('pour un benchmark', () => {
    async function activeBenchmark() {
      const exercise = await createCustomExercise({
        name: 'Développé couché',
        primaryMuscle: 'chest',
        secondaryMuscles: [],
        equipment: 'barbell',
        measurementType: 'weight_reps',
        isUnilateral: 0,
      });
      const routine = await createRoutine('Push');
      await addExercisesToRoutine(routine.id, [exercise.id]);
      const workout = await startBenchmarkFromRoutine(routine.id, 'Benchmark · Push');
      const set = (await getWorkoutDetail(workout.id))!.exercises[0]!.sets[0]!;
      await completeSet(set.id, { weight: 80, reps: 9 });
      return workout;
    }

    it('enregistre la séance puis ouvre son bilan, sans passer par l’accueil', async () => {
      const workout = await activeBenchmark();
      renderFinishScreen();

      await userEvent.click(await screen.findByRole('button', { name: 'Enregistrer la séance' }));

      expect(await screen.findByText('Destination bilan')).toBeInTheDocument();
      expect(screen.getByTestId('location-probe')).toHaveTextContent(`/benchmark/${workout.id}`);
      expect((await db.workouts.get(workout.id))?.status).toBe('completed');
    });

    it('prévient que le bilan suit, et ne fait pas lire la séance à voix haute', async () => {
      await activeBenchmark();
      renderFinishScreen();

      expect(await screen.findByText(/C’est une séance test/)).toBeInTheDocument();
      await screen.findByRole('button', { name: 'Enregistrer la séance' });
      // Une absence ne s'attend pas : on laisse au calcul du coach le temps de répondre, comme le
      // jumeau de ce test (« attend le calcul du coach… ») attend l'appel qui, lui, doit venir.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
      });
      expect(speakWorkoutRecapMock).not.toHaveBeenCalled();
    });

    it('fait lire le benchmark au coach, et à lui seul : un objectif, celui de la fourchette', async () => {
      await activeBenchmark();
      renderFinishScreen();

      await userEvent.click(await screen.findByRole('button', { name: 'Enregistrer la séance' }));
      await screen.findByText('Destination bilan');

      // Pas de règle de séance (fourchette tenue, plafond, hausse) : un seul objectif, posé par le benchmark.
      const rows = await db.coachRecommendations.toArray();
      expect(rows.map((row) => [row.code, row.nextLoadKg])).toEqual([['benchmark_calibrated', 77.5]]);
    });
  });
});
