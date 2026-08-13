import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import * as bodyMeasurements from '@/data/repositories/bodyMeasurements';
import type { WeeklyRegularity } from '@/lib/history';
import { resetDb } from '@/test/resetDb';
import { HomeStatsIsland } from './HomeStatsIsland';

const regularity = (over: Partial<WeeklyRegularity> = {}): WeeklyRegularity => ({
  currentCompleted: 2,
  currentGoal: null,
  streak: 0,
  ...over,
});

function renderIsland(value: WeeklyRegularity = regularity()) {
  return render(
    <MemoryRouter>
      <HomeStatsIsland regularity={value} />
    </MemoryRouter>,
  );
}

describe('HomeStatsIsland', () => {
  beforeEach(resetDb);

  it('reads the week as a bare count with no goal set', async () => {
    renderIsland();

    expect(await screen.findByText('2')).toBeInTheDocument();
    expect(screen.getByText('cette semaine')).toBeInTheDocument();
  });

  it('reads the week against the goal, and never as a streak of weeks', async () => {
    renderIsland(regularity({ currentGoal: 4, streak: 3 }));

    expect(await screen.findByText('2 / 4')).toBeInTheDocument();
    expect(screen.queryByText('3')).not.toBeInTheDocument();
    expect(screen.queryByText(/d’affil/)).not.toBeInTheDocument();
  });

  it('carries the latest weight on its tile, with no entry field on the screen', async () => {
    await bodyMeasurements.saveBodyWeight(82.4, Date.now());
    renderIsland();

    expect(await screen.findByText('82,4')).toBeInTheDocument();
    expect(screen.queryByLabelText('Poids du corps')).not.toBeInTheDocument();
  });

  it('opens the weigh-in sheet on the tile, and it has no steppers', async () => {
    const user = userEvent.setup();
    renderIsland();

    await user.click(await screen.findByRole('button', { name: 'Renseigner le poids du jour' }));

    expect(await screen.findByLabelText('Poids du corps')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Augmenter' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Diminuer' })).not.toBeInTheDocument();
  });
});
