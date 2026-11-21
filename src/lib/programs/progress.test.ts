import { describe, expect, it } from 'vitest';
import { programAdherence, programWeeklyTonnage } from './progress';

const revisions = [{ id: 'r0', effectiveFromWeekIndex: 0, createdAt: 1 }];
// Un split lundi / mercredi / vendredi, répété chaque semaine.
const entries = [
  { id: 'mon', revisionId: 'r0', routineId: 'push', dayOfWeek: 1, order: 0 },
  { id: 'wed', revisionId: 'r0', routineId: 'pull', dayOfWeek: 3, order: 1 },
  { id: 'fri', revisionId: 'r0', routineId: 'legs', dayOfWeek: 5, order: 2 },
];

const base = { revisions, entries, durationWeeks: 4 };

describe('programAdherence', () => {
  it('counts the planned sessions of past weeks and of the days before today', () => {
    // Semaine 2 (index 1), jeudi : 3 prévues en semaine 1, lundi et mercredi en semaine 2.
    const result = programAdherence({
      ...base,
      position: { phase: 'active', weekIndex: 1, dayOfWeek: 4 },
      done: [
        { weekIndex: 0, entryId: 'mon' },
        { weekIndex: 0, entryId: 'wed' },
        { weekIndex: 1, entryId: 'mon' },
      ],
    });
    expect(result).toEqual({ doneToDate: 3, plannedToDate: 5, doneTotal: 3, plannedTotal: 12 });
  });

  it('does not count today as missed, but counts it once done', () => {
    const position = { phase: 'active', weekIndex: 0, dayOfWeek: 3 } as const;
    expect(programAdherence({ ...base, position, done: [] })).toMatchObject({
      doneToDate: 0,
      plannedToDate: 1,
    });
    expect(
      programAdherence({ ...base, position, done: [{ weekIndex: 0, entryId: 'wed' }] }),
    ).toMatchObject({ doneToDate: 1, plannedToDate: 2 });
  });

  it('counts a session done earlier than planned, so done never exceeds planned', () => {
    const result = programAdherence({
      ...base,
      position: { phase: 'active', weekIndex: 0, dayOfWeek: 2 },
      done: [{ weekIndex: 0, entryId: 'fri' }],
    });
    expect(result.doneToDate).toBe(1);
    expect(result.plannedToDate).toBe(2);
  });

  it('counts a session once even when it was started twice, and ignores unknown entries', () => {
    const result = programAdherence({
      ...base,
      position: { phase: 'after' },
      done: [
        { weekIndex: 0, entryId: 'mon' },
        { weekIndex: 0, entryId: 'mon' },
        { weekIndex: 0, entryId: 'gone' },
      ],
    });
    expect(result.doneTotal).toBe(1);
  });

  it('is empty before the start and complete after the end', () => {
    expect(programAdherence({ ...base, position: { phase: 'before' }, done: [] })).toEqual({
      doneToDate: 0,
      plannedToDate: 0,
      doneTotal: 0,
      plannedTotal: 12,
    });
    expect(programAdherence({ ...base, position: { phase: 'after' }, done: [] })).toMatchObject({
      plannedToDate: 12,
    });
  });

  it('follows a revision that changes the split from a given week', () => {
    const result = programAdherence({
      revisions: [...revisions, { id: 'r2', effectiveFromWeekIndex: 2, createdAt: 2 }],
      entries: [
        ...entries,
        { id: 'tue', revisionId: 'r2', routineId: 'full', dayOfWeek: 2, order: 0 },
      ],
      durationWeeks: 4,
      position: { phase: 'after' },
      done: [],
    });
    expect(result.plannedTotal).toBe(3 * 2 + 1 * 2);
  });
});

describe('programWeeklyTonnage', () => {
  it('sums the tonnage of each week, with zero for weeks without session', () => {
    expect(
      programWeeklyTonnage(4, [
        { weekIndex: 0, tonnage: 6000 },
        { weekIndex: 0, tonnage: 1000.5 },
        { weekIndex: 2, tonnage: 500 },
      ]),
    ).toEqual([7000.5, 0, 500, 0]);
  });

  it('ignores a session outside the program weeks', () => {
    expect(programWeeklyTonnage(2, [{ weekIndex: 5, tonnage: 100 }])).toEqual([0, 0]);
  });
});
