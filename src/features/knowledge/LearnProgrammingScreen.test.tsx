import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TutorialContext } from '@/features/tutorial/tutorialContext';
import { LearnProgrammingScreen } from './LearnProgrammingScreen';

function renderScreen() {
  render(
    <TutorialContext.Provider
      value={{ openHelp: vi.fn(), startMission: vi.fn(), offerMission: vi.fn(), report: vi.fn() }}
    >
      <MemoryRouter>
        <LearnProgrammingScreen />
      </MemoryRouter>
    </TutorialContext.Provider>,
  );
}

describe('LearnProgrammingScreen', () => {
  beforeEach(() => localStorage.clear());

  /*
   * Ce que `KnowledgeScreenFrame` protège encore. Le hub `/knowledge` a repris
   * l'aide contextuelle — c'est la porte de ses missions — mais les surfaces où
   * l'on lit le corpus n'en ont toujours pas : une mission s'y poursuit, elle
   * ne s'y choisit pas.
   */
  it('ne propose pas l’aide contextuelle sur une surface de lecture', () => {
    renderScreen();

    expect(screen.queryByRole('button', { name: 'Aide sur cette page' })).not.toBeInTheDocument();
  });

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
