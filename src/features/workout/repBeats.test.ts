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
});
