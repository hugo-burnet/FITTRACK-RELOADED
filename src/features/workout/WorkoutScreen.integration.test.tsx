import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { createCustomExercise } from '@/data/repositories/exercises';
import { addExercisesToRoutine, createRoutine } from '@/data/repositories/routines';
import {
  addWorkoutExercise,
  duplicateLastSet,
  getWorkoutDetail,
  startWorkoutFromRoutine,
} from '@/data/repositories/workouts';
import type { WorkoutSet } from '@/data/types';
import { t } from '@/i18n/fr';
import { useExerciseOrderLock } from '@/stores/exerciseOrderLock';
import { applyEffortPrompt } from '@/stores/effortPrompt';
import { useRepPacer } from '@/stores/repPacer';
import { useRestTimer } from '@/stores/restTimer';
import { recordCoachSignals } from '@/data/repositories/coachRecommendations';
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
    expect(
      await screen.findByText('47,5 → 50 kg car 3 × 12 a atteint le haut de la fourchette.'),
    ).toBeVisible();

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

describe('WorkoutScreen — effort et fatigue', () => {
  beforeEach(async () => {
    useRestTimer.getState().stop();
    useRepPacer.getState().stop();
    useExerciseOrderLock.getState().reset();
    localStorage.clear();
    await resetDb();
  });

  afterEach(() => {
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

  it('propose une cadence nommée dans le menu, puis un arrêt direct', async () => {
    await seedTwoSetWorkout();
    const user = userEvent.setup();
    renderWorkout();

    await screen.findByText('Développé couché');
    await user.type(screen.getByRole('textbox', { name: 'Série 1 — reps' }), '8');
    act(() => useRestTimer.getState().start('previous-set', 90));
    await user.click(
      screen.getByRole('button', {
        name: t('workout.exerciseMenu', { name: 'Développé couché' }),
      }),
    );
    await user.click(screen.getByRole('button', { name: /Lancer la cadence/ }));
    expect(useRepPacer.getState().setId).not.toBeNull();
    expect(useRestTimer.getState().setId).toBeNull();
    expect(screen.getByText(/Cadence · 1\/8/)).toBeVisible();

    await user.click(screen.getByRole('button', { name: t('workout.paceStop') }));
    expect(useRepPacer.getState().setId).toBeNull();
  });

  it('lance toute seule la cadence suivante à la fin du compte à rebours', async () => {
    const workoutId = await seedTwoSetWorkout();
    const detail = await getWorkoutDetail(workoutId);
    const [first, second] = detail?.exercises[0]?.sets ?? [];
    if (first === undefined || second === undefined) throw new Error('séries absentes');

    const user = userEvent.setup();
    renderWorkout();

    await screen.findByText('Développé couché');
    await user.type(screen.getByRole('textbox', { name: 'Série 2 — reps' }), '6');
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
    expect(screen.getByText(/Cadence · 1\/6/)).toBeVisible();
  });

  it('ne lance pas une prescription fantôme quand les prochaines reps sont vides', async () => {
    const workoutId = await seedTwoSetWorkout();
    const detail = await getWorkoutDetail(workoutId);
    const first = detail?.exercises[0]?.sets[0];
    if (first === undefined) throw new Error('série absente');

    const user = userEvent.setup();
    renderWorkout();

    await screen.findByText('Développé couché');
    await user.type(screen.getByRole('textbox', { name: 'Série 1 — reps' }), '8');
    await user.click(screen.getByRole('button', { name: 'Valider la série 1' }));
    act(() => useRestTimer.getState().start(first.id, 0.05));

    await waitFor(() => expect(useRestTimer.getState().setId).toBeNull());
    expect(useRepPacer.getState().setId).toBeNull();
  });
});
