import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { newEntity } from '@/data/repositories/base';
import type { Workout } from '@/data/types';
import { HomeBodyCard } from '@/features/home/HomeBodyCard';
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
    await screen.findByRole('button', { name: /Séances par semaine/ });
    const rows = within(overview!).getAllByRole('button');
    expect(rows.map((row) => row.querySelector('span > span')?.textContent)).toEqual([
      'Records',
      // Les paliers juste sous les records, et comme eux sans condition
      // d'historique : les deux écrans savent dire pourquoi ils sont vides.
      'Paliers',
      'Séances par semaine',
      'Volume d’entraînement',
      'Séries par muscle',
      'Rapport mensuel',
    ]);

    unmount();
    render(
      <MemoryRouter>
        <HomeBodyCard />
      </MemoryRouter>,
    );
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });

  it.each(['empty', 'active-only'] as const)(
    'affiche Records sans les anciennes analyses quand l’historique est %s',
    async (state) => {
      if (state === 'active-only') {
        await db.workouts.add(
          newEntity<Workout>({
            routineId: '',
            name: 'En cours',
            status: 'active',
            startedAt: Date.UTC(2026, 6, 11),
            endedAt: 0,
            durationSeconds: 0,
          }),
        );
      }

      render(
        <MemoryRouter>
          <AnalyticsScreen />
        </MemoryRouter>,
      );

      expect(await screen.findByRole('button', { name: /Records/ })).toBeVisible();
      expect(screen.queryByRole('button', { name: /Séances par semaine/ })).toBeNull();
      expect(screen.queryByRole('button', { name: /Volume d’entraînement/ })).toBeNull();
      expect(screen.queryByRole('button', { name: /Séries par muscle/ })).toBeNull();
    },
  );
});
