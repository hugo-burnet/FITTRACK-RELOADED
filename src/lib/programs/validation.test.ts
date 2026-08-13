import { describe, expect, it } from 'vitest';

import { validateProgramDraft, type ProgramDraft } from './validation';

const monday = new Date(2026, 7, 10).getTime();

function draft(overrides: Partial<ProgramDraft> = {}): ProgramDraft {
  return {
    startsAt: monday,
    durationWeeks: 4,
    weeks: [0, 1, 2, 3].map((weekIndex) => ({
      weekIndex,
      loadIndex: 100,
      phase: 'construction' as const,
    })),
    scheduleEntries: [{ routineId: 'routine-a', dayOfWeek: 1, order: 1 }],
    ...overrides,
  };
}

describe('validateProgramDraft', () => {
  it('accepts complete weeks, a Monday start, valid loadIndex/phase, and live routines', () => {
    expect(validateProgramDraft(draft(), new Set(['routine-a']))).toEqual([]);
  });

  it('returns stable codes for invalid duration, non-Monday starts, and missing weeks', () => {
    expect(
      validateProgramDraft(
        draft({
          durationWeeks: 3,
          startsAt: new Date(2026, 7, 11).getTime(),
          weeks: [{ weekIndex: 0, loadIndex: 100, phase: 'construction' }],
        }),
        new Set(['routine-a']),
      ),
    ).toEqual(['duration_out_of_range', 'start_not_monday', 'missing_week']);
  });

  it('does not call complete out-of-range durations a missing week', () => {
    expect(
      validateProgramDraft(
        draft({
          durationWeeks: 3,
          weeks: [0, 1, 2].map((weekIndex) => ({
            weekIndex,
            loadIndex: 100,
            phase: 'construction' as const,
          })),
        }),
        new Set(['routine-a']),
      ),
    ).toEqual(['duration_out_of_range']);
  });

  it('accepts the duration boundaries of 4 and 12 weeks', () => {
    expect(validateProgramDraft(draft(), new Set(['routine-a']))).toEqual([]);
    expect(
      validateProgramDraft(
        draft({
          durationWeeks: 12,
          weeks: Array.from({ length: 12 }, (_, weekIndex) => ({
            weekIndex,
            loadIndex: 100,
            phase: 'construction' as const,
          })),
        }),
        new Set(['routine-a']),
      ),
    ).toEqual([]);
  });

  it('rejects a non-integer duration without treating its complete declared weeks as missing', () => {
    expect(validateProgramDraft(draft({ durationWeeks: 4.5 }), new Set(['routine-a']))).toEqual([
      'duration_out_of_range',
    ]);
  });

  it('rejects non-integer, non-finite, or out-of-bounds loadIndex', () => {
    expect(
      validateProgramDraft(
        draft({
          weeks: [
            { weekIndex: 0, loadIndex: 100.5, phase: 'construction' },
            { weekIndex: 1, loadIndex: 100, phase: 'construction' },
            { weekIndex: 2, loadIndex: 100, phase: 'construction' },
            { weekIndex: 3, loadIndex: 100, phase: 'construction' },
          ],
        }),
        new Set(['routine-a']),
      ),
    ).toEqual(['invalid_load_index']);

    expect(
      validateProgramDraft(
        draft({
          weeks: [
            { weekIndex: 0, loadIndex: Number.NaN, phase: 'construction' },
            { weekIndex: 1, loadIndex: 100, phase: 'construction' },
            { weekIndex: 2, loadIndex: 100, phase: 'construction' },
            { weekIndex: 3, loadIndex: 100, phase: 'construction' },
          ],
        }),
        new Set(['routine-a']),
      ),
    ).toEqual(['invalid_load_index']);

    expect(
      validateProgramDraft(
        draft({
          weeks: [
            { weekIndex: 0, loadIndex: 0, phase: 'construction' },
            { weekIndex: 1, loadIndex: 100, phase: 'construction' },
            { weekIndex: 2, loadIndex: 100, phase: 'construction' },
            { weekIndex: 3, loadIndex: 100, phase: 'construction' },
          ],
        }),
        new Set(['routine-a']),
      ),
    ).toEqual(['invalid_load_index']);

    expect(
      validateProgramDraft(
        draft({
          weeks: [
            { weekIndex: 0, loadIndex: -30, phase: 'construction' },
            { weekIndex: 1, loadIndex: 100, phase: 'construction' },
            { weekIndex: 2, loadIndex: 100, phase: 'construction' },
            { weekIndex: 3, loadIndex: 100, phase: 'construction' },
          ],
        }),
        new Set(['routine-a']),
      ),
    ).toEqual(['invalid_load_index']);

    expect(
      validateProgramDraft(
        draft({
          weeks: [
            { weekIndex: 0, loadIndex: 201, phase: 'construction' },
            { weekIndex: 1, loadIndex: 100, phase: 'construction' },
            { weekIndex: 2, loadIndex: 100, phase: 'construction' },
            { weekIndex: 3, loadIndex: 100, phase: 'construction' },
          ],
        }),
        new Set(['routine-a']),
      ),
    ).toEqual(['invalid_load_index']);
  });

  it('accepts integer loadIndex from 1 through 200 including above 100 and deload phases', () => {
    expect(
      validateProgramDraft(
        draft({
          weeks: [
            { weekIndex: 0, loadIndex: 1, phase: 'construction' },
            { weekIndex: 1, loadIndex: 105, phase: 'progression' },
            { weekIndex: 2, loadIndex: 110, phase: 'overload' },
            { weekIndex: 3, loadIndex: 60, phase: 'deload' },
          ],
        }),
        new Set(['routine-a']),
      ),
    ).toEqual([]);
  });

  it('rejects phases outside the enum', () => {
    expect(
      validateProgramDraft(
        draft({
          weeks: [
            { weekIndex: 0, loadIndex: 100, phase: 'construction' },
            { weekIndex: 1, loadIndex: 100, phase: 'not_a_phase' as 'construction' },
            { weekIndex: 2, loadIndex: 100, phase: 'construction' },
            { weekIndex: 3, loadIndex: 100, phase: 'construction' },
          ],
        }),
        new Set(['routine-a']),
      ),
    ).toEqual(['invalid_phase']);
  });

  it('requires a scheduled session backed by an available routine', () => {
    expect(validateProgramDraft(draft({ scheduleEntries: [] }), new Set())).toEqual([
      'empty_schedule',
    ]);

    expect(validateProgramDraft(draft(), new Set())).toEqual(['missing_routine']);
  });
});
