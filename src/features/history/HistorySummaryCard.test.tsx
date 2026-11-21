import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { HistorySummaryCard } from './HistorySummaryCard';

describe('HistorySummaryCard', () => {
  it('avec un objectif : deux tuiles S, la série puis l’objectif, qui s’ouvre au toucher', async () => {
    const user = userEvent.setup();
    const onEditGoal = vi.fn();
    render(
      <HistorySummaryCard
        regularity={{ currentCompleted: 2, currentGoal: 4, streak: 3 }}
        onEditGoal={onEditGoal}
      />,
    );

    const region = screen.getByRole('region', { name: 'Régularité' });
    const tiles = region.querySelectorAll('[data-part="tile"]');
    expect(Array.from(tiles).map((tile) => tile.getAttribute('data-size'))).toEqual(['S', 'S']);
    expect(region.textContent).toContain('Semaines tenues');

    await user.click(screen.getByRole('button', { name: /Objectif hebdo 2 séances sur 4/ }));
    expect(onEditGoal).toHaveBeenCalledTimes(1);
  });

  it('au singulier, une semaine tenue', () => {
    render(
      <HistorySummaryCard
        regularity={{ currentCompleted: 0, currentGoal: 3, streak: 1 }}
        onEditGoal={() => undefined}
      />,
    );
    expect(screen.getByText('Semaine tenue')).toBeVisible();
  });

  it('sans objectif : une seule tuile L qui invite à le choisir, sans mot posé à la place d’un chiffre', async () => {
    const user = userEvent.setup();
    const onEditGoal = vi.fn();
    render(
      <HistorySummaryCard
        regularity={{ currentCompleted: 1, currentGoal: null, streak: 0 }}
        onEditGoal={onEditGoal}
      />,
    );

    const region = screen.getByRole('region', { name: 'Régularité' });
    const tiles = region.querySelectorAll('[data-part="tile"]');
    expect(Array.from(tiles).map((tile) => tile.getAttribute('data-size'))).toEqual(['L']);
    expect(region.textContent).toContain('Choisis ton rythme');
    expect(region.textContent).not.toContain('Définir');

    await user.click(screen.getByRole('button', { name: /Objectif hebdo/ }));
    expect(onEditGoal).toHaveBeenCalledTimes(1);
  });
});
