import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { HomeDashboardData } from '@/data/repositories/home';
import { HomeScreen } from './HomeScreen';

vi.mock('dexie-react-hooks', () => ({ useLiveQuery: () => null }));

vi.mock('./useHomeDashboard', () => ({
  useHomeDashboard: () => ({
    status: 'ready',
    data: {
      activeProgram: null,
      suggestedRoutine: null,
      routineCount: 0,
      routineContext: {
        required: true,
        selected: null,
        options: [{ value: 'folder:push', label: 'Salle', routineCount: 2 }],
      },
      recentWorkouts: [],
    },
    regularity: {},
  }),
}));

vi.mock('./HomeBodyCard', () => ({ HomeBodyCard: () => <div>Corps</div> }));
vi.mock('./HomeProgramsRow', () => ({ HomeProgramsRow: () => <div>Programmes</div> }));
vi.mock('./HomeRecentWorkouts', () => ({ HomeRecentWorkouts: () => <div>Historique</div> }));
vi.mock('./HomeStatsIsland', () => ({ HomeStatsIsland: () => <div>Statistiques</div> }));
vi.mock('./HomeSuggestionCard', () => ({
  HomeSuggestionCard: ({
    routineContext,
  }: {
    routineContext: HomeDashboardData['routineContext'];
  }) => <div>Contexte accueil : {routineContext.options[0]?.label}</div>,
}));

describe('HomeScreen', () => {
  it('ne propose plus de démarrer une séance vide', () => {
    render(
      <MemoryRouter>
        <HomeScreen />
      </MemoryRouter>,
    );

    expect(
      screen.queryByRole('button', { name: 'Démarrer une séance libre' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Contexte accueil : Salle')).toBeVisible();
  });
});
