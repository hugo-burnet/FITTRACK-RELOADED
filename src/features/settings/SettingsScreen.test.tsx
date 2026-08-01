import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/data/db';
import { newEntity } from '@/data/repositories/base';
import type { Exercise, Workout, WorkoutExercise, WorkoutSet } from '@/data/types';
import { resetDb } from '@/test/resetDb';
import { SettingsScreen } from './SettingsScreen';

async function seedCompletedWorkout(name: string, startedAt: number): Promise<void> {
  const exercise = newEntity<Exercise>({
    name: 'Développé couché',
    primaryMuscle: 'chest',
    secondaryMuscles: [],
    equipment: 'barbell',
    measurementType: 'weight_reps',
    isCustom: 0,
    isUnilateral: 0,
  });
  const workout = newEntity<Workout>({
    routineId: '',
    name,
    status: 'completed',
    startedAt,
    endedAt: startedAt + 3_600_000,
    durationSeconds: 3600,
    startedTimezoneOffsetMinutes: 120,
  });
  const row = newEntity<WorkoutExercise>({
    workoutId: workout.id,
    exerciseId: exercise.id,
    order: 0,
    supersetGroup: 0,
    restSeconds: 120,
    exerciseName: exercise.name,
    exerciseMeasurementType: exercise.measurementType,
    exercisePrimaryMuscle: exercise.primaryMuscle,
    exerciseEquipment: exercise.equipment,
  });
  const set = newEntity<WorkoutSet>({
    workoutExerciseId: row.id,
    exerciseId: exercise.id,
    workoutId: workout.id,
    order: 0,
    setType: 'normal',
    side: 'both',
    weight: 80,
    reps: 10,
    isCompleted: 1,
    performedAt: startedAt + 60_000,
  });

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
}

function installShare(world: { share?: unknown; clipboard?: unknown }) {
  Object.defineProperty(navigator, 'share', {
    value: world.share,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(navigator, 'clipboard', {
    value: world.clipboard,
    configurable: true,
    writable: true,
  });
}

function renderSettings() {
  render(
    <MemoryRouter>
      <SettingsScreen />
    </MemoryRouter>,
  );
}

const exportAction = () => screen.findByRole('button', { name: /Exporter tout l’historique/ });

describe('SettingsScreen — export de l’historique', () => {
  beforeEach(resetDb);
  afterEach(() => installShare({ share: undefined, clipboard: undefined }));

  it('shares every completed workout in one Markdown document', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    installShare({ share, clipboard: { writeText: vi.fn() } });
    await seedCompletedWorkout('Upper A', Date.UTC(2026, 6, 27, 16));
    await seedCompletedWorkout('Lower B', Date.UTC(2026, 6, 29, 16));
    renderSettings();

    const action = await exportAction();
    await waitFor(() => expect(action).toBeEnabled());
    await userEvent.click(action);

    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const payload = share.mock.calls[0]?.[0] as { title: string; text: string };
    expect(payload.title).toBe('FitTrack — historique complet');
    expect(payload.text).toContain('Périmètre : tout l’historique');
    expect(payload.text).toContain('Upper A');
    expect(payload.text).toContain('Lower B');
  });

  it('disables the action when history is empty', async () => {
    renderSettings();

    expect(await exportAction()).toBeDisabled();
  });

  it('confirms the clipboard fallback with history-specific copy', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    installShare({ share: undefined, clipboard: { writeText } });
    await seedCompletedWorkout('Upper A', Date.UTC(2026, 6, 27, 16));
    renderSettings();

    const action = await exportAction();
    await waitFor(() => expect(action).toBeEnabled());
    await userEvent.click(action);

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Historique copié dans le presse-papiers.',
    );
    expect(writeText).toHaveBeenCalledTimes(1);
  });

  it('announces when sharing and copying are both unavailable', async () => {
    installShare({ share: undefined, clipboard: undefined });
    await seedCompletedWorkout('Upper A', Date.UTC(2026, 6, 27, 16));
    renderSettings();

    const action = await exportAction();
    await waitFor(() => expect(action).toBeEnabled());
    await userEvent.click(action);

    expect(await screen.findByRole('status')).toHaveTextContent(
      'L’historique n’a pas pu être partagé ni copié.',
    );
  });
});
