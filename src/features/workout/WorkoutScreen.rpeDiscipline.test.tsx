import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as announcer from '@/audio/announce';
import { db } from '@/data/db';
import { createCustomExercise } from '@/data/repositories/exercises';
import { setRpeDisciplineSettings } from '@/data/repositories/rpeDiscipline';
import { addExercisesToRoutine, createRoutine } from '@/data/repositories/routines';
import {
  duplicateLastSet,
  getWorkoutDetail,
  startWorkoutFromRoutine,
} from '@/data/repositories/workouts';
import { t } from '@/i18n/fr';
import { useExerciseOrderLock } from '@/stores/exerciseOrderLock';
import { useRepPacer } from '@/stores/repPacer';
import { useRestTimer } from '@/stores/restTimer';
import { resetDb } from '@/test/resetDb';
import { formatNumber } from '@/ui/numberField';
import { WorkoutScreen } from './WorkoutScreen';

/**
 * Le protocole disciplinaire RPE vu de l'écran de séance : le verrou, l'annonce unique, les deux
 * sorties, et ce qui reste toujours possible — consulter et terminer.
 */

async function seedThreeSetWorkout(): Promise<{ workoutId: string; setIds: string[] }> {
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
  const workoutId = (await startWorkoutFromRoutine(routine.id)).id;
  const row = (await getWorkoutDetail(workoutId))!.exercises[0]!.row;
  while ((await getWorkoutDetail(workoutId))!.exercises[0]!.sets.length < 3) {
    await duplicateLastSet(row.id);
  }
  const sets = (await getWorkoutDetail(workoutId))!.exercises[0]!.sets;
  for (const set of sets) await db.workoutSets.update(set.id, { targetReps: 8, targetWeight: 80 });
  return { workoutId, setIds: sets.map((set) => set.id) };
}

function renderWorkout() {
  return render(
    <MemoryRouter initialEntries={['/workout']}>
      <Routes>
        <Route path="/workout" element={<WorkoutScreen />} />
        <Route path="/workout/finish" element={<p>Bilan de séance</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function validateFirstSetAndRate(value: string) {
  const user = userEvent.setup();
  await screen.findByText('Développé couché');
  await user.click(screen.getByRole('button', { name: 'Valider la série 1' }));
  const strip = await screen.findByRole('group', { name: t('workout.effortQuestion') });
  fireEvent.change(within(strip).getByRole('slider', { name: t('workout.rpeGauge') }), {
    target: { value },
  });
  const label = t('workout.rpeConfirm', { value: formatNumber(Number(value)) });
  await user.click(within(strip).getByRole('button', { name: label }));
  return user;
}

const breachCalls = (spy: { mock: { calls: unknown[][] } }) =>
  spy.mock.calls.filter(([cue]) => cue === 'rpe-discipline-breach').length;

describe('WorkoutScreen — protocole disciplinaire RPE', () => {
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

  it('laisse la séance ouverte à RPE 8, exactement le plafond', async () => {
    const spy = vi.spyOn(announcer, 'announce');
    await seedThreeSetWorkout();
    renderWorkout();
    await validateFirstSetAndRate('8');

    await waitFor(() => expect(useRestTimer.getState().seconds).toBeGreaterThan(0));
    expect(screen.queryByText(t('rpeDiscipline.lockedTitle'))).toBeNull();
    expect(screen.getByRole('button', { name: 'Valider la série 2' })).toBeEnabled();
    expect(breachCalls(spy)).toBe(0);
  });

  it('enregistre la série, verrouille, et annonce une seule fois — même au remontage', async () => {
    const spy = vi.spyOn(announcer, 'announce');
    const { setIds } = await seedThreeSetWorkout();
    const view = renderWorkout();
    await validateFirstSetAndRate('9');

    expect(await screen.findByText(t('rpeDiscipline.lockedTitle'))).toBeVisible();
    expect(
      screen.getByText(
        t('rpeDiscipline.lockedBody', {
          rpe: '9',
          ceiling: '8',
          exercise: 'Développé couché',
          number: 1,
        }),
      ),
    ).toBeVisible();
    expect(await db.workoutSets.get(setIds[0]!)).toMatchObject({ isCompleted: 1, rpe: 9 });
    expect(screen.getByRole('button', { name: 'Valider la série 2' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Annuler la série 1' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: t('workout.addSet') })).toBeNull();
    expect(useRestTimer.getState().setId).toBeNull();
    expect(breachCalls(spy)).toBe(1);
    // Le carillon et la phrase sont le cue ; la validation ne parle pas par-dessus.
    expect(spy.mock.calls.map(([cue]) => cue)).not.toContain('rest-extended');

    // Un rechargement relit le verrou dans la base, sans rejouer l'annonce.
    view.unmount();
    renderWorkout();
    expect(await screen.findByText(t('rpeDiscipline.lockedTitle'))).toBeVisible();
    expect(screen.getByRole('button', { name: 'Valider la série 2' })).toBeDisabled();
    expect(breachCalls(spy)).toBe(1);
  });

  it('laisse toujours terminer la séance', async () => {
    await seedThreeSetWorkout();
    renderWorkout();
    const user = await validateFirstSetAndRate('9.5');
    await screen.findByText(t('rpeDiscipline.lockedTitle'));

    await user.click(screen.getByRole('button', { name: t('workout.finish') }));
    expect(await screen.findByText('Bilan de séance')).toBeVisible();
  });

  it('corrige une erreur de saisie et rouvre la séance, avec la trace', async () => {
    const { workoutId, setIds } = await seedThreeSetWorkout();
    renderWorkout();
    const user = await validateFirstSetAndRate('9');
    await screen.findByText(t('rpeDiscipline.lockedTitle'));

    await user.click(screen.getByRole('button', { name: t('rpeDiscipline.correct') }));
    await user.click(
      await screen.findByRole('button', { name: t('rpeDiscipline.correctOption', { value: '7' }) }),
    );

    await waitFor(() => expect(screen.queryByText(t('rpeDiscipline.lockedTitle'))).toBeNull());
    expect(screen.getByRole('button', { name: 'Valider la série 2' })).toBeEnabled();
    expect((await db.workoutSets.get(setIds[0]!))?.rpe).toBe(7);
    expect((await db.workouts.get(workoutId))?.rpeDiscipline).toMatchObject([
      { kind: 'triggered', rpe: 9 },
      { kind: 'corrected', previousRpe: 9, rpe: 7 },
    ]);
    expect(await screen.findByText(t('rpeDiscipline.traceTitle'))).toBeVisible();
  });

  it('déverrouille à titre exceptionnel après confirmation explicite, et le trace', async () => {
    const spy = vi.spyOn(announcer, 'announce');
    const { workoutId } = await seedThreeSetWorkout();
    renderWorkout();
    const user = await validateFirstSetAndRate('9');
    await screen.findByText(t('rpeDiscipline.lockedTitle'));

    await user.click(screen.getByRole('button', { name: t('rpeDiscipline.override') }));
    // Un premier appui n'ouvre que la confirmation : rien n'est encore écrit.
    expect(await screen.findByText(t('rpeDiscipline.overrideBody'))).toBeVisible();
    expect((await db.workouts.get(workoutId))?.rpeDiscipline).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: t('rpeDiscipline.overrideConfirm') }));

    await waitFor(() => expect(screen.queryByText(t('rpeDiscipline.lockedTitle'))).toBeNull());
    expect(screen.getByRole('button', { name: 'Valider la série 2' })).toBeEnabled();
    expect((await db.workouts.get(workoutId))?.rpeDiscipline?.at(-1)).toMatchObject({
      kind: 'override',
    });
    expect(spy.mock.calls.map(([cue]) => cue)).toContain('rpe-discipline-override');
  });

  it('ne fait rien protocole désactivé', async () => {
    await setRpeDisciplineSettings({ enabled: false, ceiling: 8 });
    const spy = vi.spyOn(announcer, 'announce');
    await seedThreeSetWorkout();
    renderWorkout();
    await validateFirstSetAndRate('10');

    await waitFor(() => expect(useRestTimer.getState().seconds).toBeGreaterThan(30));
    expect(screen.queryByText(t('rpeDiscipline.lockedTitle'))).toBeNull();
    expect(breachCalls(spy)).toBe(0);
  });
});
