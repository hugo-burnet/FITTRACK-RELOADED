const { playTutorialNarration, stopTutorialNarration } = vi.hoisted(() => ({
  playTutorialNarration: vi.fn(() => Promise.resolve(true)),
  stopTutorialNarration: vi.fn(),
}));
vi.mock('./tutorialNarration', () => ({ playTutorialNarration, stopTutorialNarration }));

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Sheet } from '@/ui';
import { useHoldTimer } from '@/stores/holdTimer';
import { useRepPacer } from '@/stores/repPacer';
import { useRestTimer } from '@/stores/restTimer';
import { TutorialMissionCoach } from './TutorialMissionCoach';
import { missionFor } from './tutorialMissions';

/** Une cible haute de 48 px, telle que la mesure du hook la remet au coach. */
const boxAt = (top: number): DOMRect =>
  ({
    top,
    right: 116,
    bottom: top + 48,
    left: 16,
    width: 100,
    height: 48,
    x: 16,
    y: top,
    toJSON: () => ({}),
  }) satisfies DOMRect;

describe('TutorialMissionCoach', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows text without requiring a voice clip and leaves the target clickable', async () => {
    const target = vi.fn();
    render(
      <>
        <button data-tutorial-id="routine-create" onClick={target}>
          Créer
        </button>
        <TutorialMissionCoach
          mission={missionFor('TUT-ROU-01')}
          stepIndex={0}
          rect={null}
          onContinue={vi.fn()}
          onDismiss={vi.fn()}
        />
      </>,
    );

    expect(screen.getByRole('region', { name: /Mission guidée/ })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Créer' }));
    expect(target).toHaveBeenCalledOnce();
  });

  it('keeps the screen layer non-interactive while the coach panel receives events', () => {
    render(
      <TutorialMissionCoach
        mission={missionFor('TUT-ROU-01')}
        stepIndex={0}
        rect={null}
        onContinue={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    const panel = screen.getByRole('region', { name: /Mission guidée/ });
    expect(panel).toHaveClass('pointer-events-auto');
    expect(panel.parentElement).toHaveClass('pointer-events-none');
  });

  it('keeps the non-modal coach below modal sheets so dialog actions stay reachable', () => {
    render(
      <>
        <TutorialMissionCoach
          mission={missionFor('TUT-ROU-01')}
          stepIndex={0}
          rect={null}
          onContinue={vi.fn()}
          onDismiss={vi.fn()}
        />
        <Sheet open onClose={vi.fn()} title="Créer">
          <button type="button">Routine vide</button>
        </Sheet>
      </>,
    );

    const coachLayer = screen.getByRole('region', { name: /Mission guidée/ }).parentElement;
    const sheetLayer = screen.getByRole('dialog', { name: 'Créer' }).parentElement;

    expect(coachLayer).toHaveClass('z-40');
    expect(sheetLayer).toHaveClass('z-50');
  });

  it('uses automatic scrolling when reduced motion is preferred', () => {
    const scrollIntoView = vi.fn();
    const reducedMotionQuery: MediaQueryList = {
      matches: true,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };
    const matchMedia = vi.fn(() => reducedMotionQuery);
    vi.stubGlobal('matchMedia', matchMedia);
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      }),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(
      <>
        <button
          data-tutorial-id="routine-create"
          ref={(element) => {
            if (element !== null) element.scrollIntoView = scrollIntoView;
          }}
        >
          Créer
        </button>
        <TutorialMissionCoach
          mission={missionFor('TUT-ROU-01')}
          stepIndex={0}
          rect={null}
          onContinue={vi.fn()}
          onDismiss={vi.fn()}
        />
      </>,
    );

    expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', behavior: 'auto' });
  });

  /*
   * Le cadre suit la mesure, il ne la fait plus.
   *
   * Le coach mesurait sa propre cible pendant que `useTutorialMissions`
   * mesurait la même pour décider si l'étape pouvait parler : deux
   * observateurs, deux réponses possibles à « la cible est-elle là ». Le
   * rectangle descend désormais d'en haut, et l'apparition tardive d'une ancre
   * — route paresseuse, lecture Dexie, carte dépliée — se joue là où le coach
   * est monté, ce que `TutorialProvider.test` épingle.
   */
  it('encadre exactement ce que la mesure lui donne', () => {
    const { container, rerender } = render(
      <TutorialMissionCoach
        mission={missionFor('TUT-ROU-01')}
        stepIndex={0}
        rect={null}
        onContinue={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    const ring = () => container.querySelector<HTMLElement>('[aria-hidden="true"].ring-2');
    expect(ring()).toBeNull();

    rerender(
      <TutorialMissionCoach
        mission={missionFor('TUT-ROU-01')}
        stepIndex={0}
        rect={boxAt(120)}
        onContinue={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(ring()?.style.top).toBe('114px');
    expect(ring()?.style.height).toBe('60px');
  });

  it('dismisses immediately', async () => {
    const dismiss = vi.fn();
    render(
      <TutorialMissionCoach
        mission={missionFor('TUT-DAT-01')}
        stepIndex={0}
        rect={null}
        onContinue={vi.fn()}
        onDismiss={dismiss}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Passer cette mission' }));
    expect(dismiss).toHaveBeenCalledOnce();
  });
});

describe('TutorialMissionCoach — la voix de la mission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRestTimer.getState().stop();
    useRepPacer.getState().stop();
    useHoldTimer.getState().stop();
  });

  afterEach(() => {
    useRestTimer.getState().stop();
    useRepPacer.getState().stop();
    useHoldTimer.getState().stop();
  });

  it('dit la consigne de l’étape en arrivant dessus', () => {
    render(
      <TutorialMissionCoach
        mission={missionFor('TUT-ROU-01')}
        stepIndex={0}
        rect={null}
        onContinue={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(playTutorialNarration).toHaveBeenCalledWith(
      'mission-routine-create-1',
      expect.any(Function),
    );
  });

  // Le décompte d'un repos est cadencé sur l'horloge murale : il ne se met pas
  // en file d'attente, et une consigne par-dessus lui fait perdre le « un ».
  it('se tait tant qu’une horloge de séance tourne', () => {
    useRestTimer.getState().start('set-1', 60);

    render(
      <TutorialMissionCoach
        mission={missionFor('TUT-WRK-03')}
        stepIndex={0}
        rect={null}
        onContinue={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(playTutorialNarration).not.toHaveBeenCalled();
  });

  it('se tait aussi pendant la cadence et pendant un maintien', () => {
    useRepPacer.getState().start('row', 'set-1', 8, 3);
    render(
      <TutorialMissionCoach
        mission={missionFor('TUT-ROU-01')}
        stepIndex={0}
        rect={null}
        onContinue={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(playTutorialNarration).not.toHaveBeenCalled();

    useRepPacer.getState().stop();
    useHoldTimer.getState().start('row', 'set-1');
    render(
      <TutorialMissionCoach
        mission={missionFor('TUT-ROU-01')}
        stepIndex={0}
        rect={null}
        onContinue={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(playTutorialNarration).not.toHaveBeenCalled();
  });

  it('coupe la consigne en quittant l’étape', () => {
    const view = render(
      <TutorialMissionCoach
        mission={missionFor('TUT-ROU-01')}
        stepIndex={0}
        rect={null}
        onContinue={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    view.unmount();

    expect(stopTutorialNarration).toHaveBeenCalled();
  });
});
