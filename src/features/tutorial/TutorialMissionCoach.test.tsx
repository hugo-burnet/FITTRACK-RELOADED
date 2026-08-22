import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Sheet } from '@/ui';
import { TutorialMissionCoach } from './TutorialMissionCoach';
import { missionFor } from './tutorialMissions';

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
      <TutorialMissionCoach mission={missionFor('TUT-ROU-01')} stepIndex={0} onDismiss={vi.fn()} />,
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

  it.each([
    { position: 'when its target is absent', targetTop: null, placement: 'top-[5rem]' },
    { position: 'when its target is near the top', targetTop: 96, placement: 'bottom-[4.5rem]' },
    { position: 'when its target is near the bottom', targetTop: 700, placement: 'top-[5rem]' },
  ])('keeps the coach away from the actionable area $position', ({ targetTop, placement }) => {
    vi.stubGlobal('innerHeight', 844);
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
        {targetTop !== null && (
          <button
            data-tutorial-id="routine-create"
            ref={(element) => {
              if (element === null) return;
              element.getBoundingClientRect = () =>
                ({
                  top: targetTop,
                  right: 116,
                  bottom: targetTop + 48,
                  left: 16,
                  width: 100,
                  height: 48,
                  x: 16,
                  y: targetTop,
                  toJSON: () => ({}),
                }) satisfies DOMRect;
            }}
          >
            Créer
          </button>
        )}
        <TutorialMissionCoach
          mission={missionFor('TUT-ROU-01')}
          stepIndex={0}
          onDismiss={vi.fn()}
        />
      </>,
    );

    expect(screen.getByRole('region', { name: /Mission guidée/ })).toHaveClass(placement);
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
          onDismiss={vi.fn()}
        />
      </>,
    );

    expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', behavior: 'auto' });
  });

  it('dismisses immediately', async () => {
    const dismiss = vi.fn();
    render(
      <TutorialMissionCoach mission={missionFor('TUT-DAT-01')} stepIndex={0} onDismiss={dismiss} />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Passer cette mission' }));
    expect(dismiss).toHaveBeenCalledOnce();
  });
});
