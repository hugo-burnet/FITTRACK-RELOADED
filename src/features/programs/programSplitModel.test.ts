import { describe, expect, it } from 'vitest';
import type { ProgramDetail } from '@/data/repositories/programs';
import {
  addFolderSessions,
  addSplitSession,
  emptySplit,
  orderedSplit,
  resizeCycle,
  splitFolderChoices,
  splitForWeek,
  splitIssue,
} from './programSplitModel';
import type { ProgramSplitDraft, ProgramSplitDraftEntry } from './ProgramSplitStep';

const session = (
  routineId: string,
  cycleWeek: number,
  dayOfWeek = 1,
  order = 0,
): ProgramSplitDraftEntry => ({ routineId, dayOfWeek, order, cycleWeek });

describe('emptySplit', () => {
  it('starts as one empty session of a one-week split', () => {
    expect(emptySplit()).toEqual({
      cycleWeeks: 1,
      entries: [{ routineId: '', dayOfWeek: 1, order: 0, cycleWeek: 0 }],
    });
  });
});

describe('orderedSplit', () => {
  it('renumbers the order per weekday inside each week of the cycle', () => {
    const ordered = orderedSplit([
      session('a', 0, 1),
      session('b', 0, 1),
      session('c', 1, 1),
      session('d', 1, 1),
      session('e', 1, 3),
    ]);

    // Lundi de la semaine 1 et lundi de la semaine 2 sont deux lundis : le
    // rang repart de zéro dans chaque semaine du cycle.
    expect(ordered.map(({ routineId, order }) => [routineId, order])).toEqual([
      ['a', 0],
      ['b', 1],
      ['c', 0],
      ['d', 1],
      ['e', 0],
    ]);
  });
});

describe('resizeCycle', () => {
  const split: ProgramSplitDraft = {
    cycleWeeks: 3,
    entries: [session('a', 0), session('b', 1), session('c', 2), session('d', 2, 4)],
  };

  it('keeps every session when the cycle grows', () => {
    const grown = resizeCycle({ cycleWeeks: 2, entries: split.entries.slice(0, 2) }, 3);

    expect(grown.cycleWeeks).toBe(3);
    expect(grown.entries.map((entry) => entry.routineId)).toEqual(['a', 'b']);
  });

  it('folds the sessions of the weeks that disappear into the last remaining week', () => {
    const shrunk = resizeCycle(split, 2);

    expect(shrunk.cycleWeeks).toBe(2);
    expect(shrunk.entries.map(({ routineId, cycleWeek }) => [routineId, cycleWeek])).toEqual([
      ['a', 0],
      ['b', 1],
      ['c', 1],
      ['d', 1],
    ]);
  });

  it('folds everything into the single week of a weekly split, in the order they were listed', () => {
    const weekly = resizeCycle(split, 1);

    expect(weekly.entries.map(({ routineId, cycleWeek }) => [routineId, cycleWeek])).toEqual([
      ['a', 0],
      ['b', 0],
      ['c', 0],
      ['d', 0],
    ]);
  });
});

describe('addSplitSession', () => {
  const split: ProgramSplitDraft = {
    cycleWeeks: 2,
    entries: [session('a', 0), session('b', 0, 2), session('c', 1)],
  };

  it('files the new session at the end of the week it was added to', () => {
    const next = addSplitSession(split, 0);

    expect(next.entries.map(({ routineId, cycleWeek }) => [routineId, cycleWeek])).toEqual([
      ['a', 0],
      ['b', 0],
      ['', 0],
      ['c', 1],
    ]);
    expect(next.entries[2]).toEqual({ routineId: '', dayOfWeek: 1, order: 0, cycleWeek: 0 });
  });

  it('appends to the last week', () => {
    const next = addSplitSession(split, 1);

    expect(next.entries.map(({ routineId, cycleWeek }) => [routineId, cycleWeek])).toEqual([
      ['a', 0],
      ['b', 0],
      ['c', 1],
      ['', 1],
    ]);
  });

  it('puts the first session of an empty week after the weeks before it', () => {
    const next = addSplitSession(
      { cycleWeeks: 3, entries: [session('a', 0), session('c', 2)] },
      1,
    );

    expect(next.entries.map(({ routineId, cycleWeek }) => [routineId, cycleWeek])).toEqual([
      ['a', 0],
      ['', 1],
      ['c', 2],
    ]);
  });

  it('leaves the cycle length alone', () => {
    expect(addSplitSession(split, 1).cycleWeeks).toBe(2);
  });
});

describe('addFolderSessions', () => {
  const summary = (entries: ProgramSplitDraftEntry[]) =>
    entries.map(({ routineId, cycleWeek, dayOfWeek }) => [routineId, cycleWeek, dayOfWeek]);

  it('replaces the empty placeholder of the week and spreads the routines over consecutive days', () => {
    const next = addFolderSessions(emptySplit(), 0, ['upper-a', 'lower-a', 'upper-b']);

    expect(summary(next.entries)).toEqual([
      ['upper-a', 0, 1],
      ['lower-a', 0, 2],
      ['upper-b', 0, 3],
    ]);
  });

  it('starts the day after the last one the week already uses', () => {
    const split: ProgramSplitDraft = {
      cycleWeeks: 1,
      entries: [session('a', 0, 1), session('b', 0, 4)],
    };

    expect(summary(addFolderSessions(split, 0, ['c', 'd']).entries)).toEqual([
      ['a', 0, 1],
      ['b', 0, 4],
      ['c', 0, 5],
      ['d', 0, 6],
    ]);
  });

  it('comes back to Monday after Sunday, and lets two sessions share a day', () => {
    const ids = ['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8'];

    expect(summary(addFolderSessions(emptySplit(), 0, ids).entries).map(([, , day]) => day)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 1,
    ]);
    expect(
      summary(
        addFolderSessions({ cycleWeeks: 1, entries: [session('a', 0, 7)] }, 0, ['b']).entries,
      ),
    ).toEqual([
      ['a', 0, 7],
      ['b', 0, 1],
    ]);
  });

  it('files the folder under the week it was added to, the list staying sorted by week', () => {
    const split: ProgramSplitDraft = {
      cycleWeeks: 2,
      entries: [session('a', 0, 1), session('b', 1, 1)],
    };

    expect(summary(addFolderSessions(split, 0, ['c']).entries)).toEqual([
      ['a', 0, 1],
      ['c', 0, 2],
      ['b', 1, 1],
    ]);
    expect(summary(addFolderSessions(split, 1, ['c']).entries)).toEqual([
      ['a', 0, 1],
      ['b', 1, 1],
      ['c', 1, 2],
    ]);
  });

  it('only replaces the placeholders of the week it fills', () => {
    const split: ProgramSplitDraft = {
      cycleWeeks: 2,
      entries: [session('', 0), session('', 1)],
    };

    const next = addFolderSessions(split, 1, ['push-a', 'pull-a']);

    expect(summary(next.entries)).toEqual([
      ['', 0, 1],
      ['push-a', 1, 1],
      ['pull-a', 1, 2],
    ]);
  });

  it('keeps the sessions already filled in when a placeholder sits among them', () => {
    const split: ProgramSplitDraft = {
      cycleWeeks: 1,
      entries: [session('a', 0, 2), session('', 0, 3)],
    };

    expect(summary(addFolderSessions(split, 0, ['b']).entries)).toEqual([
      ['a', 0, 2],
      ['b', 0, 3],
    ]);
  });

  it('leaves the split alone for a folder without routine', () => {
    const split = emptySplit();

    expect(addFolderSessions(split, 0, [])).toBe(split);
  });

  it('keeps the length of the cycle and the draft it was given', () => {
    const split: ProgramSplitDraft = { cycleWeeks: 3, entries: [session('a', 0)] };

    const next = addFolderSessions(split, 2, ['b']);

    expect(next.cycleWeeks).toBe(3);
    expect(split.entries).toHaveLength(1);
  });
});

describe('splitFolderChoices', () => {
  const folder = (id: string, name: string) => ({ id, name });
  const routine = (id: string, folderId: string, order: number) => ({
    routine: { id, folderId, order },
  });

  it('lists the folders in library order, each with its routines in their own order', () => {
    const choices = splitFolderChoices(
      [folder('ul', 'UL'), folder('ppl', "PPL 45'")],
      [
        routine('push-a', 'ppl', 0),
        routine('lower-a', 'ul', 5),
        routine('upper-a', 'ul', 1),
        routine('pull-a', 'ppl', 3),
      ],
    );

    expect(choices).toEqual([
      { folderId: 'ul', name: 'UL', routineIds: ['upper-a', 'lower-a'] },
      { folderId: 'ppl', name: "PPL 45'", routineIds: ['push-a', 'pull-a'] },
    ]);
  });

  it('leaves out a folder that has no routine', () => {
    const choices = splitFolderChoices(
      [folder('ul', 'UL'), folder('empty', 'Vide')],
      [routine('upper-a', 'ul', 0)],
    );

    expect(choices.map((choice) => choice.folderId)).toEqual(['ul']);
  });

  it('adds the routines without folder last, once folders exist', () => {
    const choices = splitFolderChoices(
      [folder('ul', 'UL')],
      [routine('free', '', 0), routine('upper-a', 'ul', 1)],
    );

    expect(choices).toEqual([
      { folderId: 'ul', name: 'UL', routineIds: ['upper-a'] },
      { folderId: '', name: null, routineIds: ['free'] },
    ]);
  });

  it('offers nothing when no folder exists: every routine is then "without folder"', () => {
    expect(splitFolderChoices([], [routine('free', '', 0)])).toEqual([]);
  });
});

describe('splitIssue', () => {
  it('accepts a complete split', () => {
    expect(splitIssue({ cycleWeeks: 2, entries: [session('a', 0), session('b', 1)] })).toBeNull();
  });

  it('accepts a cycle week left without any session while another has some', () => {
    expect(splitIssue({ cycleWeeks: 2, entries: [session('a', 0)] })).toBeNull();
  });

  it('refuses a split without session, or with a session still without routine', () => {
    expect(splitIssue({ cycleWeeks: 1, entries: [] })).toBe('program.errorSplit');
    expect(splitIssue({ cycleWeeks: 1, entries: [session('', 0)] })).toBe('program.errorSplit');
  });

  it('refuses a session filed under a week the cycle does not have', () => {
    expect(splitIssue({ cycleWeeks: 2, entries: [session('a', 2)] })).toBe('program.errorSplit');
    expect(splitIssue({ cycleWeeks: 2, entries: [session('a', -1)] })).toBe('program.errorSplit');
  });
});

describe('splitForWeek', () => {
  const STAMPS = { createdAt: 1, updatedAt: 1, deletedAt: 0 };
  const detail: ProgramDetail = {
    program: {
      id: 'p',
      ...STAMPS,
      name: 'Haut / bas puis PPL',
      startsAt: 0,
      durationWeeks: 8,
      status: 'draft',
    },
    weeks: [],
    revisions: [
      {
        revision: {
          id: 'rev',
          ...STAMPS,
          programId: 'p',
          effectiveFromWeekIndex: 0,
          cycleWeeks: 2,
        },
        entries: [
          { id: 'ul', ...STAMPS, revisionId: 'rev', routineId: 'upper', dayOfWeek: 1, order: 0, cycleWeek: 0 },
          { id: 'ppl', ...STAMPS, revisionId: 'rev', routineId: 'push', dayOfWeek: 1, order: 0, cycleWeek: 1 },
        ],
      },
    ],
  };

  it('reads the cycle as written for a week the cycle starts on', () => {
    const split = splitForWeek(detail, 2);

    expect(split.cycleWeeks).toBe(2);
    expect(split.entries.map(({ routineId, cycleWeek }) => [routineId, cycleWeek])).toEqual([
      ['upper', 0],
      ['push', 1],
    ]);
  });

  it('turns the cycle so the week being edited comes first', () => {
    // La semaine 4 du bloc joue « push » : écrite à partir de là, la révision
    // doit commencer par lui, sinon l'enregistrer décalerait tout le cycle.
    const split = splitForWeek(detail, 3);

    expect(split.entries.map(({ routineId, cycleWeek }) => [routineId, cycleWeek])).toEqual([
      ['push', 0],
      ['upper', 1],
    ]);
  });

  it('answers an empty weekly split when the block has no revision yet', () => {
    expect(splitForWeek({ ...detail, revisions: [] }, 0)).toEqual(emptySplit());
  });

  it('reads a block written before cycles as a weekly split', () => {
    const legacy: ProgramDetail = {
      ...detail,
      revisions: [
        {
          revision: { id: 'old', ...STAMPS, programId: 'p', effectiveFromWeekIndex: 0 },
          entries: [
            { id: 'e', ...STAMPS, revisionId: 'old', routineId: 'upper', dayOfWeek: 2, order: 0 },
          ],
        },
      ],
    };

    expect(splitForWeek(legacy, 5)).toEqual({
      cycleWeeks: 1,
      entries: [{ routineId: 'upper', dayOfWeek: 2, order: 0, cycleWeek: 0 }],
    });
  });
});
