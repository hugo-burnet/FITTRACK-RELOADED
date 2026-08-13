import { describe, expect, it } from 'vitest';

import { programPosition } from './calendar';
import { pickProgramSession, resolveSchedule, type ProgramSessionCandidate } from './schedule';

const revisions = [
  { id: 'revision-0', effectiveFromWeekIndex: 0 },
  { id: 'revision-2', effectiveFromWeekIndex: 2 },
  { id: 'revision-4', effectiveFromWeekIndex: 4 },
];

describe('resolveSchedule', () => {
  it('uses the latest revision effective for the requested week and orders its entries', () => {
    const entries = [
      {
        id: 'w2-wed-later',
        revisionId: 'revision-2',
        routineId: 'routine-c',
        dayOfWeek: 3,
        order: 2,
      },
      { id: 'w2-mon', revisionId: 'revision-2', routineId: 'routine-a', dayOfWeek: 1, order: 1 },
      {
        id: 'w2-wed-first',
        revisionId: 'revision-2',
        routineId: 'routine-b',
        dayOfWeek: 3,
        order: 1,
      },
      {
        id: 'w2-wed-tie-b',
        revisionId: 'revision-2',
        routineId: 'routine-d',
        dayOfWeek: 3,
        order: 3,
      },
      {
        id: 'w2-wed-tie-a',
        revisionId: 'revision-2',
        routineId: 'routine-e',
        dayOfWeek: 3,
        order: 3,
      },
      { id: 'w4-fri', revisionId: 'revision-4', routineId: 'routine-f', dayOfWeek: 5, order: 1 },
      { id: 'w0-tue', revisionId: 'revision-0', routineId: 'routine-g', dayOfWeek: 2, order: 1 },
    ];

    expect(resolveSchedule(revisions, entries, 3).map((entry) => entry.id)).toEqual([
      'w2-mon',
      'w2-wed-first',
      'w2-wed-later',
      'w2-wed-tie-a',
      'w2-wed-tie-b',
    ]);
  });

  it('returns no entries before the first effective revision', () => {
    expect(resolveSchedule([{ id: 'revision-1', effectiveFromWeekIndex: 1 }], [], 0)).toEqual([]);
  });
});

describe('pickProgramSession', () => {
  const monday = new Date(2026, 7, 10).getTime();
  const thursday = new Date(2026, 7, 13).getTime();

  const position = programPosition(monday, 4, thursday);

  const candidate = (
    entryId: string,
    dayOfWeek: number,
    completed = false,
    order = 1,
  ): ProgramSessionCandidate => ({
    entryId,
    routineId: `routine-${entryId}`,
    weekIndex: 0,
    dayOfWeek,
    order,
    completed,
  });

  it('prefers an incomplete session scheduled today', () => {
    const result = pickProgramSession(
      [
        candidate('missed', 2),
        candidate('today-later', 4, false, 2),
        candidate('today-first', 4),
        candidate('upcoming', 5),
      ],
      position,
      4,
    );

    expect(result).toEqual({ kind: 'today', session: candidate('today-first', 4) });
  });

  it('falls back to the earliest missed session when today is complete', () => {
    const result = pickProgramSession(
      [
        candidate('missed-tuesday', 2),
        candidate('missed-wednesday', 3),
        candidate('today', 4, true),
        candidate('upcoming', 5),
      ],
      position,
      4,
    );

    expect(result).toEqual({ kind: 'missed', session: candidate('missed-tuesday', 2) });
  });

  it('falls forward to an upcoming session when no incomplete session is missed', () => {
    const result = pickProgramSession(
      [
        candidate('missed', 2, true),
        candidate('today', 4, true),
        candidate('friday', 5),
        candidate('saturday', 6),
      ],
      position,
      4,
    );

    expect(result).toEqual({ kind: 'upcoming', session: candidate('friday', 5) });
  });

  it('proposes the next week when the current week is complete', () => {
    const result = pickProgramSession(
      [candidate('monday', 1, true), candidate('thursday', 4, true)],
      position,
      4,
    );

    expect(result).toEqual({ kind: 'next_week', weekIndex: 1 });
  });

  it('returns none outside the active program or after its final week', () => {
    expect(pickProgramSession([], programPosition(monday, 4, monday - 1), 4)).toEqual({
      kind: 'none',
    });
    expect(pickProgramSession([], programPosition(monday, 4, thursday), 1)).toEqual({
      kind: 'none',
    });
  });
});
