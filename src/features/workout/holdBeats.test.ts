import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { armHoldChrono, holdBeats, pendingHoldBeats } from './holdBeats';

const announce = vi.hoisted(() => vi.fn<(cue: string, when?: number) => boolean>(() => true));

vi.mock('@/audio/announce', () => ({ announce }));

describe('holdBeats', () => {
  it('pose un repère toutes les cinq secondes, jusqu’à trois minutes', () => {
    const beats = holdBeats(1_000);
    expect(beats).toHaveLength(36);
    expect(beats[0]).toEqual({ cue: 'hold-5', at: 6_000 });
    expect(beats[11]).toEqual({ cue: 'hold-60', at: 61_000 });
    expect(beats[35]).toEqual({ cue: 'hold-180', at: 181_000 });
  });

  // Dérivés d'un départ absolu, jamais accumulés : un minuteur qui tire en
  // retard coûte ce repère-là, pas l'alignement de tout le maintien.
  it('dérive chaque repère du départ, pas du repère précédent', () => {
    expect(holdBeats(0).map(({ at }) => at)).toEqual(
      Array.from({ length: 36 }, (_, index) => (index + 1) * 5_000),
    );
  });

  // Toute la différence avec `repBeats` : un maintien ne sait pas quand il
  // finit. Une cible prescrite est annoncée à son échéance comme n'importe quel
  // repère, et le chrono continue — une cible est un objectif, pas une limite.
  it('ne décide jamais de la fin d’une série', () => {
    expect(holdBeats(0).some(({ cue }) => cue === 'set-done')).toBe(false);
  });
});

describe('pendingHoldBeats', () => {
  it('garde ce qui est devant', () => {
    const beats = holdBeats(0);
    expect(
      pendingHoldBeats(beats, 10_200)
        .map(({ cue }) => cue)
        .slice(0, 2),
    ).toEqual(['hold-15', 'hold-20']);
  });

  // Sans les 150 ms de mou, le repère qu'on perd est le premier, à chaque fois.
  it('tolère un réveil d’un cheveu trop tard', () => {
    expect(pendingHoldBeats(holdBeats(0), 10_100)[0]?.cue).toBe('hold-10');
    expect(pendingHoldBeats(holdBeats(0), 9_900)[0]?.cue).toBe('hold-10');
  });

  it('ne garde rien passé le dernier repère', () => {
    expect(pendingHoldBeats(holdBeats(0), 200_000)).toEqual([]);
  });
});

describe('armHoldChrono', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('annonce chaque repère à son instant', () => {
    armHoldChrono(0, 0);

    vi.advanceTimersByTime(5_000);
    expect(announce).toHaveBeenCalledWith('hold-5');
    expect(announce).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(5_000);
    expect(announce).toHaveBeenLastCalledWith('hold-10');
  });

  // Relâcher tôt ne doit pas laisser un « quarante-cinq » en l'air.
  it('annule tout ce qui reste', () => {
    const cancel = armHoldChrono(0, 0);
    cancel();
    vi.advanceTimersByTime(200_000);
    expect(announce).not.toHaveBeenCalled();
  });
});
