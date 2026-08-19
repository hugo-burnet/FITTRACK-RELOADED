import { describe, expect, it } from 'vitest';
import { groupWeekRuns } from './weekRuns';
import type { ProgramWeekReading } from './weekRuns';

const week = (
  weekIndex: number,
  over: Partial<ProgramWeekReading> = {},
): ProgramWeekReading => ({
  weekIndex,
  loadIndex: 100,
  phase: 'construction',
  ...over,
});

describe('groupWeekRuns', () => {
  it('replie une suite identique en une seule ligne', () => {
    const runs = groupWeekRuns([week(0), week(1), week(2), week(3)]);

    expect(runs).toEqual([
      { weekIndex: 0, lastWeekIndex: 3, loadIndex: 100, phase: 'construction' },
    ]);
  });

  it('coupe sur le moindre changement de niveau ou de phase', () => {
    const runs = groupWeekRuns([
      week(0),
      week(1),
      week(2, { loadIndex: 105, phase: 'progression' }),
      week(3, { loadIndex: 60, phase: 'deload' }),
    ]);

    expect(runs.map((run) => [run.weekIndex, run.lastWeekIndex])).toEqual([
      [0, 1],
      [2, 2],
      [3, 3],
    ]);
    expect(runs[2]?.phase).toBe('deload');
  });

  it('ne fusionne pas par-dessus une semaine absente', () => {
    // Une plage « 01–04 » qui saute la 03 mentirait sur ce qu'elle couvre.
    const runs = groupWeekRuns([week(0), week(1), week(3)]);

    expect(runs.map((run) => [run.weekIndex, run.lastWeekIndex])).toEqual([
      [0, 1],
      [3, 3],
    ]);
  });

  it('trie avant de replier', () => {
    const runs = groupWeekRuns([week(2), week(0), week(1)]);

    expect(runs).toHaveLength(1);
    expect(runs[0]?.lastWeekIndex).toBe(2);
  });

  it('ne rend rien pour une liste vide', () => {
    expect(groupWeekRuns([])).toEqual([]);
  });
});
