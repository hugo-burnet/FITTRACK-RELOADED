import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const historyRepository = vi.hoisted(() => ({
  inspect: vi.fn(),
  update: vi.fn(),
}));

vi.mock('@/data/repositories/historyRepair', () => ({
  inspectHistoryResnapshot: historyRepository.inspect,
  resnapshotHistory: historyRepository.update,
}));

import { HistoryUpdateAction } from './HistoryUpdateAction';

describe('HistoryUpdateAction', () => {
  beforeEach(() => {
    historyRepository.inspect.mockReset();
    historyRepository.update.mockReset();
  });

  it('analyse les changements avant de proposer leur application', async () => {
    historyRepository.inspect.mockResolvedValue({
      changed: 14,
      muscles: 9,
      names: 3,
      equipment: 2,
      measurements: 1,
    });
    historyRepository.update.mockResolvedValue({ repaired: 14, kept: 4 });
    const user = userEvent.setup();
    render(<HistoryUpdateAction />);

    expect(await screen.findByText('14 exercices de séance à mettre à jour')).toBeVisible();
    expect(
      screen.getByText('Muscles : 9 · noms : 3 · matériels : 2 · types de mesure : 1'),
    ).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Appliquer les mises à jour' }));
    expect(screen.getByText(/14 exercices de séance reprendront/)).toBeVisible();
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Appliquer les mises à jour',
      }),
    );

    expect(await screen.findByRole('status')).toHaveTextContent(
      '14 exercices de séance mis à jour.',
    );
  });

  it('désactive l’action quand l’historique est déjà à jour', async () => {
    historyRepository.inspect.mockResolvedValue({
      changed: 0,
      muscles: 0,
      names: 0,
      equipment: 0,
      measurements: 0,
    });
    render(<HistoryUpdateAction />);

    expect(await screen.findByText('Historique déjà à jour')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Appliquer les mises à jour' })).toBeDisabled();
  });
});
