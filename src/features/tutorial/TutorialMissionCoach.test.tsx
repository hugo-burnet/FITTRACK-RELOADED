import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
