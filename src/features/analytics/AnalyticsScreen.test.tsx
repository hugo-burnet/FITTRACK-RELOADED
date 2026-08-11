import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { newEntity } from '@/data/repositories/base';
import type { Workout } from '@/data/types';
import { HomeProgressLinks } from '@/features/home/HomeProgressLinks';
import { resetDb } from '@/test/resetDb';
import { AnalyticsScreen } from './AnalyticsScreen';

describe('AnalyticsScreen', () => {
  beforeEach(resetDb);

  it('place Records en premier dans la vue d’ensemble sans ajouter un quatrième raccourci Accueil', async () => {
    await db.workouts.add(
      newEntity<Workout>({
        routineId: '',
        name: 'Upper A',
        status: 'completed',
        startedAt: Date.UTC(2026, 6, 10),
        endedAt: Date.UTC(2026, 6, 10, 1),
        durationSeconds: 3_600,
      }),
    );

    const { unmount } = render(
      <MemoryRouter>
        <AnalyticsScreen />
      </MemoryRouter>,
    );

    const overview = (await screen.findByText('Vue d’ensemble')).parentElement;
    expect(overview).not.toBeNull();
    const rows = within(overview!).getAllByRole('button');
    expect(rows.map((row) => row.querySelector('span > span')?.textContent)).toEqual([
      'Records',
      'Séances par semaine',
      'Volume d’entraînement',
      'Séries par muscle',
    ]);

    unmount();
    render(
      <MemoryRouter>
        <HomeProgressLinks />
      </MemoryRouter>,
    );
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });
});
