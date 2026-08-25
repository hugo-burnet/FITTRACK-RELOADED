import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { KnowledgeScreen } from './KnowledgeScreen';

function renderScreen() {
  render(
    <MemoryRouter>
      <KnowledgeScreen />
    </MemoryRouter>,
  );
}

describe('KnowledgeScreen', () => {
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

    expect((await screen.findAllByText('Citation exacte')).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^claim\.[a-f0-9]{16}/u)[0]).toBeVisible();
  });
});
