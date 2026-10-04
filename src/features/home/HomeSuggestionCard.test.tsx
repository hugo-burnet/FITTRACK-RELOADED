import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { HomeDashboardData, SuggestedRoutine } from '@/data/repositories/home';
import { t } from '@/i18n/fr';
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
  { value: 'root', routineCount: 2 },
];

function context(
  over: Partial<HomeDashboardData['routineContext']> = {},
): HomeDashboardData['routineContext'] {
  return {
    required: false,
    selected: ['folder:push'],
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
    const routineContext = context({ required: true, selected: [] });
    const view = renderCard({ suggestion: null, routineContext });

    const dialog = await screen.findByRole('dialog', { name: 'Choisir les dossiers' });
    const closeButtons = screen.getAllByRole('button', { name: 'Fermer' });
    await user.click(closeButtons.at(-1)!);
    fireEvent.transitionEnd(dialog);

    expect(screen.queryByRole('dialog', { name: 'Choisir les dossiers' })).not.toBeInTheDocument();

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

    expect(screen.queryByRole('dialog', { name: 'Choisir les dossiers' })).not.toBeInTheDocument();
  });

  it('opens the picker for a new required context after a dismissal', async () => {
    const user = userEvent.setup();
    const requiredContext = context({ required: true, selected: [] });
    const view = renderCard({ suggestion: null, routineContext: requiredContext });

    const dialog = await screen.findByRole('dialog', { name: 'Choisir les dossiers' });
    await user.click(screen.getAllByRole('button', { name: 'Fermer' }).at(-1)!);
    fireEvent.transitionEnd(dialog);

    view.rerender(
      <MemoryRouter>
        <HomeSuggestionCard
          suggestion={null}
          routineCount={3}
          disabled={false}
          routineContext={context({
            required: true,
            selected: [],
            options: [
              ...options,
              { value: 'folder:pull', label: 'Bureau', routineCount: 1 },
            ],
          })}
        />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('dialog', { name: 'Choisir les dossiers' })).toBeVisible();
  });

  it('shows the selected context and opens its change action', async () => {
    const user = userEvent.setup();
    renderCard();

    expect(screen.getByText('Salle')).toBeVisible();
    const change = screen.getByRole('button', { name: 'Changer de dossier' });
    expect(change).toHaveClass('size-12');

    await user.click(change);

    expect(await screen.findByRole('dialog', { name: 'Choisir les dossiers' })).toBeVisible();
  });

  it('renders the selected root context from the home dictionary', () => {
    renderCard({ routineContext: context({ selected: ['root'] }) });

    expect(screen.getByText(t('home.rootRoutineFolder'))).toBeVisible();
  });

  it('explains an empty selected folder and keeps the change action', () => {
    renderCard({
      suggestion: null,
      routineContext: context({ selected: ['folder:empty'] }),
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
      routineContext: context({ required: false, selected: [], options: [] }),
    });

    expect(screen.getByText(/Aucune routine pour l’instant/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Changer de dossier' })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Choisir les dossiers' })).not.toBeInTheDocument();
  });

  it('names every followed folder and says the suggestion spans all of them', () => {
    renderCard({ routineContext: context({ selected: ['folder:push', 'root'] }) });

    expect(screen.getByText('Salle + Sans dossier')).toBeVisible();
    expect(screen.getByText(t('home.suggestionRuleFolders'))).toBeVisible();
    expect(screen.queryByText(t('home.suggestionRule'))).not.toBeInTheDocument();
  });

  it('keeps the plain rule when a single folder is followed', () => {
    renderCard();

    expect(screen.getByText(t('home.suggestionRule'))).toBeVisible();
    expect(screen.queryByText(t('home.suggestionRuleFolders'))).not.toBeInTheDocument();
  });

  it('says several folders are empty only when every followed folder is', () => {
    const twoEmpty: HomeDashboardData['routineContext']['options'] = [
      { value: 'folder:a', label: 'Maison', routineCount: 0 },
      { value: 'folder:b', label: 'Bureau', routineCount: 0 },
    ];
    renderCard({
      suggestion: null,
      routineContext: context({ selected: ['folder:a', 'folder:b'], options: twoEmpty }),
    });

    expect(screen.getByText('Maison + Bureau')).toBeVisible();
    expect(screen.getByText('Aucune routine dans ces dossiers.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Changer de dossier' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Créer une routine' })).not.toBeInTheDocument();
  });

  it('opens the picker on the saved selection', async () => {
    const user = userEvent.setup();
    renderCard({ routineContext: context({ selected: ['folder:push', 'root'] }) });

    await user.click(screen.getByRole('button', { name: 'Changer de dossier' }));

    expect(await screen.findByRole('checkbox', { name: 'Salle' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('checkbox', { name: t('home.rootRoutineFolder') })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('checkbox', { name: 'Maison' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });
});
