import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/data/db';
import { createCustomExercise } from '@/data/repositories/exercises';
import { addExercisesToRoutine, createRoutine } from '@/data/repositories/routines';
import {
  completeSet,
  getWorkoutDetail,
  startWorkoutFromRoutine,
} from '@/data/repositories/workouts';
import * as workoutsRepository from '@/data/repositories/workouts';
import type { WorkoutDetail } from '@/data/repositories/workouts';
import { TutorialContext } from '@/features/tutorial/tutorialContext';
import type { TutorialControls } from '@/features/tutorial/tutorialContext';
import { resetDb } from '@/test/resetDb';
import { ActiveWorkoutBar } from './ActiveWorkoutBar';
import { STALE_WORKOUT_MS, isWorkoutStale } from './staleWorkout';

describe('isWorkoutStale', () => {
  const now = 2_000_000_000_000;

  it('keeps a workout younger than twelve hours on the direct resume path', () => {
    expect(isWorkoutStale(now - STALE_WORKOUT_MS + 1, now)).toBe(false);
  });

  it('offers recovery at exactly twelve hours', () => {
    expect(isWorkoutStale(now - STALE_WORKOUT_MS, now)).toBe(true);
  });

  it('offers recovery after twelve hours', () => {
    expect(isWorkoutStale(now - STALE_WORKOUT_MS - 1, now)).toBe(true);
  });
});

function LocationProbe() {
  return createElement('output', { 'data-testid': 'location-probe' }, useLocation().pathname);
}

function renderBar({
  report = vi.fn<TutorialControls['report']>(),
  offerMission = vi.fn<TutorialControls['offerMission']>(),
}: {
  report?: TutorialControls['report'];
  offerMission?: TutorialControls['offerMission'];
} = {}) {
  render(
    createElement(
      TutorialContext.Provider,
      { value: { openHelp: vi.fn(), startMission: vi.fn(), offerMission, report } },
      createElement(
        MemoryRouter,
        { initialEntries: ['/'] },
        createElement(ActiveWorkoutBar),
        createElement(LocationProbe),
      ),
    ),
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

describe('ActiveWorkoutBar recovery', () => {
  const now = 2_000_000_000_000;

  beforeEach(async () => {
    await resetDb();
    vi.spyOn(Date, 'now').mockReturnValue(now);
  });

  afterEach(() => vi.restoreAllMocks());

  async function createActiveWorkout(stale: boolean) {
    const exercise = await createCustomExercise({
      name: 'Développé guidé',
      primaryMuscle: 'chest',
      secondaryMuscles: [],
      equipment: 'machine',
      measurementType: 'weight_reps',
      isUnilateral: 0,
    });
    const routine = await createRoutine('Poussée');
    await addExercisesToRoutine(routine.id, [exercise.id]);
    const workout = await startWorkoutFromRoutine(routine.id);
    await db.workouts.update(workout.id, {
      startedAt: stale ? now - STALE_WORKOUT_MS : now - STALE_WORKOUT_MS + 1,
    });
    return workout;
  }

  it('keeps a young workout on the direct Link resume path', async () => {
    await createActiveWorkout(false);
    renderBar();

    const resume = await screen.findByRole('link', { name: /Poussée/ });
    expect(resume).toHaveAttribute('href', '/workout');
    expect(screen.queryByRole('button', { name: /Poussée/ })).not.toBeInTheDocument();
  });

  it('keeps discard inaccessible until the real workout detail resolves, then counts completed sets', async () => {
    const workout = await createActiveWorkout(true);
    const firstSet = (await getWorkoutDetail(workout.id))?.exercises[0]?.sets[0];
    if (firstSet === undefined) throw new Error('Expected the seeded first set');
    await completeSet(firstSet.id, { weight: 42, reps: 8 });
    const actualDetail = await getWorkoutDetail(workout.id);
    const pending = deferred<WorkoutDetail | null>();
    vi.spyOn(workoutsRepository, 'getWorkoutDetail').mockReturnValue(pending.promise);
    const offerMission = vi.fn();
    renderBar({ offerMission });

    await userEvent.click(await screen.findByRole('button', { name: /Poussée/ }));
    expect(offerMission).toHaveBeenCalledWith('TUT-REC-01');
    const discard = screen.getByRole('button', { name: 'Abandonner la séance' });
    expect(discard).toBeDisabled();
    expect(screen.queryByText(/0 série/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reprendre la séance' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Voir le bilan et terminer' })).toBeEnabled();

    pending.resolve(actualDetail);
    await waitFor(() => expect(discard).toBeEnabled());
    await userEvent.click(discard);
    expect(screen.getByText('La série validée ne sera pas conservée.')).toBeVisible();
  });

  it.each([
    ['Reprendre la séance', 'resume', '/workout'],
    ['Voir le bilan et terminer', 'finish', '/workout/finish'],
  ] as const)('reports %s and navigates explicitly', async (label, choice, destination) => {
    const workout = await createActiveWorkout(true);
    const report = vi.fn();
    renderBar({ report });

    await userEvent.click(await screen.findByRole('button', { name: /Poussée/ }));
    await userEvent.click(screen.getByRole('button', { name: label }));

    expect(report).toHaveBeenCalledWith({
      type: 'stale-workout-choice',
      workoutId: workout.id,
      choice,
    });
    expect(screen.getByTestId('location-probe')).toHaveTextContent(destination);
  });

  it('does not report, close, or navigate when durable discard rejects', async () => {
    await createActiveWorkout(true);
    const report = vi.fn();
    const discard = vi
      .spyOn(workoutsRepository, 'discardWorkout')
      .mockRejectedValueOnce(new Error('IndexedDB unavailable'));
    renderBar({ report });

    await userEvent.click(await screen.findByRole('button', { name: /Poussée/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Abandonner la séance' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmer l’abandon' }));
    await waitFor(() => expect(discard).toHaveBeenCalledOnce());

    expect(report).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'stale-workout-choice', choice: 'discard' }),
    );
    expect(screen.getByTestId('location-probe')).toHaveTextContent('/');
    expect(screen.getByRole('button', { name: 'Reprendre la séance' })).toBeInTheDocument();
  });

  it('reports discard only after the confirmed repository write succeeds', async () => {
    const workout = await createActiveWorkout(true);
    const gate = deferred<void>();
    const realDiscard = workoutsRepository.discardWorkout;
    vi.spyOn(workoutsRepository, 'discardWorkout').mockImplementation(async (workoutId) => {
      await gate.promise;
      return realDiscard(workoutId);
    });
    const report = vi.fn();
    renderBar({ report });

    await userEvent.click(await screen.findByRole('button', { name: /Poussée/ }));
    const discard = screen.getByRole('button', { name: 'Abandonner la séance' });
    await waitFor(() => expect(discard).toBeEnabled());
    await userEvent.click(discard);
    await userEvent.click(screen.getByRole('button', { name: 'Confirmer l’abandon' }));

    expect(report).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'stale-workout-choice', choice: 'discard' }),
    );
    expect((await db.workouts.get(workout.id))?.deletedAt).toBe(0);

    gate.resolve();
    await waitFor(() =>
      expect(report).toHaveBeenCalledWith({
        type: 'stale-workout-choice',
        workoutId: workout.id,
        choice: 'discard',
      }),
    );
    expect((await db.workouts.get(workout.id))?.deletedAt).toBeGreaterThan(0);
  });

  it('never discards from an effect or timeout', async () => {
    await createActiveWorkout(true);
    const discard = vi.spyOn(workoutsRepository, 'discardWorkout');
    renderBar();

    await userEvent.click(await screen.findByRole('button', { name: /Poussée/ }));
    vi.useFakeTimers();
    act(() => vi.advanceTimersByTime(7 * 24 * 60 * 60 * 1_000));
    vi.useRealTimers();

    expect(discard).not.toHaveBeenCalled();
  });
});
