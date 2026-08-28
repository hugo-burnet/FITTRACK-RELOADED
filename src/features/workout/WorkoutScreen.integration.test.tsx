import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/data/db';
import { createCustomExercise } from '@/data/repositories/exercises';
import { addExercisesToRoutine, createRoutine } from '@/data/repositories/routines';
import {
  addWorkoutExercise,
  duplicateLastSet,
  getWorkoutDetail,
  startWorkoutFromRoutine,
} from '@/data/repositories/workouts';
import * as workoutsRepository from '@/data/repositories/workouts';
import type { WorkoutSet } from '@/data/types';
import { TutorialContext } from '@/features/tutorial/tutorialContext';
import { t } from '@/i18n/fr';
import { useExerciseOrderLock } from '@/stores/exerciseOrderLock';
import { applyEffortPrompt } from '@/stores/effortPrompt';
import { useHoldTimer } from '@/stores/holdTimer';
import { useRepPacer } from '@/stores/repPacer';
import { useRestTimer } from '@/stores/restTimer';
import { recordCoachSignals } from '@/data/repositories/coachRecommendations';
import * as announcer from '@/audio/announce';
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

function renderWorkout(report = vi.fn()) {
  return render(
    <TutorialContext.Provider
      value={{ openHelp: vi.fn(), startMission: vi.fn(), offerMission: vi.fn(), report }}
    >
      <MemoryRouter initialEntries={['/workout']}>
        <Routes>
          <Route path="/workout" element={<WorkoutScreen />} />
        </Routes>
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

describe('WorkoutScreen — persistance', () => {
  beforeEach(async () => {
    useRestTimer.getState().stop();
    useRepPacer.getState().stop();
    useExerciseOrderLock.getState().reset();
    await resetDb();
  });

  afterEach(() => {
    useRestTimer.getState().stop();
    useRepPacer.getState().stop();
  });

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

  it('applique le deload depuis la barre d’avancement et garde son état après remontage', async () => {
    const workoutId = await seedActiveWorkout();
    const initial = await firstSet(workoutId);
    await db.workoutSets.update(initial.id, { targetWeight: 100, targetReps: 5 });
    const user = userEvent.setup();
    const mounted = renderWorkout();

    await screen.findByText('Développé couché');
    await user.click(screen.getByRole('switch', { name: 'Activer le deload à 80 %' }));
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
    const applied = screen.getByRole('switch', { name: 'Deload actif à 80 %' });
    expect(applied).toBeChecked();
    expect(applied).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Options de la séance' }));
    await user.click(screen.getByRole('button', { name: 'Notes de la séance' }));
    expect(screen.getByRole('textbox', { name: 'Notes de la séance' })).toHaveValue(
      'Deload — charges réduites à 80 %.',
    );

    mounted.unmount();
    renderWorkout();
    expect(await screen.findByRole('switch', { name: 'Deload actif à 80 %' })).toBeDisabled();
  });

  it('conserve le type assisté du snapshot quand la bibliothèque le masque', async () => {
    const exercise = await createCustomExercise({
      name: 'Tractions assistées retirées',
      primaryMuscle: 'lats',
      secondaryMuscles: [],
      equipment: 'machine',
      measurementType: 'assisted_weight_reps',
      isUnilateral: 0,
    });
    const routine = await createRoutine('Technique');
    await addExercisesToRoutine(routine.id, [exercise.id]);
    const workoutId = (await startWorkoutFromRoutine(routine.id)).id;
    const initial = await firstSet(workoutId);
    await db.workoutSets.update(initial.id, { targetWeight: 100, targetReps: 5 });
    await db.exercises.update(exercise.id, { deletedAt: Date.now() });
    renderWorkout();

    expect(t('workout.deloadMark')).toBe('80%');
    await screen.findByText('Tractions assistées retirées');
    expect(screen.getByText('−kg')).toBeVisible();
    const action = screen.getByRole('switch', { name: 'Activer le deload à 80 %' });
    expect(action).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Série 1 — kg' })).toHaveAttribute(
      'placeholder',
      '100',
    );
  });

  it('persiste le réordonnancement autorisé pendant la session', async () => {
    const workoutId = await seedActiveWorkout();
    const second = await createCustomExercise({
      name: 'Tirage horizontal',
      primaryMuscle: 'upper_back',
      secondaryMuscles: [],
      equipment: 'cable',
      measurementType: 'weight_reps',
      isUnilateral: 0,
    });
    await addWorkoutExercise(workoutId, second.id);
    act(() => useExerciseOrderLock.getState().toggle('routine'));
    const user = userEvent.setup();
    const mounted = renderWorkout();

    await screen.findByText('Développé couché');
    expect(useExerciseOrderLock.getState().unlocked).toEqual({
      routine: true,
      workout: false,
    });
    expect(
      screen.queryByRole('button', { name: 'Déplacer Développé couché' }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Déverrouiller l’ordre des exercices' }));
    const firstHandle = screen.getByRole('button', { name: 'Déplacer Développé couché' });
    expect(useExerciseOrderLock.getState().unlocked).toEqual({
      routine: true,
      workout: true,
    });
    fireEvent.keyDown(firstHandle, { key: 'ArrowDown' });

    await waitFor(async () => {
      expect((await getWorkoutDetail(workoutId))?.exercises[0]?.exercise?.id).toBe(second.id);
    });

    mounted.unmount();
    renderWorkout();
    expect(await screen.findByRole('button', { name: `Déplacer ${second.name}` })).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Verrouiller l’ordre des exercices' }));
    expect(useExerciseOrderLock.getState().unlocked).toEqual({
      routine: true,
      workout: false,
    });
    expect(
      screen.queryByRole('button', { name: `Déplacer ${second.name}` }),
    ).not.toBeInTheDocument();
  });
});

describe('WorkoutScreen — objectif du coach', () => {
  beforeEach(async () => {
    useRestTimer.getState().stop();
    useExerciseOrderLock.getState().reset();
    await resetDb();
  });

  afterEach(() => useRestTimer.getState().stop());

  it('applique la charge proposée aux séries restantes quand on appuie dessus', async () => {
    const workoutId = await seedActiveWorkout();
    const detail = await getWorkoutDetail(workoutId);
    const exerciseId = detail?.exercises[0]?.row.exerciseId ?? '';

    await recordCoachSignals([
      {
        exerciseId,
        code: 'range_ceiling_reached',
        severity: 1,
        nextLoadKg: 50,
        evidence: [
          { label: 'working_sets', value: 3 },
          { label: 'target_reps_max', value: 12 },
          { label: 'current_load_kg', value: 47.5 },
          { label: 'next_load_kg', value: 50 },
        ],
      },
    ]);

    const user = userEvent.setup();
    renderWorkout();

    // La carte porte le chiffre et la phrase qui l'explique, sans « + » trompeur.
    const reason = await screen.findByText(
      '47,5 → 50 kg car 3 × 12 a atteint le haut de la fourchette.',
    );
    expect(reason).toBeVisible();

    await user.click(reason);
    expect((await firstSet(workoutId))?.targetWeight).toBeUndefined();

    await user.click(screen.getByRole('button', { name: 'Appliquer 50 kg aux séries restantes' }));

    await waitFor(async () => {
      expect(await firstSet(workoutId)).toMatchObject({ targetWeight: 50, isCompleted: 0 });
    });

    // Appliquer, c'est accepter : la carte se ferme d'elle-même.
    await waitFor(() => {
      expect(screen.queryByText(/haut de la fourchette/)).not.toBeInTheDocument();
    });
  });

  it('laisse refuser sans rien écrire dans la grille', async () => {
    const workoutId = await seedActiveWorkout();
    const detail = await getWorkoutDetail(workoutId);
    const exerciseId = detail?.exercises[0]?.row.exerciseId ?? '';

    await recordCoachSignals([
      {
        exerciseId,
        code: 'range_ceiling_reached',
        severity: 1,
        nextLoadKg: 50,
        evidence: [
          { label: 'working_sets', value: 3 },
          { label: 'target_reps_max', value: 12 },
          { label: 'current_load_kg', value: 47.5 },
          { label: 'next_load_kg', value: 50 },
        ],
      },
    ]);

    const user = userEvent.setup();
    renderWorkout();

    await user.click(await screen.findByRole('button', { name: t('coach.dismiss') }));

    await waitFor(async () => {
      expect(await firstSet(workoutId)).toMatchObject({ targetWeight: undefined });
    });
    expect(screen.queryByText(/haut de la fourchette/)).not.toBeInTheDocument();
  });
});

describe('WorkoutScreen — baisse de charge', () => {
  beforeEach(async () => {
    useRestTimer.getState().stop();
    useExerciseOrderLock.getState().reset();
    await resetDb();
  });

  afterEach(() => useRestTimer.getState().stop());

  it('applique une charge plus basse aussi bien qu’une plus haute', async () => {
    const workoutId = await seedActiveWorkout();
    const detail = await getWorkoutDetail(workoutId);
    const exerciseId = detail?.exercises[0]?.row.exerciseId ?? '';

    await recordCoachSignals([
      {
        exerciseId,
        code: 'range_missed',
        severity: 50,
        nextLoadKg: 77.5,
        evidence: [
          { label: 'sessions', value: 2 },
          { label: 'target_reps', value: 8 },
          { label: 'low_reps', value: 6 },
          { label: 'current_load_kg', value: 80 },
          { label: 'next_load_kg', value: 77.5 },
        ],
      },
    ]);

    const user = userEvent.setup();
    renderWorkout();

    expect(await screen.findByText(/80 → 77,5 kg/)).toBeVisible();
    await user.click(
      screen.getByRole('button', { name: 'Appliquer 77,5 kg aux séries restantes' }),
    );

    await waitFor(async () => {
      expect(await firstSet(workoutId)).toMatchObject({ targetWeight: 77.5 });
    });
  });
});

/**
 * Une séance à deux séries de travail, avec une cible de répétitions : c'est le
 * minimum pour que le repos se déclenche (il faut une série *suivante*) et pour
 * que la cadence ait de quoi décompter.
 */
async function seedTwoSetWorkout(): Promise<string> {
  const workoutId = await seedActiveWorkout();
  const detail = await getWorkoutDetail(workoutId);
  const row = detail?.exercises[0]?.row;
  if (row === undefined) throw new Error('ligne d’exercice absente');
  await duplicateLastSet(row.id);
  const sets = (await getWorkoutDetail(workoutId))?.exercises[0]?.sets ?? [];
  for (const set of sets) await db.workoutSets.update(set.id, { targetReps: 8 });
  return workoutId;
}

describe('WorkoutScreen — tutoriel durable', () => {
  beforeEach(async () => {
    useRestTimer.getState().stop();
    useRepPacer.getState().stop();
    useExerciseOrderLock.getState().reset();
    localStorage.clear();
    await resetDb();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    useRestTimer.getState().stop();
    useRepPacer.getState().stop();
  });

  it('reports a partial numeric edit as non-recordable and exposes unique first-row anchors', async () => {
    const workoutId = await seedActiveWorkout();
    const set = await firstSet(workoutId);
    const report = vi.fn();
    renderWorkout(report);

    await screen.findByText('Développé couché');
    expect(document.querySelectorAll('[data-tutorial-id="workout-first-set"]')).toHaveLength(1);
    expect(
      document.querySelectorAll('[data-tutorial-id="workout-first-set-complete"]'),
    ).toHaveLength(1);
    expect(document.querySelectorAll('[data-tutorial-id="workout-finish"]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-tutorial-id="workout-rest"]')).toHaveLength(0);

    await userEvent.type(screen.getByRole('textbox', { name: 'Série 1 — kg' }), '80');

    await waitFor(() =>
      expect(report).toHaveBeenCalledWith({
        type: 'workout-set-written',
        workoutId,
        setId: set.id,
        recordable: false,
      }),
    );
  });

  it('reports a recordable first row only after updateSetValues resolves', async () => {
    const workoutId = await seedActiveWorkout();
    const set = await firstSet(workoutId);
    await db.workoutSets.update(set.id, { weight: 80 });
    const gate = deferred<void>();
    const realUpdate = workoutsRepository.updateSetValues;
    vi.spyOn(workoutsRepository, 'updateSetValues').mockImplementation(async (setId, values) => {
      await gate.promise;
      return realUpdate(setId, values);
    });
    const report = vi.fn();
    renderWorkout(report);

    fireEvent.change(await screen.findByRole('textbox', { name: 'Série 1 — reps' }), {
      target: { value: '10' },
    });
    expect(report).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'workout-set-written', recordable: true }),
    );

    gate.resolve();
    await waitFor(() =>
      expect(report).toHaveBeenCalledWith({
        type: 'workout-set-written',
        workoutId,
        setId: set.id,
        recordable: true,
      }),
    );
    expect(await firstSet(workoutId)).toMatchObject({ weight: 80, reps: 10 });
  });

  it('emits no write event when updateSetValues rejects', async () => {
    await seedActiveWorkout();
    vi.spyOn(workoutsRepository, 'updateSetValues').mockRejectedValueOnce(
      new Error('IndexedDB unavailable'),
    );
    const report = vi.fn();
    renderWorkout(report);

    fireEvent.change(await screen.findByRole('textbox', { name: 'Série 1 — kg' }), {
      target: { value: '80' },
    });
    await waitFor(() => expect(workoutsRepository.updateSetValues).toHaveBeenCalledOnce());
    await Promise.resolve();

    expect(report).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'workout-set-written' }),
    );
  });

  it('starts rest immediately but reports completion only after the durable write', async () => {
    const workoutId = await seedTwoSetWorkout();
    const set = await firstSet(workoutId);
    await db.workoutSets.update(set.id, { weight: 80, reps: 10 });
    const gate = deferred<void>();
    const realComplete = workoutsRepository.completeSet;
    vi.spyOn(workoutsRepository, 'completeSet').mockImplementation(async (setId, values) => {
      await gate.promise;
      return realComplete(setId, values);
    });
    const report = vi.fn();
    renderWorkout(report);

    const complete = await screen.findByRole('button', { name: 'Valider la série 1' });
    await waitFor(() => expect(complete).toBeEnabled());
    await userEvent.click(complete);

    expect(useRestTimer.getState().setId).toBe(set.id);
    expect(report).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'workout-set-completed' }),
    );
    await waitFor(() =>
      expect(document.querySelectorAll('[data-tutorial-id="workout-rest"]')).toHaveLength(1),
    );

    gate.resolve();
    await waitFor(() =>
      expect(report).toHaveBeenCalledWith({
        type: 'workout-set-completed',
        workoutId,
        setId: set.id,
      }),
    );
    expect(await firstSet(workoutId)).toMatchObject({ isCompleted: 1 });
  });

  it('emits no completion event when completeSet rejects while preserving immediate rest', async () => {
    const workoutId = await seedTwoSetWorkout();
    const set = await firstSet(workoutId);
    await db.workoutSets.update(set.id, { weight: 80, reps: 10 });
    vi.spyOn(workoutsRepository, 'completeSet').mockRejectedValueOnce(
      new Error('IndexedDB unavailable'),
    );
    const report = vi.fn();
    renderWorkout(report);

    const complete = await screen.findByRole('button', { name: 'Valider la série 1' });
    await waitFor(() => expect(complete).toBeEnabled());
    await userEvent.click(complete);
    await waitFor(() => expect(workoutsRepository.completeSet).toHaveBeenCalledOnce());

    expect(useRestTimer.getState().setId).toBe(set.id);
    expect(report).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'workout-set-completed' }),
    );
  });

  it('reports the exact resting set when its countdown finishes', async () => {
    const workoutId = await seedTwoSetWorkout();
    const set = await firstSet(workoutId);
    await db.workoutSets.update(set.id, { weight: 80, reps: 10 });
    const report = vi.fn();
    renderWorkout(report);

    const complete = await screen.findByRole('button', { name: 'Valider la série 1' });
    await waitFor(() => expect(complete).toBeEnabled());
    await userEvent.click(complete);
    await waitFor(() =>
      expect(report).toHaveBeenCalledWith({
        type: 'workout-set-completed',
        workoutId,
        setId: set.id,
      }),
    );
    report.mockClear();

    act(() => useRestTimer.getState().start(set.id, 0.05));

    await waitFor(() =>
      expect(report).toHaveBeenCalledWith({ type: 'rest-finished', setId: set.id }),
    );
  });

  it('reports opening the finish screen from its unique footer anchor', async () => {
    const workoutId = await seedActiveWorkout();
    const report = vi.fn();
    renderWorkout(report);

    await screen.findByText('Développé couché');
    const finish = document.querySelector(
      '[data-tutorial-id="workout-finish"]',
    ) as HTMLButtonElement | null;
    expect(finish).not.toBeNull();
    await userEvent.click(finish!);

    expect(report).toHaveBeenCalledWith({ type: 'workout-finish-opened', workoutId });
  });
});

describe('WorkoutScreen — effort et fatigue', () => {
  beforeEach(async () => {
    useRestTimer.getState().stop();
    useRepPacer.getState().stop();
    useExerciseOrderLock.getState().reset();
    localStorage.clear();
    await resetDb();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    applyEffortPrompt(true);
    useRestTimer.getState().stop();
    useRepPacer.getState().stop();
  });

  it('demande l’effort sous la série validée, et allonge le repos', async () => {
    const workoutId = await seedTwoSetWorkout();
    const user = userEvent.setup();
    renderWorkout();

    await screen.findByText('Développé couché');
    await user.type(screen.getByRole('textbox', { name: 'Série 1 — kg' }), '80');
    await user.type(screen.getByRole('textbox', { name: 'Série 1 — reps' }), '10');
    await user.click(screen.getByRole('button', { name: 'Valider la série 1' }));

    const strip = await screen.findByRole('group', { name: t('workout.effortQuestion') });
    const rest = useRestTimer.getState();
    expect(rest.setId).not.toBeNull();

    fireEvent.change(within(strip).getByRole('slider', { name: t('workout.rpeGauge') }), {
      target: { value: '9' },
    });
    await user.click(
      within(strip).getByRole('button', { name: t('workout.rpeConfirm', { value: '9' }) }),
    );

    // Trente secondes de plus, comptées depuis l'échéance en cours : les
    // secondes déjà écoulées restent du repos.
    expect(useRestTimer.getState().endsAt).toBe(rest.endsAt + 30_000);
    expect(useRestTimer.getState().seconds).toBe(rest.seconds + 30);

    await waitFor(async () => {
      expect(await firstSet(workoutId)).toMatchObject({ rpe: 9, isCompleted: 1 });
    });
  });

  it('termine le repos sans lancer la série suivante tant que le RPE reste ouvert', async () => {
    const workoutId = await seedTwoSetWorkout();
    const set = await firstSet(workoutId);
    const report = vi.fn();
    const user = userEvent.setup();
    renderWorkout(report);

    await screen.findByText('Développé couché');
    await user.type(screen.getByRole('textbox', { name: 'Série 1 — reps' }), '8');
    await user.click(screen.getByRole('button', { name: 'Valider la série 1' }));
    expect(await screen.findByRole('group', { name: t('workout.effortQuestion') })).toBeVisible();
    report.mockClear();

    act(() => useRestTimer.getState().start(set.id, 0.05));

    await waitFor(() =>
      expect(report).toHaveBeenCalledWith({ type: 'rest-finished', setId: set.id }),
    );
    expect(useRestTimer.getState().setId).toBeNull();
    expect(useRepPacer.getState().setId).toBeNull();
  });

  it('garde l’annonce de reprise à dix silencieuse tant que le RPE reste ouvert', async () => {
    const workoutId = await seedTwoSetWorkout();
    const set = await firstSet(workoutId);
    const announce = vi.spyOn(announcer, 'announce').mockReturnValue(true);
    const user = userEvent.setup();
    renderWorkout();

    await screen.findByText('Développé couché');
    await user.type(screen.getByRole('textbox', { name: 'Série 1 — reps' }), '8');
    await user.click(screen.getByRole('button', { name: 'Valider la série 1' }));
    expect(await screen.findByRole('group', { name: t('workout.effortQuestion') })).toBeVisible();
    announce.mockClear();

    act(() => useRestTimer.getState().start(set.id, 10.05));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(announce).not.toHaveBeenCalledWith('rest-10');
  });

  it('ne demande rien quand le réglage est éteint', async () => {
    await seedTwoSetWorkout();
    applyEffortPrompt(false);
    const user = userEvent.setup();
    renderWorkout();

    await screen.findByText('Développé couché');
    await user.type(screen.getByRole('textbox', { name: 'Série 1 — reps' }), '10');
    await user.click(screen.getByRole('button', { name: 'Valider la série 1' }));

    await waitFor(() => {
      expect(useRestTimer.getState().setId).not.toBeNull();
    });
    expect(
      screen.queryByRole('group', { name: t('workout.effortQuestion') }),
    ).not.toBeInTheDocument();
    applyEffortPrompt(true);
  });

  it('garde la question d’effort visible quand la dernière série replie la carte', async () => {
    await seedActiveWorkout();
    const user = userEvent.setup();
    renderWorkout();

    await screen.findByText('Développé couché');
    await user.type(screen.getByRole('textbox', { name: 'Série 1 — kg' }), '60');
    await user.type(screen.getByRole('textbox', { name: 'Série 1 — reps' }), '8');
    const complete = screen.getByRole('button', { name: 'Valider la série 1' });
    await waitFor(() => expect(complete).toBeEnabled());
    await user.click(complete);

    expect(await screen.findByRole('group', { name: t('workout.effortQuestion') })).toBeVisible();
    await waitFor(() => {
      expect(screen.getByRole('button', { expanded: false })).toHaveTextContent('Développé couché');
    });
  });

  it('lance la cadence depuis le chrono de la carte, puis l’arrête d’un doigt', async () => {
    const workoutId = await seedTwoSetWorkout();
    const user = userEvent.setup();
    renderWorkout();

    await screen.findByText('Développé couché');
    await user.type(screen.getByRole('textbox', { name: 'Série 1 — reps' }), '8');
    await waitFor(async () => expect(await firstSet(workoutId)).toMatchObject({ reps: 8 }));
    act(() => useRestTimer.getState().start('previous-set', 90));

    await user.click(
      screen.getByRole('button', {
        name: t('workout.paceOpen', { name: 'Développé couché' }),
      }),
    );
    await user.click(screen.getByRole('button', { name: t('workout.pace') }));

    expect(useRepPacer.getState().setId).not.toBeNull();
    expect(useRestTimer.getState().setId).toBeNull();
    expect(screen.getByText(/Cadence · 1\/8/)).toBeVisible();

    // Le chrono du bandeau est devenu l'arrêt : la cadence se coupe d'un doigt,
    // sans repasser par la feuille.
    await user.click(screen.getByRole('button', { name: t('workout.paceStop') }));
    expect(useRepPacer.getState().setId).toBeNull();
  });

  it('bat le tempo choisi dans la feuille, et le garde sur l’exercice', async () => {
    const workoutId = await seedTwoSetWorkout();
    const user = userEvent.setup();
    renderWorkout();

    await screen.findByText('Développé couché');
    await user.type(screen.getByRole('textbox', { name: 'Série 1 — reps' }), '8');
    await waitFor(async () => expect(await firstSet(workoutId)).toMatchObject({ reps: 8 }));

    await user.click(
      screen.getByRole('button', {
        name: t('workout.paceOpen', { name: 'Développé couché' }),
      }),
    );
    // Cinq secondes par répétition : un tempo lent, choisi, que rien ne
    // rallonge ni ne raccourcit ensuite.
    await user.click(screen.getByRole('button', { name: '5', pressed: false }));
    await waitFor(async () => {
      const detail = await getWorkoutDetail(workoutId);
      expect(detail?.exercises[0]?.row.repSeconds).toBe(5);
    });

    await user.click(screen.getByRole('button', { name: t('workout.pace') }));
    expect(useRepPacer.getState().repSeconds).toBe(5);
  });

  it('arme la première cadence depuis la valeur complète des répétitions', async () => {
    const workoutId = await seedTwoSetWorkout();
    const first = (await getWorkoutDetail(workoutId))?.exercises[0]?.sets[0];
    if (first === undefined) throw new Error('série absente');

    const user = userEvent.setup();
    renderWorkout();

    await screen.findByText('Développé couché');
    await user.type(screen.getByRole('textbox', { name: 'Série 1 — kg' }), '80');
    expect(useRepPacer.getState().setId).toBeNull();
    await user.type(screen.getByRole('textbox', { name: 'Série 1 — reps' }), '10');

    await waitFor(() => expect(useRepPacer.getState().setId).toBe(first.id), { timeout: 2_000 });
    expect(useRepPacer.getState().reps).toBe(10);
    expect(useRepPacer.getState().startedAt - Date.now()).toBeGreaterThan(8_000);
    expect(screen.getByText(/Départ · 10/)).toBeVisible();
  });

  it("arme aussi la première série d'un nouvel exercice", async () => {
    const workoutId = await seedActiveWorkout();
    const secondExercise = await createCustomExercise({
      name: 'Tirage horizontal',
      primaryMuscle: 'upper_back',
      secondaryMuscles: [],
      equipment: 'cable',
      measurementType: 'weight_reps',
      isUnilateral: 0,
    });
    await addWorkoutExercise(workoutId, secondExercise.id);
    const detail = await getWorkoutDetail(workoutId);
    const firstExerciseSet = detail?.exercises[0]?.sets[0];
    const nextExerciseSet = detail?.exercises[1]?.sets[0];
    if (firstExerciseSet === undefined || nextExerciseSet === undefined) {
      throw new Error('séries de séance absentes');
    }
    await db.workoutSets.update(firstExerciseSet.id, {
      reps: 8,
      isCompleted: 1,
      performedAt: Date.now(),
    });

    const user = userEvent.setup();
    renderWorkout();

    await screen.findByText('Tirage horizontal');
    await user.type(screen.getByRole('textbox', { name: 'Série 1 — reps' }), '12');

    await waitFor(() => expect(useRepPacer.getState().setId).toBe(nextExerciseSet.id), {
      timeout: 2_000,
    });
    expect(useRepPacer.getState().reps).toBe(12);
    expect(useRepPacer.getState().startedAt - Date.now()).toBeGreaterThan(8_000);
  });

  it("prépare dans dix secondes l'exercice suivant renseigné pendant le repos", async () => {
    const workoutId = await seedActiveWorkout();
    const secondExercise = await createCustomExercise({
      name: 'Tirage horizontal',
      primaryMuscle: 'upper_back',
      secondaryMuscles: [],
      equipment: 'cable',
      measurementType: 'weight_reps',
      isUnilateral: 0,
    });
    await addWorkoutExercise(workoutId, secondExercise.id);
    const detail = await getWorkoutDetail(workoutId);
    const firstExerciseSet = detail?.exercises[0]?.sets[0];
    const nextExerciseSet = detail?.exercises[1]?.sets[0];
    if (firstExerciseSet === undefined || nextExerciseSet === undefined) {
      throw new Error('séries de séance absentes');
    }

    const user = userEvent.setup();
    renderWorkout();

    await screen.findByText('Tirage horizontal');
    const firstCard = screen.getByRole('button', {
      name: /Développé couché/,
      expanded: true,
    }).parentElement?.parentElement;
    if (firstCard === null || firstCard === undefined) throw new Error('première carte absente');
    await user.type(within(firstCard).getByRole('textbox', { name: 'Série 1 — kg' }), '60');
    await user.type(within(firstCard).getByRole('textbox', { name: 'Série 1 — reps' }), '8');
    const completeFirst = within(firstCard).getByRole('button', { name: 'Valider la série 1' });
    await waitFor(() => expect(completeFirst).toBeEnabled());
    await user.click(completeFirst);
    await waitFor(() => expect(useRestTimer.getState().setId).toBe(firstExerciseSet.id));

    const nextCard = screen.getByRole('button', {
      name: /Tirage horizontal/,
      expanded: true,
    }).parentElement?.parentElement;
    if (nextCard === null || nextCard === undefined) throw new Error('carte suivante absente');
    await user.type(within(nextCard).getByRole('textbox', { name: 'Série 1 — reps' }), '12');
    expect(useRepPacer.getState().setId).toBeNull();

    await user.click(screen.getByRole('button', { name: t('workout.rpeConfirm', { value: '8' }) }));

    act(() => useRestTimer.getState().start(firstExerciseSet.id, 0.05));

    await waitFor(() => expect(useRepPacer.getState().setId).toBe(nextExerciseSet.id));
    expect(useRestTimer.getState().setId).toBeNull();
    expect(useRepPacer.getState().reps).toBe(12);
    expect(useRepPacer.getState().startedAt - Date.now()).toBeGreaterThan(8_000);
    expect(within(nextCard).getByText(/Départ · 10/)).toBeVisible();
  });

  it('lance toute seule la cadence suivante à la fin du compte à rebours', async () => {
    const workoutId = await seedTwoSetWorkout();
    applyEffortPrompt(false);
    const detail = await getWorkoutDetail(workoutId);
    const [first, second] = detail?.exercises[0]?.sets ?? [];
    if (first === undefined || second === undefined) throw new Error('séries absentes');

    const user = userEvent.setup();
    renderWorkout();

    await screen.findByText('Développé couché');
    await user.type(screen.getByRole('textbox', { name: 'Série 2 — reps' }), '10');
    await user.type(screen.getByRole('textbox', { name: 'Série 1 — reps' }), '8');
    await user.click(screen.getByRole('button', { name: 'Valider la série 1' }));
    await waitFor(async () => {
      expect(await firstSet(workoutId)).toMatchObject({ isCompleted: 1 });
    });

    // Raccourcit seulement l'attente du test : dans l'app, les trois dernières
    // secondes du vrai repos jouent 3–2–1 avant ce même passage de relais.
    act(() => useRestTimer.getState().start(first.id, 0.05));

    await waitFor(() => expect(useRepPacer.getState().setId).toBe(second.id));
    expect(useRestTimer.getState().setId).toBeNull();
    expect(screen.getByText(/Cadence · 1\/10/)).toBeVisible();
  });

  it('ne lance pas une prescription fantôme quand les prochaines reps sont vides', async () => {
    const workoutId = await seedTwoSetWorkout();
    const detail = await getWorkoutDetail(workoutId);
    const [first, second] = detail?.exercises[0]?.sets ?? [];
    if (first === undefined || second === undefined) throw new Error('séries absentes');

    const user = userEvent.setup();
    renderWorkout();

    await screen.findByText('Développé couché');
    await user.type(screen.getByRole('textbox', { name: 'Série 1 — reps' }), '8');
    await user.click(screen.getByRole('button', { name: 'Valider la série 1' }));
    act(() => useRestTimer.getState().start(first.id, 0.05));

    await waitFor(() => expect(useRestTimer.getState().setId).toBeNull());
    expect(useRepPacer.getState().setId).toBeNull();

    await user.type(screen.getByRole('textbox', { name: 'Série 2 — reps' }), '10');
    await waitFor(() => expect(useRepPacer.getState().setId).toBe(second.id), { timeout: 2_000 });
    expect(useRepPacer.getState().reps).toBe(10);
    expect(useRepPacer.getState().startedAt - Date.now()).toBeGreaterThan(8_000);
    expect(screen.getByText(/Départ · 10/)).toBeVisible();
  });
});

/**
 * « Sur pas mal d'exos on peut ajouter des plaques pour se lester, ou même des
 * exos qui peuvent se faire avec des plaques ; or pour le moment on ne peut pas
 * choisir si un exo a des plaques et si les plaques sont sur une barre ou non. »
 * Remonté du téléphone. Le calculateur se réglait au matériel : une traction
 * lestée n'y avait droit à rien, et le poids de barre saisi mourait avec la
 * feuille.
 */
describe('WorkoutScreen — plaques réglées sur la fiche', () => {
  beforeEach(async () => {
    useRestTimer.getState().stop();
    useRepPacer.getState().stop();
    useExerciseOrderLock.getState().reset();
    await resetDb();
  });

  afterEach(() => {
    useRestTimer.getState().stop();
    useRepPacer.getState().stop();
  });

  async function seedWorkoutWith(
    overrides: Partial<Parameters<typeof createCustomExercise>[0]>,
  ): Promise<string> {
    const exercise = await createCustomExercise({
      name: 'Traction lestée',
      primaryMuscle: 'lats',
      secondaryMuscles: [],
      equipment: 'bodyweight',
      measurementType: 'reps_only',
      isUnilateral: 0,
      ...overrides,
    });
    const routine = await createRoutine('Tirage');
    await addExercisesToRoutine(routine.id, [exercise.id]);
    return (await startWorkoutFromRoutine(routine.id)).id;
  }

  it('n’offre aucun calcul de plaques tant que la fiche n’a rien dit', async () => {
    const workoutId = await seedWorkoutWith({});
    const user = userEvent.setup();
    renderWorkout();

    await screen.findByText('Traction lestée');
    await user.type(screen.getByRole('textbox', { name: 'Série 1 — kg' }), '25');
    await waitFor(async () => {
      expect((await firstSet(workoutId)).weight).toBe(25);
    });

    expect(screen.queryByRole('button', { name: 'Plaques à charger' })).not.toBeInTheDocument();
  });

  it('calcule le lest d’une traction dès que la fiche dit « un seul côté »', async () => {
    await seedWorkoutWith({ plateLoading: 'single_sided' });
    const user = userEvent.setup();
    renderWorkout();

    await screen.findByText('Traction lestée');
    await user.type(screen.getByRole('textbox', { name: 'Série 1 — kg' }), '25');

    const plates = await screen.findByRole('button', { name: 'Plaques à charger' });
    await user.click(plates);

    expect(await screen.findByText('À charger')).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();
  });

  it('retient le poids de barre saisi dans la feuille, au-delà de sa fermeture', async () => {
    const workoutId = await seedWorkoutWith({
      name: 'Curl barre EZ',
      primaryMuscle: 'biceps',
      equipment: 'barbell',
      measurementType: 'weight_reps',
    });
    const detail = await getWorkoutDetail(workoutId);
    const exerciseId = detail!.exercises[0]!.row.exerciseId;
    const user = userEvent.setup();
    renderWorkout();

    await screen.findByText('Curl barre EZ');
    await user.type(screen.getByRole('textbox', { name: 'Série 1 — kg' }), '40');
    await user.click(await screen.findByRole('button', { name: 'Plaques à charger' }));

    const field = await screen.findByLabelText('Poids de la barre');
    await user.clear(field);
    await user.type(field, '10');

    await waitFor(async () => {
      expect((await db.exercises.get(exerciseId))?.plateBaseWeightKg).toBe(10);
    });
  });
});

async function seedTimedWorkout(): Promise<string> {
  const exercise = await createCustomExercise({
    name: 'Gainage',
    primaryMuscle: 'abs',
    secondaryMuscles: [],
    equipment: 'bodyweight',
    measurementType: 'time_only',
    isUnilateral: 0,
  });
  const routine = await createRoutine('Ceinture');
  await addExercisesToRoutine(routine.id, [exercise.id]);
  return (await startWorkoutFromRoutine(routine.id)).id;
}

describe('WorkoutScreen — chrono de maintien', () => {
  beforeEach(async () => {
    useRestTimer.getState().stop();
    useRepPacer.getState().stop();
    useHoldTimer.getState().stop();
    useExerciseOrderLock.getState().reset();
    await resetDb();
  });

  afterEach(() => {
    vi.useRealTimers();
    useRestTimer.getState().stop();
    useRepPacer.getState().stop();
    useHoldTimer.getState().stop();
  });

  it('écrit le temps tenu, relâchement retiré, quand la série est validée', async () => {
    const workoutId = await seedTimedWorkout();
    const user = userEvent.setup();
    renderWorkout();

    await screen.findByText('Gainage');
    await user.click(screen.getByRole('button', { name: 'Chrono de Gainage' }));
    await user.click(await screen.findByRole('button', { name: t('workout.holdStart') }));
    expect(useHoldTimer.getState().setId).not.toBeNull();

    // Quarante-sept secondes tenues, obtenues en reculant le départ plutôt qu'en
    // faussant l'horloge : les faux minuteurs figent aussi `fake-indexeddb`, et
    // la séance n'arriverait jamais à l'écran.
    act(() => {
      useHoldTimer.setState({ startedAt: Date.now() - 47_000 });
    });

    // Aucune durée n'a été saisie. Si la coche n'était pas active pendant un
    // maintien, le chrono n'aurait aucune sortie.
    await user.click(screen.getByRole('button', { name: 'Valider la série 1' }));

    await waitFor(async () => {
      expect(await firstSet(workoutId)).toMatchObject({ durationSeconds: 45, isCompleted: 1 });
    });
    expect(useHoldTimer.getState().setId).toBeNull();
  });

  it('laisse intacte une série chronométrée validée à la main, sans chrono', async () => {
    const workoutId = await seedTimedWorkout();
    const user = userEvent.setup();
    renderWorkout();

    await screen.findByText('Gainage');
    await user.type(screen.getByRole('textbox', { name: 'Série 1 — s' }), '40');

    const validate = screen.getByRole('button', { name: 'Valider la série 1' });
    await waitFor(() => expect(validate).toBeEnabled());
    await user.click(validate);

    await waitFor(async () => {
      expect(await firstSet(workoutId)).toMatchObject({ durationSeconds: 40, isCompleted: 1 });
    });
  });

  // Même raison que pour le repos : une horloge qui suit un set disparu avec sa
  // ligne ne s'arrêterait jamais toute seule.
  it('arrête le chrono quand son exercice est retiré de la séance', async () => {
    await seedTimedWorkout();
    const user = userEvent.setup();
    renderWorkout();

    await screen.findByText('Gainage');
    await user.click(screen.getByRole('button', { name: 'Chrono de Gainage' }));
    await user.click(await screen.findByRole('button', { name: t('workout.holdStart') }));
    expect(useHoldTimer.getState().setId).not.toBeNull();

    await user.click(screen.getByRole('button', { name: 'Options de Gainage' }));
    await user.click(await screen.findByRole('button', { name: t('workout.removeExercise') }));
    // La feuille de confirmation reprend le même libellé que l'entrée du menu ;
    // la dernière occurrence est la sienne.
    const confirms = await screen.findAllByRole('button', {
      name: t('workout.removeExercise'),
    });
    await user.click(confirms[confirms.length - 1] as HTMLElement);

    await waitFor(() => {
      expect(useHoldTimer.getState().setId).toBeNull();
    });
  });
});

async function seedUnilateralHoldWorkout(): Promise<string> {
  const exercise = await createCustomExercise({
    name: 'Planche latérale',
    primaryMuscle: 'abs',
    secondaryMuscles: [],
    equipment: 'bodyweight',
    measurementType: 'time_only',
    isUnilateral: 1,
  });
  const routine = await createRoutine('Ceinture');
  await addExercisesToRoutine(routine.id, [exercise.id]);
  return (await startWorkoutFromRoutine(routine.id)).id;
}

describe('WorkoutScreen — exercice unilatéral', () => {
  beforeEach(async () => {
    useRestTimer.getState().stop();
    useRepPacer.getState().stop();
    useHoldTimer.getState().stop();
    useExerciseOrderLock.getState().reset();
    await resetDb();
  });

  afterEach(() => {
    useRestTimer.getState().stop();
    useRepPacer.getState().stop();
    useHoldTimer.getState().stop();
  });

  it('fait deux côtés et une seule validation sur la même série', async () => {
    const workoutId = await seedUnilateralHoldWorkout();
    const user = userEvent.setup();
    renderWorkout();

    await screen.findByText('Planche latérale');
    await user.click(screen.getByRole('button', { name: 'Chrono de Planche latérale' }));
    await user.click(await screen.findByRole('button', { name: t('workout.holdStart') }));
    const setId = useHoldTimer.getState().setId;
    expect(setId).not.toBeNull();

    // Premier côté tenu, puis relâché.
    act(() => {
      useHoldTimer.setState({ startedAt: Date.now() - 42_000 });
    });
    await user.click(screen.getByRole('button', { name: 'Valider la série 1' }));

    // Rien de durable : ni validation, ni repos, ni RPE.
    expect((await firstSet(workoutId)).isCompleted).toBe(0);
    expect((await firstSet(workoutId)).durationSeconds).toBeUndefined();
    expect(useRestTimer.getState().setId).toBeNull();
    expect(screen.queryByRole('group', { name: t('workout.effortQuestion') })).toBeNull();
    // Le relevé le dit, y compris en Silence.
    expect(await screen.findByText(/Changement de côté ·/)).toBeInTheDocument();
    // Même série : changer de côté ne crée pas de ligne.
    expect(useHoldTimer.getState().setId).toBe(setId);

    // Second côté, une fois les dix secondes passées.
    act(() => {
      useHoldTimer.setState({ startedAt: Date.now() - 40_000 });
    });
    await user.click(screen.getByRole('button', { name: 'Valider la série 1' }));

    await waitFor(async () => {
      expect(await firstSet(workoutId)).toMatchObject({ durationSeconds: 38, isCompleted: 1 });
    });

    // Une seule série en base, et son côté n'a pas bougé : une ligne représente
    // les deux côtés, elle ne se dédouble pas.
    const detail = await getWorkoutDetail(workoutId);
    expect(detail?.exercises[0]?.sets).toHaveLength(1);
    expect(detail?.exercises[0]?.sets[0]?.side).toBe('both');
  });
});
