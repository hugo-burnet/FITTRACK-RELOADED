import { describe, expect, it } from 'vitest';

import { programPosition } from './calendar';
import {
  MAX_CYCLE_WEEKS,
  cycleLength,
  cyclePosition,
  entryCycleWeek,
  pickProgramSession,
  resolveRevision,
  resolveSchedule,
  resolveSplitFrom,
  type ProgramSessionCandidate,
} from './schedule';

const revisions = [
  { id: 'revision-0', effectiveFromWeekIndex: 0, createdAt: 10 },
  { id: 'revision-2', effectiveFromWeekIndex: 2, createdAt: 20 },
  { id: 'revision-4', effectiveFromWeekIndex: 4, createdAt: 30 },
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
    expect(
      resolveSchedule([{ id: 'revision-1', effectiveFromWeekIndex: 1, createdAt: 10 }], [], 0),
    ).toEqual([]);
  });

  it('prefers the newest revision created for the same effective week', () => {
    const entries = [
      {
        id: 'older-entry',
        revisionId: 'z-older',
        routineId: 'routine-old',
        dayOfWeek: 1,
        order: 1,
      },
      {
        id: 'newer-entry',
        revisionId: 'a-newer',
        routineId: 'routine-new',
        dayOfWeek: 1,
        order: 1,
      },
    ];

    expect(
      resolveSchedule(
        [
          { id: 'z-older', effectiveFromWeekIndex: 2, createdAt: 100 },
          { id: 'a-newer', effectiveFromWeekIndex: 2, createdAt: 200 },
        ],
        entries,
        2,
      ).map((entry) => entry.id),
    ).toEqual(['newer-entry']);
  });

  it('uses the greatest id only when effective week and creation time are equal', () => {
    const entries = [
      {
        id: 'a-entry',
        revisionId: 'a-revision',
        routineId: 'routine-a',
        dayOfWeek: 1,
        order: 1,
      },
      {
        id: 'z-entry',
        revisionId: 'z-revision',
        routineId: 'routine-z',
        dayOfWeek: 1,
        order: 1,
      },
    ];

    expect(
      resolveSchedule(
        [
          { id: 'a-revision', effectiveFromWeekIndex: 2, createdAt: 100 },
          { id: 'z-revision', effectiveFromWeekIndex: 2, createdAt: 100 },
        ],
        entries,
        2,
      ).map((entry) => entry.id),
    ).toEqual(['z-entry']);
  });
});

/**
 * Un cycle de deux semaines : quatre séances « haut / bas » la première, six
 * « push / pull / jambes » la seconde. Le cas qui a fait écrire le cycle — un
 * split hebdomadaire ne sait pas dire « une semaine sur deux ».
 */
describe('a split that spans several weeks', () => {
  const cycle = { id: 'cycle', effectiveFromWeekIndex: 0, createdAt: 10, cycleWeeks: 2 };

  const entry = (id: string, cycleWeek: number, dayOfWeek: number, order = 0) => ({
    id,
    revisionId: 'cycle',
    routineId: `routine-${id}`,
    dayOfWeek,
    order,
    cycleWeek,
  });

  const entries = [
    entry('ppl-push', 1, 1),
    entry('ul-upper-a', 0, 1),
    entry('ppl-pull', 1, 2),
    entry('ul-lower-a', 0, 2),
    entry('ul-upper-b', 0, 4),
    entry('ppl-legs', 1, 3),
  ];

  const idsAt = (weekIndex: number, revisions = [cycle]) =>
    resolveSchedule(revisions, entries, weekIndex).map((row) => row.id);

  it('plays the weeks of the cycle in turn, over and over', () => {
    expect(idsAt(0)).toEqual(['ul-upper-a', 'ul-lower-a', 'ul-upper-b']);
    expect(idsAt(1)).toEqual(['ppl-push', 'ppl-pull', 'ppl-legs']);
    expect(idsAt(2)).toEqual(idsAt(0));
    expect(idsAt(3)).toEqual(idsAt(1));
    expect(idsAt(11)).toEqual(idsAt(1));
  });

  it('counts the cycle from the week its revision takes effect, not from the block', () => {
    const later = { ...cycle, effectiveFromWeekIndex: 3 };

    // Semaine 4 du bloc : la première semaine du cycle, quelle que soit sa parité.
    expect(idsAt(3, [later])).toEqual(['ul-upper-a', 'ul-lower-a', 'ul-upper-b']);
    expect(idsAt(4, [later])).toEqual(['ppl-push', 'ppl-pull', 'ppl-legs']);
    expect(idsAt(5, [later])).toEqual(['ul-upper-a', 'ul-lower-a', 'ul-upper-b']);
  });

  it('reads a row written before cycles as a one-week split that repeats', () => {
    const legacyRevision = { id: 'old', effectiveFromWeekIndex: 0, createdAt: 1 };
    const legacyEntries = [
      { id: 'mon', revisionId: 'old', routineId: 'a', dayOfWeek: 1, order: 0 },
      { id: 'thu', revisionId: 'old', routineId: 'b', dayOfWeek: 4, order: 0 },
    ];

    for (const weekIndex of [0, 1, 2, 5]) {
      expect(
        resolveSchedule([legacyRevision], legacyEntries, weekIndex).map((row) => row.id),
      ).toEqual(['mon', 'thu']);
    }
  });

  it('lets a week of the cycle hold no session at all — a rest week', () => {
    const threeWeeks = { ...cycle, cycleWeeks: 3 };

    expect(idsAt(2, [threeWeeks])).toEqual([]);
    expect(idsAt(3, [threeWeeks])).toEqual(idsAt(0, [threeWeeks]));
  });

  it('never shows a session filed under a week the cycle does not have', () => {
    const stray = [...entries, entry('stray', 5, 1)];

    for (let weekIndex = 0; weekIndex < 8; weekIndex += 1) {
      expect(
        resolveSchedule([cycle], stray, weekIndex).some((row) => row.id === 'stray'),
      ).toBe(false);
    }
  });

  it('falls back to a single week when the cycle length is not a positive integer', () => {
    for (const cycleWeeks of [0, -2, 1.5, Number.NaN]) {
      expect(cycleLength({ cycleWeeks })).toBe(1);
    }
    expect(cycleLength({})).toBe(1);
    expect(cycleLength({ cycleWeeks: 3 })).toBe(3);
  });

  it('files a session without a cycle week under the first week', () => {
    expect(entryCycleWeek({})).toBe(0);
    expect(entryCycleWeek({ cycleWeek: -1 })).toBe(0);
    expect(entryCycleWeek({ cycleWeek: 1.5 })).toBe(0);
    expect(entryCycleWeek({ cycleWeek: 2 })).toBe(2);
  });

  it('gives a position that stays inside the cycle, even for a week before the revision', () => {
    const from3 = { ...cycle, effectiveFromWeekIndex: 3 };

    expect(cyclePosition(from3, 3)).toBe(0);
    expect(cyclePosition(from3, 4)).toBe(1);
    expect(cyclePosition(from3, 7)).toBe(0);
    expect(cyclePosition(from3, 2)).toBe(1);
  });

  it('caps the cycle at four weeks', () => {
    expect(MAX_CYCLE_WEEKS).toBe(4);
  });
});

describe('resolveRevision', () => {
  const revisions = [
    { id: 'first', effectiveFromWeekIndex: 0, createdAt: 10, cycleWeeks: 2 },
    { id: 'second', effectiveFromWeekIndex: 4, createdAt: 20 },
  ];
  const entries = [
    { id: 'b-wed', revisionId: 'first', routineId: 'b', dayOfWeek: 3, order: 0, cycleWeek: 1 },
    { id: 'a-mon', revisionId: 'first', routineId: 'a', dayOfWeek: 1, order: 0, cycleWeek: 0 },
    { id: 'b-mon', revisionId: 'first', routineId: 'c', dayOfWeek: 1, order: 0, cycleWeek: 1 },
    { id: 'later', revisionId: 'second', routineId: 'd', dayOfWeek: 2, order: 0 },
  ];

  it('returns every week of the cycle, ordered week then day', () => {
    const resolved = resolveRevision(revisions, entries, 3);

    expect(resolved?.revision.id).toBe('first');
    expect(resolved?.entries.map((row) => row.id)).toEqual(['a-mon', 'b-mon', 'b-wed']);
  });

  it('follows the revision that applies to the week', () => {
    expect(resolveRevision(revisions, entries, 4)?.entries.map((row) => row.id)).toEqual([
      'later',
    ]);
  });

  it('returns null before the first revision', () => {
    expect(resolveRevision([{ id: 'x', effectiveFromWeekIndex: 2, createdAt: 1 }], [], 0)).toBeNull();
  });
});

describe('resolveSplitFrom', () => {
  const revisions = [{ id: 'cycle', effectiveFromWeekIndex: 0, createdAt: 10, cycleWeeks: 2 }];
  const entries = [
    { id: 'ul', revisionId: 'cycle', routineId: 'upper-a', dayOfWeek: 1, order: 0, cycleWeek: 0 },
    { id: 'ppl', revisionId: 'cycle', routineId: 'push-a', dayOfWeek: 1, order: 0, cycleWeek: 1 },
  ];

  it('keeps the cycle as written when the week is one the cycle starts on', () => {
    const split = resolveSplitFrom(revisions, entries, 2);

    expect(split.cycleWeeks).toBe(2);
    expect(split.entries.map(({ id, cycleWeek }) => [id, cycleWeek])).toEqual([
      ['ul', 0],
      ['ppl', 1],
    ]);
  });

  it('turns the cycle so the requested week comes first', () => {
    // La semaine 4 du bloc (index 3) joue « ppl » : écrite à partir de là, une
    // nouvelle révision doit commencer par lui et finir par « ul ».
    const split = resolveSplitFrom(revisions, entries, 3);

    expect(split.entries.map(({ id, cycleWeek }) => [id, cycleWeek])).toEqual([
      ['ppl', 0],
      ['ul', 1],
    ]);
  });

  it('reproduces, week for week, what the original revision played', () => {
    const rebuilt = resolveSplitFrom(revisions, entries, 3);
    const rewritten = [
      { id: 'next', effectiveFromWeekIndex: 3, createdAt: 99, cycleWeeks: rebuilt.cycleWeeks },
    ];
    const rewrittenEntries = rebuilt.entries.map((row) => ({ ...row, revisionId: 'next' }));

    for (let weekIndex = 3; weekIndex < 10; weekIndex += 1) {
      const before = resolveSchedule(revisions, entries, weekIndex).map((row) => row.routineId);
      const after = resolveSchedule(rewritten, rewrittenEntries, weekIndex).map(
        (row) => row.routineId,
      );
      expect(after).toEqual(before);
    }
  });

  it('drops a session filed under a week the cycle does not have', () => {
    const stray = [
      ...entries,
      { id: 'stray', revisionId: 'cycle', routineId: 'x', dayOfWeek: 1, order: 0, cycleWeek: 7 },
    ];

    expect(resolveSplitFrom(revisions, stray, 0).entries.map((row) => row.id)).toEqual([
      'ul',
      'ppl',
    ]);
  });

  it('answers an empty one-week split when no revision applies yet', () => {
    expect(resolveSplitFrom([], [], 0)).toEqual({ cycleWeeks: 1, entries: [] });
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
