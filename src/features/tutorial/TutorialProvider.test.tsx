import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode, type ReactNode } from 'react';
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

/**
 * L'écran de test, et ce qu'il porte.
 *
 * Une consigne ne s'affiche plus tant que sa commande n'est pas à l'écran :
 * un test qui attend le coach doit donc rendre l'ancre que l'étape désigne,
 * exactement comme l'écran réel le fait.
 */
function renderTutorial(path = '/', strict = false, anchors: ReactNode = null) {
  const tutorial = (
    <MemoryRouter initialEntries={[path]}>
      <TutorialProvider>
        <Screen title="Écran de test">
          <Address />
          {anchors}
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
      version: 3,
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

    expect(await screen.findByRole('region', { name: 'Visite guidée' })).toBeVisible();
    expect(screen.getByText('Progression')).toBeVisible();
    expect(screen.getByText(/Suis tes records/)).toBeVisible();
  });

  /*
   * L'aide n'effaçait pas seulement la route du chapitre : elle le jouait sur
   * place. Depuis l'éditeur d'une routine, « Expliquer cette page · Routines »
   * décrivait donc la liste — et encadrait son onglet — devant un écran qui
   * n'en est pas. Ouvrir la bonne page est le moindre déplacement des deux.
   */
  it('envoie l’aide Routines sur la liste plutôt que la laisser dans un éditeur', async () => {
    saveTutorialState({ ...createTutorialState(), orientation: 'completed' });
    const user = userEvent.setup();
    renderTutorial('/routines/r-1');

    await user.click(screen.getByRole('button', { name: 'Aide sur cette page' }));
    await user.click(screen.getByRole('button', { name: /Expliquer cette page · Routines/ }));

    expect(await screen.findByText('adresse : /routines')).toBeVisible();
  });

  /*
   * La transcription s'ouvrait au montage, puis se repliait toute seule 1,8 s
   * plus tard — une animation qu'on subit au moment où l'on commence à lire.
   * Elle naît repliée : le résumé suffit, et le texte intégral se demande.
   */
  it('n’ouvre pas la transcription à la place de l’utilisateur', async () => {
    saveTutorialState({ ...createTutorialState(), orientation: 'completed' });
    const user = userEvent.setup();
    renderTutorial('/routines');

    await user.click(screen.getByRole('button', { name: 'Aide sur cette page' }));
    await user.click(screen.getByRole('button', { name: /Expliquer cette page/ }));

    const toggle = await screen.findByRole('button', { name: 'Lire le détail' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await user.click(toggle);
    expect(screen.getByRole('button', { name: 'Masquer le détail' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
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

  it('propose la campagne, et rien d’autre, après le premier choix audio', async () => {
    const user = userEvent.setup();
    renderTutorial();

    await user.click(await screen.findByRole('button', { name: 'Passer' }));
    await user.click(await screen.findByRole('button', { name: /Sons uniquement/ }));

    expect(await screen.findByRole('dialog', { name: 'Ma première séance guidée' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Commencer la découverte' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Plus tard' })).toBeVisible();
  });

  it('démarre la campagne sans créer la moindre donnée', async () => {
    const user = userEvent.setup();
    renderTutorial();

    await user.click(await screen.findByRole('button', { name: 'Passer' }));
    await user.click(await screen.findByRole('button', { name: /Sons uniquement/ }));
    const startChoice = await screen.findByRole('button', { name: 'Commencer la découverte' });
    await waitFor(() => expect(startChoice).toBeEnabled());
    await user.click(startChoice);

    const state = loadTutorialState();
    expect(state.campaign).toBe('preparing');
    expect(state.activeMissionId).toBe('TUT-CAM-01');
    expect(state.campaignRoutineId).toBeNull();
  });

  it('retient « plus tard » plutôt que de reposer la question à chaque lancement', async () => {
    const user = userEvent.setup();
    renderTutorial();

    await user.click(await screen.findByRole('button', { name: 'Passer' }));
    await user.click(await screen.findByRole('button', { name: /Sons uniquement/ }));
    await user.click(await screen.findByRole('button', { name: 'Plus tard' }));

    expect(loadTutorialState()).toMatchObject({
      campaign: 'dismissed',
      activeMissionId: null,
    });
  });

  it('persists the campaign entry and its mission atomically once in StrictMode', async () => {
    const storageSpy = vi.spyOn(Storage.prototype, 'setItem');
    try {
      const user = userEvent.setup();
      renderTutorial('/', true);

      await user.click(await screen.findByRole('button', { name: 'Passer' }));
      await user.click(await screen.findByRole('button', { name: /Sons uniquement/ }));
      const startChoice = await screen.findByRole('button', { name: 'Commencer la découverte' });
      await waitFor(() => expect(startChoice).toBeEnabled());
      storageSpy.mockClear();

      await user.click(startChoice);

      const campaignWrites = storageSpy.mock.calls
        .filter(([key]) => key === TUTORIAL_STORAGE_KEY)
        .map(([, value]) => JSON.parse(String(value)) as Record<string, unknown>);
      expect(campaignWrites).toHaveLength(1);
      expect(campaignWrites).not.toContainEqual(
        expect.objectContaining({ campaign: 'preparing', activeMissionId: null }),
      );
      expect(campaignWrites[0]).toMatchObject({
        campaign: 'preparing',
        activeMissionId: 'TUT-CAM-01',
      });
    } finally {
      storageSpy.mockRestore();
    }
  });

  it('preserves an active mission when the campaign invite is reached defensively', async () => {
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
      const invite = await screen.findByRole('dialog', {
        name: 'Ma première séance guidée',
      });
      const startChoice = screen.getByRole('button', { name: 'Commencer la découverte' });
      await waitFor(() => expect(startChoice).toBeEnabled());
      storageSpy.mockClear();

      await user.click(startChoice);

      expect(storageSpy.mock.calls.filter(([key]) => key === TUTORIAL_STORAGE_KEY)).toHaveLength(0);
      expect(loadTutorialState()).toMatchObject({
        campaign: 'not-started',
        activeMissionId: 'TUT-ROU-02',
      });
      expect(invite).toBeVisible();
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

    renderTutorial('/settings', false, <button data-tutorial-id="backup-export">Exporter</button>);

    expect(await screen.findByRole('region', { name: 'Mission guidée' })).toBeVisible();
    expect(await screen.findByText('Exporte une sauvegarde complète de FitTrack.')).toBeVisible();

    // Le détail est replié au montage : il se lit sur demande, et il n'y a
    // aucune voix pour le porter à sa place.
    await userEvent.click(screen.getByRole('button', { name: 'Lire le détail' }));
    expect(
      screen.getByText(
        'Le fichier contient tes séances, routines, exercices, réglages et progression du tutoriel.',
      ),
    ).toBeVisible();
  });

  /*
   * L'ancre arrive après la route, pas avant.
   *
   * La consigne partait dès l'arrivée sur l'écran. Or la route est paresseuse
   * et la liste vient de Dexie : pendant quelques images, la commande décrite
   * n'existe pas encore, et la voix décrivait un bouton que personne ne voyait.
   * Le coach attend désormais la cible — et repart avec elle.
   */
  it('attend que la commande décrite existe avant de parler', async () => {
    saveTutorialState({
      ...createTutorialState(),
      orientation: 'completed',
      activeMissionId: 'TUT-DAT-01',
    });

    renderTutorial('/settings');

    await screen.findByText('adresse : /settings');
    expect(await screen.findByText('Recherche de la commande sur cet écran…')).toBeVisible();
    expect(screen.queryByText('Exporte une sauvegarde complète de FitTrack.')).not.toBeInTheDocument();
    expect(playTutorialNarrationMock).not.toHaveBeenCalled();

    const late = document.createElement('button');
    late.setAttribute('data-tutorial-id', 'backup-export');
    act(() => {
      document.body.append(late);
    });

    expect(await screen.findByText('Exporte une sauvegarde complète de FitTrack.')).toBeVisible();
    expect(playTutorialNarrationMock).toHaveBeenCalledWith(
      'mission-backup-export-1',
      expect.any(Function),
    );

    act(() => late.remove());
    await waitFor(() =>
      expect(screen.getByText('Recherche de la commande sur cet écran…')).toBeVisible(),
    );
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
    // `TUT-CAM-01` vise le bouton de création de la liste, et s'achève sur la
    // création d'une routine — donc depuis l'éditeur, quelques images plus
    // tard. La visite ne doit pas l'en faire sortir entre-temps.
    saveTutorialState({
      ...createTutorialState(),
      orientation: 'completed',
      campaign: 'preparing',
      activeMissionId: 'TUT-CAM-01',
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

    expect(await screen.findByRole('region', { name: 'Visite guidée' })).toBeVisible();
    expect(screen.getByText(/Un bloc étale tes routines/)).toBeVisible();
  });

  it('does not offer the campaign to a migrated v1 user', () => {
    localStorage.setItem(LEGACY_TUTORIAL_STORAGE_KEY, 'completed');

    renderTutorial();

    expect(
      screen.queryByRole('dialog', { name: 'Ma première séance guidée' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Visite guidée' })).not.toBeInTheDocument();
  });

  it('keeps the campaign start inert until the workout fact is known', async () => {
    getActiveWorkoutMock.mockReturnValue(new Promise(() => undefined));
    const user = userEvent.setup();
    renderTutorial();

    await user.click(await screen.findByRole('button', { name: 'Passer' }));
    await user.click(await screen.findByRole('button', { name: /Sons uniquement/ }));
    const invite = await screen.findByRole('dialog', {
      name: 'Ma première séance guidée',
    });
    const startChoice = screen.getByRole('button', { name: 'Commencer la découverte' });

    expect(startChoice).toBeDisabled();
    await user.click(startChoice);

    expect(invite).toBeVisible();
    expect(loadTutorialState()).toMatchObject({
      campaign: 'not-started',
      activeMissionId: null,
    });
  });
});
