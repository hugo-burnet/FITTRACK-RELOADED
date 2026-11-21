import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/i18n/fr';
import { RestDock } from './RestDock';

const announce = vi.hoisted(() => vi.fn<(cue: string, when?: number) => boolean>(() => true));

vi.mock('@/audio/announce', () => ({ announce }));
vi.mock('@/platform/nativeNotifications', () => ({
  nativeNotifications: { standDownRest: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('./restAlert', () => ({ signalRestFinishedOnCurrentPlatform: vi.fn() }));

const props = (patch: { endsAt?: number; audioSuppressed?: boolean } = {}) => ({
  startedAt: 0,
  endsAt: 90_000,
  audioSuppressed: false,
  onDone: vi.fn<(audioAllowed: boolean) => boolean>(() => false),
  onShift: vi.fn<(seconds: number) => void>(),
  onSkip: vi.fn(),
  ...patch,
});

describe('RestDock — le repos, en bas de l’écran de séance', () => {
  afterEach(() => vi.useRealTimers());

  it('affiche le temps restant et ses trois gestes', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(30_000);
    const given = props();
    const { container } = render(<RestDock {...given} />);

    // Le libellé et le chiffre sont deux éléments d'une même ligne : le groupe les lit « Repos 1:00 ».
    expect(screen.getByRole('group', { name: 'Repos' })).toHaveTextContent(/Repos 1:00/);
    // La barre de repos — et en Cyber sa barre de vie et ses dégâts — vit ici désormais.
    expect(container.querySelector('[data-part="meter-rail"]')).not.toBeNull();
    expect(container.querySelector('[data-part="rest-loss"]')).not.toBeNull();

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(screen.getByRole('button', { name: t('workout.restShorten') }));
    await user.click(screen.getByRole('button', { name: t('workout.restLengthen') }));
    await user.click(screen.getByRole('button', { name: t('workout.restSkip') }));

    expect(given.onShift.mock.calls).toEqual([[-15], [15]]);
    expect(given.onSkip).toHaveBeenCalledOnce();
  });

  it('transmet la suspension audio du repos au rail', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    announce.mockClear();
    const given = props({ endsAt: 15_000, audioSuppressed: true });

    render(<RestDock {...given} />);
    act(() => vi.advanceTimersByTime(15_000));

    expect(announce).not.toHaveBeenCalled();
    expect(given.onDone).toHaveBeenCalledWith(false);
  });
});
