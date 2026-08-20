import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { armRestCountdown, countdownTicks, fireCountdown } from './restCountdown';

const announce = vi.hoisted(() => vi.fn<(cue: string, when?: number) => boolean>(() => true));
const standDownRest = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('@/audio/announce', () => ({ announce }));
vi.mock('@/platform/nativeNotifications', () => ({
  nativeNotifications: { standDownRest },
}));

describe('countdownTicks', () => {
  it('rend les trois secondes, dans l’ordre', () => {
    expect(countdownTicks(100_000, 97_000)).toEqual([
      { cue: 'rest-3', when: 0 },
      { cue: 'rest-2', when: 1 },
      { cue: 'rest-1', when: 2 },
    ]);
  });

  it('garde ce qu’il peut d’un repos armé trop tard', () => {
    // Armé à 2,1 s de la fin : la marque des trois secondes est passée depuis
    // longtemps, celle des deux est encore devant. Un tic dont l'instant est
    // derrière nous n'est pas rejoué en retard — il est perdu, et « deux, un »
    // reste un décompte là où « trois » collé à « deux » n'en est plus un.
    expect(countdownTicks(100_000, 97_900).map(({ cue }) => cue)).toEqual(['rest-2', 'rest-1']);
  });

  it('tolère un minuteur qui se réveille en retard de quelques millisecondes', () => {
    expect(countdownTicks(100_000, 97_100)[0]).toEqual({ cue: 'rest-3', when: 0 });
  });

  it('ne rend rien pour un repos déjà écoulé', () => {
    expect(countdownTicks(100_000, 100_500)).toEqual([]);
  });
});

describe('armRestCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    vi.clearAllMocks();
    announce.mockReturnValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('n’annonce rien avant les trois dernières secondes', () => {
    armRestCountdown(90_000, 0);
    vi.advanceTimersByTime(79_000);
    expect(announce).not.toHaveBeenCalled();
  });

  it('annonce la reprise dix secondes avant sans désarmer la notification', () => {
    armRestCountdown(90_000, 0);
    vi.advanceTimersByTime(80_000);

    expect(announce).toHaveBeenCalledWith('rest-10');
    expect(standDownRest).not.toHaveBeenCalled();
  });

  it('ne ment pas avec une annonce à dix sur un repos plus court', () => {
    armRestCountdown(9_000, 0);
    vi.advanceTimersByTime(6_000);

    expect(announce.mock.calls.map(([cue]) => cue)).toEqual(['rest-3', 'rest-2', 'rest-1']);
  });

  it('joue les trois tics puis rend la main à la notification', () => {
    armRestCountdown(90_000, 0);
    vi.advanceTimersByTime(87_000);

    expect(announce.mock.calls.map(([cue]) => cue)).toEqual([
      'rest-10',
      'rest-3',
      'rest-2',
      'rest-1',
    ]);
    expect(standDownRest).toHaveBeenCalledOnce();
  });

  it('laisse la notification armée quand rien n’a pu sortir', () => {
    announce.mockReturnValue(false);
    armRestCountdown(90_000, 0);
    vi.advanceTimersByTime(87_000);

    expect(standDownRest).not.toHaveBeenCalled();
  });

  it('s’annule avec le repos', () => {
    const cancel = armRestCountdown(90_000, 0);
    cancel();
    vi.advanceTimersByTime(90_000);

    expect(announce).not.toHaveBeenCalled();
  });
});

describe('fireCountdown', () => {
  beforeEach(() => vi.clearAllMocks());

  it('dit avoir sonné dès qu’un tic est sorti', () => {
    announce.mockReturnValueOnce(false).mockReturnValueOnce(true).mockReturnValueOnce(false);
    expect(fireCountdown(100_000, 97_000)).toBe(true);
  });

  it('dit n’avoir rien sorti quand le son est coupé', () => {
    announce.mockReturnValue(false);
    expect(fireCountdown(100_000, 97_000)).toBe(false);
  });
});
