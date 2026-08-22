import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { armRepPacer, pendingBeats, repBeats } from './repBeats';

const announce = vi.hoisted(() => vi.fn<(cue: string, when?: number) => boolean>(() => true));

vi.mock('@/audio/announce', () => ({ announce }));

const pacer = { reps: 5, repSeconds: 3, startedAt: 10_000 };

describe('repBeats', () => {
  it('bat une fois par répétition, plus la fin', () => {
    expect(repBeats(pacer).map(({ cue }) => cue)).toEqual([
      'rep-tick',
      'rep-tick',
      'rep-3',
      'rep-2',
      'rep-1',
      'set-done',
    ]);
  });

  it('espace les battements du tempo demandé', () => {
    expect(repBeats(pacer).map(({ at }) => at)).toEqual([
      10_000, 13_000, 16_000, 19_000, 22_000, 25_000,
    ]);
  });

  it('nomme les répétitions même quand la série est courte', () => {
    expect(repBeats({ reps: 2, repSeconds: 3, startedAt: 0 }).map(({ cue }) => cue)).toEqual([
      'rep-2',
      'rep-1',
      'set-done',
    ]);
  });

  it('ne bat pas sans cible de répétitions', () => {
    expect(repBeats({ reps: 0, repSeconds: 3, startedAt: 0 })).toEqual([]);
    expect(repBeats({ reps: 5, repSeconds: 0, startedAt: 0 })).toEqual([]);
  });
});

describe('pendingBeats', () => {
  it('garde ce qui est devant, tolère un réveil un peu tardif', () => {
    const beats = repBeats(pacer);
    expect(pendingBeats(beats, 16_100).map(({ cue }) => cue)).toEqual([
      'rep-3',
      'rep-2',
      'rep-1',
      'set-done',
    ]);
  });
});

describe('armRepPacer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('déroule la série jusqu’à la fin, puis se signale terminée', () => {
    const finished = vi.fn();
    armRepPacer(pacer, finished, 10_000);

    vi.advanceTimersByTime(15_000);
    expect(announce.mock.calls.map(([cue]) => cue)).toEqual([
      'rep-tick',
      'rep-tick',
      'rep-3',
      'rep-2',
      'rep-1',
      'set-done',
    ]);
    expect(finished).toHaveBeenCalledOnce();
  });

  it('n’annonce rien après un arrêt en cours de série', () => {
    const cancel = armRepPacer(pacer, vi.fn(), 10_000);
    vi.advanceTimersByTime(3_500);
    cancel();
    vi.advanceTimersByTime(15_000);

    expect(announce.mock.calls.map(([cue]) => cue)).toEqual(['rep-tick', 'rep-tick']);
  });

  it('prévient la fin quel que soit le cue de clôture', () => {
    const finished = vi.fn();
    armRepPacer({ reps: 1, repSeconds: 1, startedAt: 0 }, finished, 0, 'side-change');

    vi.advanceTimersByTime(1_000);
    expect(announce).toHaveBeenCalledWith('side-change');
    expect(finished).toHaveBeenCalledOnce();
  });
});

describe('le cue de clôture', () => {
  // « Validé. » et « Série terminée. » sont faux au milieu d'une série : sur le
  // premier côté d'une ligne unilatérale, la cadence se ferme autrement.
  it('ferme le premier côté par le changement de côté', () => {
    const beats = repBeats(pacer, 'side-change');

    expect(beats[beats.length - 1]).toEqual({ cue: 'side-change', at: 25_000 });
    expect(beats.some(({ cue }) => cue === 'set-done')).toBe(false);
  });

  it('ferme par la fin de série quand rien n’est précisé', () => {
    expect(repBeats(pacer).at(-1)?.cue).toBe('set-done');
  });
});
