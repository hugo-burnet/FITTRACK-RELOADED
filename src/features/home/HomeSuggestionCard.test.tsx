import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { HomeDashboardData, SuggestedRoutine } from '@/data/repositories/home';
import { HomeSuggestionCard } from './HomeSuggestionCard';

const suggestion: SuggestedRoutine = {
  routineId: 'push-a',
  name: 'Poussée A',
  exerciseCount: 4,
  setCount: 12,
  lastPerformedAt: null,
};

const options: HomeDashboardData['routineContext']['options'] = [
  { value: 'folder:push', label: 'Salle', routineCount: 1 },
  { value: 'folder:empty', label: 'Maison', routineCount: 0 },
  { value: 'root', label: 'Sans dossier', routineCount: 2 },
];

function context(
  over: Partial<HomeDashboardData['routineContext']> = {},
): HomeDashboardData['routineContext'] {
  return {
    required: false,
    selected: 'folder:push',
    options,
    ...over,
  };
}

function renderCard(
  props: Partial<React.ComponentProps<typeof HomeSuggestionCard>> = {},
) {
  return render(
    <MemoryRouter>
      <HomeSuggestionCard
        suggestion={suggestion}
        routineCount={3}
        disabled={false}
        routineContext={context()}
        {...props}
      />
    </MemoryRouter>,
  );
}

describe('HomeSuggestionCard routine folder context', () => {
  it('opens the required picker on first render without reopening it after dismissal', async () => {
    const user = userEvent.setup();
    const routineContext = context({ required: true, selected: null });
    const view = renderCard({ suggestion: null, routineContext });

    const dialog = await screen.findByRole('dialog', { name: 'Choisir un dossier' });
    const closeButtons = screen.getAllByRole('button', { name: 'Fermer' });
    await user.click(closeButtons.at(-1)!);
    fireEvent.transitionEnd(dialog);

    expect(screen.queryByRole('dialog', { name: 'Choisir un dossier' })).not.toBeInTheDocument();

    view.rerender(
      <MemoryRouter>
        <HomeSuggestionCard
          suggestion={null}
          routineCount={3}
          disabled={false}
          routineContext={routineContext}
        />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('dialog', { name: 'Choisir un dossier' })).not.toBeInTheDocument();
  });

  it('shows the selected context and opens its change action', async () => {
    const user = userEvent.setup();
    renderCard();

    expect(screen.getByText('Salle')).toBeVisible();
    const change = screen.getByRole('button', { name: 'Changer de dossier' });
    expect(change).toHaveClass('size-12');

    await user.click(change);

    expect(await screen.findByRole('dialog', { name: 'Choisir un dossier' })).toBeVisible();
  });

  it('explains an empty selected folder and keeps the change action', () => {
    renderCard({
      suggestion: null,
      routineContext: context({ selected: 'folder:empty' }),
    });

    expect(screen.getByText('Maison')).toBeVisible();
    expect(screen.getByText('Aucune routine dans ce dossier.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Changer de dossier' })).toBeVisible();
    expect(screen.queryByText(/Aucune routine pour l’instant/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Créer une routine' })).not.toBeInTheDocument();
  });

  it('does not offer a folder change when there are no folders', () => {
    renderCard({
      suggestion: null,
      routineCount: 0,
      routineContext: context({ required: false, selected: null, options: [] }),
    });

    expect(screen.getByText(/Aucune routine pour l’instant/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Changer de dossier' })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Choisir un dossier' })).not.toBeInTheDocument();
  });
});
