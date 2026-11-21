import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { LearnProgrammingScreen } from './LearnProgrammingScreen';

function renderScreen() {
  render(
    <MemoryRouter>
      <LearnProgrammingScreen />
    </MemoryRouter>,
  );
}

describe('LearnProgrammingScreen', () => {
  beforeEach(() => localStorage.clear());

  it('ouvre sur la progression, pas sur le premier chapitre du document source', () => {
    renderScreen();

    const steps = screen.getAllByRole('listitem');
    expect(within(steps[0]!).getByRole('heading')).toHaveTextContent(
      'Progression et autorégulation',
    );
  });

  it('mène à l’article réel de chaque étape', () => {
    renderScreen();

    const volume = screen
      .getAllByRole('link', { name: 'Lire cette étape' })
      .map((link) => link.getAttribute('href'));
    expect(volume).toContain('/knowledge/programmation/programming-volume');
    expect(volume).toContain('/knowledge/a/clinical-red-flags');
  });

  it('compte les étapes lues et s’en souvient', async () => {
    const user = userEvent.setup();
    renderScreen();

    expect(screen.getByText('0/14 lues')).toBeVisible();

    await user.click(
      screen.getByRole('switch', { name: 'Marquer « Progression et autorégulation » comme lu' }),
    );

    expect(screen.getByText('1/14 lues')).toBeVisible();
    expect(localStorage.getItem('fittrack:learnProgramming')).toContain(
      'programming-progression',
    );
  });

  it('dit ce qu’il ne fait pas', () => {
    renderScreen();

    expect(screen.getByText(/ne construit pas ton programme et ne prescrit rien/u)).toBeVisible();
  });
});
