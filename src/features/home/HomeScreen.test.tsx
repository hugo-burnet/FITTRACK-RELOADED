import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { HomeScreen } from './HomeScreen';

vi.mock('dexie-react-hooks', () => ({ useLiveQuery: () => null }));

vi.mock('./useHomeDashboard', () => ({
  useHomeDashboard: () => ({
    status: 'ready',
    data: {
      activeProgram: null,
      suggestedRoutine: null,
      routineCount: 0,
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
  HomeSuggestionCard: () => <div>Routine suggérée</div>,
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
    expect(screen.getByText('Routine suggérée')).toBeVisible();
  });
});
