import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { newEntity } from '@/data/repositories/base';
import type { Workout } from '@/data/types';
import { resetDb } from '@/test/resetDb';
import { WeeklyVolumeScreen } from './WeeklyVolumeScreen';

const archivedWorkout = (startedAt: number): Workout =>
  newEntity<Workout>({
    routineId: '',
    name: 'Upper A',
    status: 'completed',
    startedAt,
    endedAt: startedAt + 3_600_000,
    durationSeconds: 3_600,
    startedTimezoneOffsetMinutes: -new Date(startedAt).getTimezoneOffset(),
  });

const renderScreen = () =>
  render(
    <MemoryRouter>
      <WeeklyVolumeScreen />
    </MemoryRouter>,
  );

describe('WeeklyVolumeScreen', () => {
  beforeEach(resetDb);

  it('reste en chargement sans annoncer un faux état vide à la première lecture', () => {
    const { container } = renderScreen();

    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    expect(screen.queryByText('Aucune séance sur cette période.')).toBeNull();
  });

  it('affiche l’état vide quand l’historique précède une période sans séance', async () => {
    await db.workouts.add(archivedWorkout(Date.UTC(2020, 0, 6, 18)));

    const { container } = renderScreen();

    await waitFor(() =>
      expect(container.querySelector('[aria-busy="false"]')).toBeInTheDocument(),
    );
    expect(screen.getByText('Aucune séance sur cette période.')).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('inclut l’année dans chaque semaine pour que Tout reste non ambigu', async () => {
    const startedAt = Date.now() - 7 * 24 * 60 * 60 * 1_000;
    await db.workouts.add(archivedWorkout(startedAt));

    renderScreen();

    const year = new Date(startedAt).getFullYear().toString();
    expect(await screen.findAllByText(new RegExp(`Semaine du .* ${year}`))).not.toHaveLength(0);
  });
});
