import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { HomeBodyCard } from './HomeBodyCard';

/** Piloté par le test : le vrai dessin lit douze semaines d'historique. */
let drawn = true;

vi.mock('./HomeMuscleMap', () => ({
  HomeMuscleMap: ({ onResolved }: { onResolved: (value: boolean) => void }) => {
    // Dans un effet, comme le vrai : prévenir pendant le rendu écrirait dans
    // l'état d'un composant en train d'en rendre un autre.
    useEffect(() => onResolved(drawn), [onResolved]);
    return drawn ? <p>corps</p> : null;
  },
}));

function renderCard(value: boolean) {
  drawn = value;
  return render(
    <MemoryRouter>
      <HomeBodyCard />
    </MemoryRouter>,
  );
}

describe('HomeBodyCard', () => {
  it('porte ses trois analyses sous le dessin', async () => {
    renderCard(true);

    expect(await screen.findByText('corps')).toBeVisible();
    // Le nom accessible est celui de l'écran visé, pas le mot du bouton.
    expect(screen.getByRole('button', { name: 'Séances par semaine' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Volume d’entraînement' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Séries par muscle' })).toBeVisible();
  });

  it('s’en va entièrement quand le dessin n’a rien à montrer', async () => {
    renderCard(false);

    // Ni le dessin ni les liens : trois boutons seuls sous le titre de l'écran
    // se lisaient comme une barre d'onglets égarée, et menaient à des analyses
    // vides.
    await waitFor(() => expect(screen.queryByRole('button')).not.toBeInTheDocument());
    expect(screen.queryByText('corps')).not.toBeInTheDocument();
  });
});
