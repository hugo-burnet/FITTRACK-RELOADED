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

describe('RestRail — la barre de vie', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const rail = (container: HTMLElement) =>
    container.querySelector<HTMLElement>('[data-part="meter-rail"]');

  it('marque les dix dernières secondes', () => {
    const { container } = render(
      <RestRail startedAt={0} endsAt={60_000} audioSuppressed={false} onDone={() => false} />,
    );
    expect(rail(container)).not.toHaveAttribute('data-crit');

    act(() => vi.advanceTimersByTime(50_000));

    expect(rail(container)).toHaveAttribute('data-crit', 'true');
  });

  it('marque un coup quand le repos est raccourci, et seulement alors', () => {
    const view = render(
      <RestRail startedAt={0} endsAt={60_000} audioSuppressed={false} onDone={() => false} />,
    );
    view.rerender(
      <RestRail startedAt={0} endsAt={75_000} audioSuppressed={false} onDone={() => false} />,
    );
    expect(rail(view.container)).not.toHaveAttribute('data-hit');

    view.rerender(
      <RestRail startedAt={0} endsAt={60_000} audioSuppressed={false} onDone={() => false} />,
    );
    act(() => vi.advanceTimersByTime(0));
    expect(rail(view.container)).toHaveAttribute('data-hit', 'true');

    act(() => vi.advanceTimersByTime(500));
    expect(rail(view.container)).not.toHaveAttribute('data-hit');
  });
});

describe('RestRail — la perte qui s’évapore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(30_000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('détache le morceau perdu, à sa place dans la barre de vie, puis le laisse partir', () => {
    // 30 s écoulées d'un repos de 2 min ; −15 s déplace début et fin ensemble (restTimer.shift).
    const view = render(
      <RestRail startedAt={0} endsAt={120_000} audioSuppressed={false} onDone={() => false} />,
    );
    view.rerender(
      <RestRail startedAt={-15_000} endsAt={105_000} audioSuppressed={false} onDone={() => false} />,
    );
    act(() => vi.advanceTimersByTime(0));

    const piece = view.container.querySelector<HTMLElement>('[data-part="rest-loss"] > i');
    // La vie restante est à gauche : elle passe de 75 % à 62,5 % ; le morceau perdu est entre les deux.
    expect(piece?.style.left).toBe('62.5%');
    expect(piece?.style.width).toBe('12.5%');
    // Déchiré en lambeaux, qui partent chacun de leur côté.
    expect(piece?.querySelectorAll('[data-shred]')).toHaveLength(7);

    act(() => vi.advanceTimersByTime(1_000));
    expect(view.container.querySelector('[data-part="rest-loss"] > i')).toBeNull();
  });

  it('ne détache rien quand le repos s’allonge', () => {
    const view = render(
      <RestRail startedAt={0} endsAt={120_000} audioSuppressed={false} onDone={() => false} />,
    );
    view.rerender(
      <RestRail startedAt={15_000} endsAt={135_000} audioSuppressed={false} onDone={() => false} />,
    );

    expect(view.container.querySelector('[data-part="rest-loss"] > i')).toBeNull();
  });
});
