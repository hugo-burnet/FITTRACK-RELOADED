import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Screen } from '@/app/Screen';
import { ANNOUNCER_STORAGE_KEY } from '@/stores/announcer';
import { useRepPacer } from '@/stores/repPacer';
import { useRestTimer } from '@/stores/restTimer';
import {
  createTutorialState,
  LEGACY_TUTORIAL_STORAGE_KEY,
  loadTutorialState,
  saveTutorialState,
  TUTORIAL_STORAGE_KEY,
} from './tutorialStore';
import { TutorialProvider } from './TutorialProvider';

const { getActiveWorkoutMock, playTutorialNarrationMock, stopTutorialNarrationMock } = vi.hoisted(
  () => ({
    getActiveWorkoutMock: vi.fn(),
    playTutorialNarrationMock: vi.fn().mockResolvedValue(true),
    stopTutorialNarrationMock: vi.fn(),
  }),
);

vi.mock('@/data/repositories/workouts', () => ({
  getActiveWorkout: getActiveWorkoutMock,
}));

vi.mock('./tutorialNarration', () => ({
  playTutorialNarration: playTutorialNarrationMock,
  stopTutorialNarration: stopTutorialNarrationMock,
}));

/** L'adresse courante, lisible depuis un test : la visite navigue toute seule. */
function Address() {
  return <p>adresse : {useLocation().pathname}</p>;
}

function renderTutorial(path = '/', strict = false) {
  const tutorial = (
    <MemoryRouter initialEntries={[path]}>
      <TutorialProvider>
        <Screen title="Écran de test">
          <Address />
        </Screen>
      </TutorialProvider>
    </MemoryRouter>
  );
  return render(strict ? <StrictMode>{tutorial}</StrictMode> : tutorial);
}

describe('TutorialProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    getActiveWorkoutMock.mockReset();
    getActiveWorkoutMock.mockResolvedValue(undefined);
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
    expect(JSON.parse(localStorage.getItem(TUTORIAL_STORAGE_KEY) ?? '{}')).toMatchObject({
      version: 2,
      orientation: 'skipped',
    });
    expect(localStorage.getItem(ANNOUNCER_STORAGE_KEY)).toBe('sounds');
  });

  it('ouvre depuis le point d’interrogation le tutoriel de la page courante', async () => {
    saveTutorialState({ ...createTutorialState(), orientation: 'completed' });
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
    saveTutorialState({ ...createTutorialState(), orientation: 'completed' });
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
    saveTutorialState({ ...createTutorialState(), orientation: 'completed' });
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

  it('offers a real activation path after the first orientation choice', async () => {
    const user = userEvent.setup();
    renderTutorial();

    await user.click(await screen.findByRole('button', { name: 'Passer' }));
    await user.click(await screen.findByRole('button', { name: /Sons uniquement/ }));

    expect(
      await screen.findByRole('dialog', { name: 'Préparer ma première séance' }),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Choisir un modèle' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Créer ma routine' })).toBeVisible();
  });

  it('starts the blank-routine mission without creating data', async () => {
    const user = userEvent.setup();
    renderTutorial();

    await user.click(await screen.findByRole('button', { name: 'Passer' }));
    await user.click(await screen.findByRole('button', { name: /Sons uniquement/ }));
    const blankChoice = await screen.findByRole('button', { name: 'Créer ma routine' });
    await waitFor(() => expect(blankChoice).toBeEnabled());
    await user.click(blankChoice);

    const state = loadTutorialState();
    expect(state.activationPath).toBe('blank');
    expect(state.activeMissionId).toBe('TUT-ROU-01');
  });

  it('persists the activation choice and mission atomically once in StrictMode', async () => {
    const storageSpy = vi.spyOn(Storage.prototype, 'setItem');
    try {
      const user = userEvent.setup();
      renderTutorial('/', true);

      await user.click(await screen.findByRole('button', { name: 'Passer' }));
      await user.click(await screen.findByRole('button', { name: /Sons uniquement/ }));
      const blankChoice = await screen.findByRole('button', { name: 'Créer ma routine' });
      await waitFor(() => expect(blankChoice).toBeEnabled());
      storageSpy.mockClear();

      await user.click(blankChoice);

      const activationWrites = storageSpy.mock.calls
        .filter(([key]) => key === TUTORIAL_STORAGE_KEY)
        .map(([, value]) => JSON.parse(String(value)) as Record<string, unknown>);
      expect(activationWrites).toHaveLength(1);
      expect(activationWrites).not.toContainEqual(
        expect.objectContaining({ activationPath: 'blank', activeMissionId: null }),
      );
      expect(activationWrites[0]).toMatchObject({
        activationPath: 'blank',
        activeMissionId: 'TUT-ROU-01',
      });
    } finally {
      storageSpy.mockRestore();
    }
  });

  it('preserves an active mission when activation is reached defensively', async () => {
    saveTutorialState({
      ...createTutorialState(),
      orientation: null,
      activeMissionId: 'TUT-ROU-02',
    });
    const storageSpy = vi.spyOn(Storage.prototype, 'setItem');
    try {
      const user = userEvent.setup();
      renderTutorial();

      await user.click(await screen.findByRole('button', { name: 'Passer' }));
      await user.click(await screen.findByRole('button', { name: /Sons uniquement/ }));
      const activation = await screen.findByRole('dialog', {
        name: 'Préparer ma première séance',
      });
      const blankChoice = screen.getByRole('button', { name: 'Créer ma routine' });
      await waitFor(() => expect(blankChoice).toBeEnabled());
      storageSpy.mockClear();

      await user.click(blankChoice);

      expect(storageSpy.mock.calls.filter(([key]) => key === TUTORIAL_STORAGE_KEY)).toHaveLength(0);
      expect(loadTutorialState()).toMatchObject({
        activationPath: null,
        activeMissionId: 'TUT-ROU-02',
      });
      expect(activation).toBeVisible();
    } finally {
      storageSpy.mockRestore();
    }
  });

  it('lists route-specific missions before the full orientation replay', async () => {
    saveTutorialState({ ...createTutorialState(), orientation: 'completed' });
    const user = userEvent.setup();
    renderTutorial('/settings');

    await user.click(screen.getByRole('button', { name: 'Aide sur cette page' }));

    expect(screen.getByRole('button', { name: 'Exporter une sauvegarde complète' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Comprendre une restauration' })).toBeVisible();
    expect(screen.getByRole('button', { name: /Recommencer la visite complète/ })).toBeVisible();
  });

  /*
   * Le texte reste tout ce dont la mission a besoin, et c'est ce que ce test
   * garde.
   *
   * La garantie de silence, elle, a changé de place. Ce n'est plus « le coach ne
   * demande rien » — il demande désormais, pour chaque mission — mais
   * `playTutorialNarration` qui refuse en mode Silence, avant même de chercher
   * un bus audio. Son propre test l'épingle là où c'est décidé.
   */
  it('keeps a mission fully readable in Silence', async () => {
    localStorage.setItem(ANNOUNCER_STORAGE_KEY, 'silence');
    saveTutorialState({
      ...createTutorialState(),
      orientation: 'completed',
      activeMissionId: 'TUT-DAT-01',
    });

    renderTutorial('/settings');

    expect(await screen.findByRole('region', { name: 'Mission guidée' })).toBeVisible();
    expect(screen.getByText('Exporte une sauvegarde complète de FitTrack.')).toBeVisible();
    expect(
      screen.getByText('Le fichier contient tes séances, routines, exercices, réglages et progression du tutoriel.'),
    ).toBeVisible();
  });

  /*
   * Les cinq étapes de composition visent des commandes qui n'existent que dans
   * `/routines/:id`. Le préfixe `/routines` de la mission correspondait déjà
   * depuis la liste : rien ne naviguait, aucune cible n'était trouvée, et le
   * coach demandait d'ajouter un exercice « à cette routine » devant une liste
   * qui n'en désigne aucune. La mission ne pouvait alors plus avancer.
   */
  it('emmène une mission de composition dans l’éditeur de sa routine', async () => {
    saveTutorialState({
      ...createTutorialState(),
      orientation: 'completed',
      activeMissionId: 'TUT-ROU-02',
      missionRoutineId: 'r-1',
    });

    renderTutorial('/routines');

    expect(await screen.findByText('adresse : /routines/r-1')).toBeVisible();
  });

  it('ne renvoie pas à la liste quelqu’un qui vient d’ouvrir une routine', async () => {
    // `TUT-ACT-01` vise le bouton de création de la liste, et s'achève sur
    // l'ouverture d'une routine — donc depuis l'éditeur, quelques images plus
    // tard. La visite ne doit pas l'en faire sortir entre-temps.
    saveTutorialState({
      ...createTutorialState(),
      orientation: 'completed',
      activationPath: 'template',
      activeMissionId: 'TUT-ACT-01',
    });

    renderTutorial('/routines/r-1');

    await waitFor(() => expect(loadTutorialState().missionRoutineId).toBe('r-1'));
    expect(screen.getByText('adresse : /routines/r-1')).toBeVisible();
  });

  it('emmène tout de suite une mission choisie dans l’aide, même en arrière', async () => {
    saveTutorialState({
      ...createTutorialState(),
      orientation: 'completed',
      missionRoutineId: 'r-1',
    });
    const user = userEvent.setup();
    renderTutorial('/routines/r-1');

    await user.click(screen.getByRole('button', { name: 'Aide sur cette page' }));
    await user.click(screen.getByRole('button', { name: 'Créer une première routine' }));

    // Demandé explicitement : la liste est en amont, on y va quand même.
    expect(await screen.findByText('adresse : /routines')).toBeVisible();
  });

  it('ne dit rien tant que l’écran de l’étape n’est pas là', async () => {
    saveTutorialState({
      ...createTutorialState(),
      orientation: 'completed',
      activeMissionId: 'TUT-DAT-01',
      missionRoutineId: null,
    });

    // `TUT-DAT-01` s'enchaîne après l'enregistrement d'une séance : elle ne
    // téléporte personne dans les Réglages, et ne parle pas depuis l'historique.
    renderTutorial('/history');

    await screen.findByText('adresse : /history');
    expect(screen.queryByRole('region', { name: 'Mission guidée' })).not.toBeInTheDocument();
    expect(playTutorialNarrationMock).not.toHaveBeenCalled();
  });

  it('retient la routine ouverte pour savoir y revenir', async () => {
    saveTutorialState({ ...createTutorialState(), orientation: 'completed' });

    renderTutorial('/routines/r-9');

    await waitFor(() => expect(loadTutorialState().missionRoutineId).toBe('r-9'));
  });

  it('n’offre pas depuis la liste une mission qui se joue dans un éditeur', async () => {
    saveTutorialState({ ...createTutorialState(), orientation: 'completed' });
    const user = userEvent.setup();
    renderTutorial('/routines');

    await user.click(screen.getByRole('button', { name: 'Aide sur cette page' }));

    expect(screen.getByRole('button', { name: 'Créer une première routine' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Ajouter un exercice' })).not.toBeInTheDocument();
  });

  it('donne son propre chapitre aux blocs', async () => {
    saveTutorialState({ ...createTutorialState(), orientation: 'completed' });
    const user = userEvent.setup();
    renderTutorial('/programs');

    await user.click(screen.getByRole('button', { name: 'Aide sur cette page' }));
    await user.click(screen.getByRole('button', { name: /Expliquer cette page · Blocs/ }));

    expect(await screen.findByRole('dialog', { name: 'Visite guidée' })).toBeVisible();
    expect(screen.getByText(/Un bloc étale tes routines/)).toBeVisible();
  });

  it('does not offer activation to a migrated v1 user', () => {
    localStorage.setItem(LEGACY_TUTORIAL_STORAGE_KEY, 'completed');

    renderTutorial();

    expect(
      screen.queryByRole('dialog', { name: 'Préparer ma première séance' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Visite guidée' })).not.toBeInTheDocument();
  });

  it('keeps guarded activation choices inert until the workout fact is known', async () => {
    getActiveWorkoutMock.mockReturnValue(new Promise(() => undefined));
    const user = userEvent.setup();
    renderTutorial();

    await user.click(await screen.findByRole('button', { name: 'Passer' }));
    await user.click(await screen.findByRole('button', { name: /Sons uniquement/ }));
    const activation = await screen.findByRole('dialog', {
      name: 'Préparer ma première séance',
    });
    const templateChoice = screen.getByRole('button', { name: 'Choisir un modèle' });
    const blankChoice = screen.getByRole('button', { name: 'Créer ma routine' });

    expect(templateChoice).toBeDisabled();
    expect(blankChoice).toBeDisabled();
    await user.click(blankChoice);

    expect(activation).toBeVisible();
    expect(loadTutorialState()).toMatchObject({
      activationPath: null,
      activeMissionId: null,
    });
  });
});
