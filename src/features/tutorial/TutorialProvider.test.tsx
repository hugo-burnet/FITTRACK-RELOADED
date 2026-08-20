import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Screen } from '@/app/Screen';
import { ANNOUNCER_STORAGE_KEY } from '@/stores/announcer';
import { useRepPacer } from '@/stores/repPacer';
import { useRestTimer } from '@/stores/restTimer';
import { TUTORIAL_STORAGE_KEY } from './tutorialStore';
import { TutorialProvider } from './TutorialProvider';

const { playTutorialNarrationMock, stopTutorialNarrationMock } = vi.hoisted(() => ({
  playTutorialNarrationMock: vi.fn().mockResolvedValue(true),
  stopTutorialNarrationMock: vi.fn(),
}));

vi.mock('./tutorialNarration', () => ({
  playTutorialNarration: playTutorialNarrationMock,
  stopTutorialNarration: stopTutorialNarrationMock,
}));

function renderTutorial(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TutorialProvider>
        <Screen title="Écran de test">
          <p>Contenu réel</p>
        </Screen>
      </TutorialProvider>
    </MemoryRouter>,
  );
}

describe('TutorialProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    playTutorialNarrationMock.mockClear();
    stopTutorialNarrationMock.mockClear();
    useRepPacer.getState().stop();
    useRestTimer.getState().stop();
  });

  it('propose la visite au premier lancement puis conserve le choix audio', async () => {
    const user = userEvent.setup();
    renderTutorial();

    expect(await screen.findByRole('dialog', { name: 'Visite guidée' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Passer' }));
    expect(await screen.findByRole('dialog', { name: 'Guidage vocal' })).toBeVisible();

    await user.click(screen.getByRole('button', { name: /Sons uniquement/ }));
    expect(localStorage.getItem(TUTORIAL_STORAGE_KEY)).toBe('skipped');
    expect(localStorage.getItem(ANNOUNCER_STORAGE_KEY)).toBe('sounds');
  });

  it('ouvre depuis le point d’interrogation le tutoriel de la page courante', async () => {
    localStorage.setItem(TUTORIAL_STORAGE_KEY, 'completed');
    const user = userEvent.setup();
    renderTutorial('/analytics/records');

    await user.click(screen.getByRole('button', { name: 'Aide sur cette page' }));
    expect(await screen.findByRole('dialog', { name: 'Aide' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: /Expliquer cette page · Progression/ }));

    expect(await screen.findByRole('dialog', { name: 'Visite guidée' })).toBeVisible();
    expect(screen.getByText('Progression')).toBeVisible();
    expect(screen.getByText(/Suis tes records/)).toBeVisible();
  });

  it('replie automatiquement la transcription pendant la narration', async () => {
    localStorage.setItem(TUTORIAL_STORAGE_KEY, 'completed');
    const user = userEvent.setup();
    renderTutorial('/routines');

    await user.click(screen.getByRole('button', { name: 'Aide sur cette page' }));
    await user.click(screen.getByRole('button', { name: /Expliquer cette page/ }));

    expect(await screen.findByRole('button', { name: 'Réduire' })).toBeVisible();
    expect(
      await screen.findByRole('button', { name: 'Lire le texte' }, { timeout: 3_000 }),
    ).toHaveAttribute('aria-expanded', 'false');
  });

  it('laisse ouvrir l’aide quand le chrono conservé dans le store est déjà fini', async () => {
    localStorage.setItem(TUTORIAL_STORAGE_KEY, 'completed');
    useRestTimer.setState({
      setId: 'ancienne-serie',
      startedAt: Date.now() - 60_000,
      endsAt: Date.now() - 1_000,
      seconds: 59,
    });
    const user = userEvent.setup();
    renderTutorial('/routines');

    await user.click(screen.getByRole('button', { name: 'Aide sur cette page' }));

    expect(screen.getByRole('button', { name: /Expliquer cette page/ })).toBeEnabled();
    expect(screen.getByText('Environ vingt secondes.')).toBeVisible();
  });
});
