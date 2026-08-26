import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { TutorialContext } from '@/features/tutorial/tutorialContext';
import { KnowledgeScreen } from './KnowledgeScreen';

function renderScreen() {
  render(
    <TutorialContext.Provider
      value={{ openHelp: vi.fn(), startMission: vi.fn(), offerMission: vi.fn(), report: vi.fn() }}
    >
      <MemoryRouter>
        <KnowledgeScreen />
      </MemoryRouter>
    </TutorialContext.Provider>,
  );
}

describe('KnowledgeScreen', () => {
  it('n’affiche pas l’aide contextuelle du tutoriel', () => {
    renderScreen();

    expect(screen.queryByRole('button', { name: 'Aide sur cette page' })).not.toBeInTheDocument();
  });

  it('présente l’outil comme un navigateur non calibré, jamais comme un coach', () => {
    renderScreen();

    expect(screen.getByText('Extraits seulement')).toBeVisible();
    expect(screen.getByText(/Aucun seuil de réponse sûre n’est encore validé/)).toBeVisible();
  });

  it('refuse quand aucune preuve lexicale n’est retrouvée', async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.type(screen.getByRole('searchbox', { name: 'Ta question' }), 'quasar zirconium');
    await user.click(screen.getByRole('button', { name: 'Chercher dans les preuves' }));

    expect(await screen.findByText('Aucune preuve lexicale retrouvée')).toBeVisible();
  });

  it('rend la citation exacte et ses coordonnées de provenance', async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.type(
      screen.getByRole('searchbox', { name: 'Ta question' }),
      'amplitude EMG hypertrophie',
    );
    await user.click(screen.getByRole('button', { name: 'Chercher dans les preuves' }));

    expect(await screen.findByText('Passages retrouvés')).toBeVisible();
    // L'ancrage est la promesse de l'écran : un passage sans coordonnées de
    // source n'est plus une preuve, c'est une affirmation.
    expect(screen.getAllByText(/^claim\.[a-f0-9]{16}/u)[0]).toBeVisible();
  });

  it('ne répète la citation que lorsqu’elle dépasse le contexte affiché', async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.type(
      screen.getByRole('searchbox', { name: 'Ta question' }),
      'amplitude EMG hypertrophie',
    );
    await user.click(screen.getByRole('button', { name: 'Chercher dans les preuves' }));
    await screen.findByText('Passages retrouvés');

    // Le contexte contient presque toujours la citation. La montrer deux fois
    // doublait la hauteur des cartes : sur une question réelle posée depuis le
    // téléphone, les huit cartes répétaient leur propre texte.
    for (const label of screen.queryAllByText('Citation exacte')) {
      const card = label.closest('article');
      const quote = card?.querySelector('q')?.textContent ?? '';
      const context = card?.querySelector('blockquote')?.textContent ?? '';
      expect(context, 'une citation répétée doit ajouter du texte').not.toContain(quote);
    }
  });
});
