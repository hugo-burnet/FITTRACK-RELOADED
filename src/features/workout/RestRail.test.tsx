import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RestRail } from './RestRail';

const announce = vi.hoisted(() => vi.fn<(cue: string, when?: number) => boolean>(() => true));
const signalRestFinishedOnCurrentPlatform = vi.hoisted(() => vi.fn());

vi.mock('@/audio/announce', () => ({ announce }));
vi.mock('./restAlert', () => ({ signalRestFinishedOnCurrentPlatform }));
vi.mock('@/platform/nativeNotifications', () => ({
  nativeNotifications: { standDownRest: vi.fn().mockResolvedValue(undefined) },
}));

describe('RestRail — audio du repos', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    vi.clearAllMocks();
    announce.mockReturnValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('garde toutes les annonces silencieuses quand le RPE reste ouvert jusqu’à la fin', () => {
    const onDone = vi.fn(() => false);
    render(<RestRail startedAt={0} endsAt={15_000} audioSuppressed onDone={onDone} />);

    act(() => vi.advanceTimersByTime(15_000));

    expect(announce).not.toHaveBeenCalled();
    expect(signalRestFinishedOnCurrentPlatform).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledOnce();
    expect(onDone).toHaveBeenCalledWith(false);
  });

  it('réarme uniquement les annonces futures quand le RPE se ferme avant T-10', () => {
    const onDone = vi.fn(() => false);
    const view = render(<RestRail startedAt={0} endsAt={20_000} audioSuppressed onDone={onDone} />);

    act(() => vi.advanceTimersByTime(5_000));
    view.rerender(
      <RestRail startedAt={0} endsAt={20_000} audioSuppressed={false} onDone={onDone} />,
    );
    act(() => vi.advanceTimersByTime(5_000));

    expect(announce).toHaveBeenCalledWith('rest-10');
  });

  it('ne rattrape pas T-10 quand le RPE se ferme après ce jalon', () => {
    const onDone = vi.fn(() => false);
    const view = render(<RestRail startedAt={0} endsAt={20_000} audioSuppressed onDone={onDone} />);

    act(() => vi.advanceTimersByTime(12_000));
    view.rerender(
      <RestRail startedAt={0} endsAt={20_000} audioSuppressed={false} onDone={onDone} />,
    );
    act(() => vi.advanceTimersByTime(5_000));

    expect(announce.mock.calls.map(([cue]) => cue)).toEqual(['rest-3', 'rest-2', 'rest-1']);
  });

  it('n’émet aucun rattrapage si le repos s’est terminé pendant le RPE', () => {
    const onDone = vi.fn(() => false);
    const view = render(<RestRail startedAt={0} endsAt={5_000} audioSuppressed onDone={onDone} />);

    act(() => vi.advanceTimersByTime(5_000));
    view.rerender(
      <RestRail startedAt={0} endsAt={5_000} audioSuppressed={false} onDone={onDone} />,
    );
    act(() => vi.runOnlyPendingTimers());

    expect(announce).not.toHaveBeenCalled();
    expect(signalRestFinishedOnCurrentPlatform).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledOnce();
  });

  it('conserve le décompte et l’alerte de fin sans question RPE', () => {
    const onDone = vi.fn(() => false);
    render(<RestRail startedAt={0} endsAt={15_000} audioSuppressed={false} onDone={onDone} />);

    act(() => vi.advanceTimersByTime(15_000));

    expect(announce.mock.calls.map(([cue]) => cue)).toEqual([
      'rest-10',
      'rest-3',
      'rest-2',
      'rest-1',
    ]);
    expect(onDone).toHaveBeenCalledWith(true);
    expect(signalRestFinishedOnCurrentPlatform).toHaveBeenCalledOnce();
  });
});
