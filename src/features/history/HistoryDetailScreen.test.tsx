import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/data/db';
import { newEntity } from '@/data/repositories/base';
import type { Exercise, Workout, WorkoutExercise, WorkoutSet } from '@/data/types';
import { resetDb } from '@/test/resetDb';
import { HistoryDetailScreen } from './HistoryDetailScreen';

const STARTED_AT = Date.UTC(2026, 6, 27, 16, 20, 0);

async function seedArchivedWorkout(): Promise<Workout> {
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
    name: 'Upper A',
    status: 'completed',
    startedAt: STARTED_AT,
    endedAt: STARTED_AT + 3_600_000,
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
    exerciseMeasurementType: 'weight_reps',
    exercisePrimaryMuscle: 'chest',
    exerciseEquipment: 'barbell',
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
    performedAt: STARTED_AT + 60_000,
  });

  await db.exercises.add(exercise);
  await db.workouts.add(workout);
  await db.workoutExercises.add(row);
  await db.workoutSets.add(set);

  return workout;
}

function install(world: { share?: unknown; clipboard?: unknown }) {
  Object.defineProperty(navigator, 'share', { value: world.share, configurable: true, writable: true });
  Object.defineProperty(navigator, 'clipboard', {
    value: world.clipboard,
    configurable: true,
    writable: true,
  });
}

async function renderDetail(workoutId: string) {
  render(
    <MemoryRouter initialEntries={[`/history/${workoutId}`]}>
      <Routes>
        <Route path="/history/:workoutId" element={<HistoryDetailScreen />} />
        <Route path="/history" element={<p>Journal</p>} />
      </Routes>
    </MemoryRouter>,
  );

  await screen.findByText('Développé couché');
}

const openActions = () =>
  userEvent.click(screen.getByRole('button', { name: 'Actions de la séance' }));

describe('HistoryDetailScreen — partage', () => {
  beforeEach(resetDb);
  afterEach(() => install({ share: undefined, clipboard: undefined }));

  it('propose de partager et de copier la séance', async () => {
    install({ share: vi.fn(), clipboard: { writeText: vi.fn() } });
    const workout = await seedArchivedWorkout();
    await renderDetail(workout.id);

    await openActions();

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Partager' })).toBeEnabled(),
    );
    expect(screen.getByRole('button', { name: 'Copier le texte' })).toBeEnabled();
  });

  it('envoie le Markdown de la séance à la feuille système', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    install({ share, clipboard: { writeText: vi.fn() } });
    const workout = await seedArchivedWorkout();
    await renderDetail(workout.id);

    await openActions();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Partager' })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'Partager' }));

    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const payload = share.mock.calls[0]?.[0] as { title: string; text: string };
    expect(payload.title).toBe('FitTrack — Upper A');
    expect(payload.text).toContain('# Export FitTrack');
    expect(payload.text).toContain('### Développé couché — Pectoraux · Barre');
    expect(payload.text).toContain('| 1 | 80 kg | 10 |');
  });

  it('ne dit rien quand le partage est annulé', async () => {
    const abort = Object.assign(new Error('cancel'), { name: 'AbortError' });
    install({ share: vi.fn().mockRejectedValue(abort), clipboard: { writeText: vi.fn() } });
    const workout = await seedArchivedWorkout();
    await renderDetail(workout.id);

    await openActions();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Partager' })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'Partager' }));

    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
    expect(screen.queryByText(/presse-papiers/)).toBeNull();
  });

  it('confirme la copie, qui ne se voit nulle part ailleurs', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    install({ share: undefined, clipboard: { writeText } });
    const workout = await seedArchivedWorkout();
    await renderDetail(workout.id);

    await openActions();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Copier le texte' })).toBeEnabled(),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Copier le texte' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Séance copiée dans le presse-papiers.',
    );
    expect(writeText.mock.calls[0]?.[0]).toContain('# Export FitTrack');
  });

  it('annonce un échec quand ni le partage ni la copie ne sont possibles', async () => {
    install({ share: undefined, clipboard: undefined });
    const workout = await seedArchivedWorkout();
    await renderDetail(workout.id);

    await openActions();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Partager' })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'Partager' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'La séance n’a pas pu être partagée ni copiée.',
    );
  });
});
