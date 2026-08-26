import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { WikiProgrammingScreen } from './WikiProgrammingScreen';

function renderScreen() {
  render(
    <MemoryRouter>
      <WikiProgrammingScreen />
    </MemoryRouter>,
  );
}

describe('WikiProgrammingScreen', () => {
  it('liste les articles du Guide et mène à leur page de lecture', () => {
    renderScreen();

    const volume = screen.getByRole('link', { name: /Volume/u });
    expect(volume).toHaveAttribute('href', '/knowledge/programmation/programming-volume');
    expect(screen.getByText('19 articles')).toBeVisible();
  });

  it('conserve le bandeau « non relu » tant qu’aucune fiche n’a été vérifiée', () => {
    renderScreen();

    expect(screen.getByText('Non relu')).toBeVisible();
    expect(screen.getByText(/personne ne les a encore vérifiées une par une/u)).toBeVisible();
  });

  it('n’affiche plus les lignes brutes du tableau source', () => {
    renderScreen();

    // Le Guide entre par un sujet, plus par un tableau. Les 102 fiches ne sont
    // pas perdues — elles sont citées champ par champ dans les articles — mais
    // un identifiant `cand.e1.*` n'a rien à faire sur un sommaire.
    expect(screen.queryByText(/cand\.e1\./u)).toBeNull();
  });
});
