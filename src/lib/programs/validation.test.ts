import { describe, expect, it } from 'vitest';

import { validateProgramDraft, type ProgramDraft } from './validation';

const monday = new Date(2026, 7, 10).getTime();

function draft(overrides: Partial<ProgramDraft> = {}): ProgramDraft {
  return {
    startsAt: monday,
    durationWeeks: 4,
    weeks: [0, 1, 2, 3].map((weekIndex) => ({
      weekIndex,
      prescriptionKind: 'percent_1rm',
      prescriptionValue: 75,
    })),
    scheduleEntries: [{ routineId: 'routine-a', dayOfWeek: 1, order: 1 }],
    ...overrides,
  };
}

describe('validateProgramDraft', () => {
  it('accepts complete weeks, a Monday start, valid prescriptions, and live routines', () => {
    expect(validateProgramDraft(draft(), new Set(['routine-a']))).toEqual([]);
  });

  it('returns stable codes for invalid duration, non-Monday starts, and missing weeks', () => {
    expect(
      validateProgramDraft(
        draft({
          durationWeeks: 3,
          startsAt: new Date(2026, 7, 11).getTime(),
          weeks: [{ weekIndex: 0, prescriptionKind: 'percent_1rm', prescriptionValue: 75 }],
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
            prescriptionKind: 'percent_1rm',
            prescriptionValue: 75,
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
            prescriptionKind: 'percent_1rm',
            prescriptionValue: 75,
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

  it('rejects percent prescriptions outside 1 through 100', () => {
    expect(
      validateProgramDraft(
        draft({
          weeks: [
            { weekIndex: 0, prescriptionKind: 'percent_1rm', prescriptionValue: 0 },
            { weekIndex: 1, prescriptionKind: 'percent_1rm', prescriptionValue: 101 },
            { weekIndex: 2, prescriptionKind: 'percent_1rm', prescriptionValue: 75 },
            { weekIndex: 3, prescriptionKind: 'percent_1rm', prescriptionValue: 75 },
          ],
        }),
        new Set(['routine-a']),
      ),
    ).toEqual(['invalid_percent_1rm']);
  });

  it('accepts percent prescriptions at 1 and 100', () => {
    expect(
      validateProgramDraft(
        draft({
          weeks: [
            { weekIndex: 0, prescriptionKind: 'percent_1rm', prescriptionValue: 1 },
            { weekIndex: 1, prescriptionKind: 'percent_1rm', prescriptionValue: 100 },
            { weekIndex: 2, prescriptionKind: 'percent_1rm', prescriptionValue: 75 },
            { weekIndex: 3, prescriptionKind: 'percent_1rm', prescriptionValue: 75 },
          ],
        }),
        new Set(['routine-a']),
      ),
    ).toEqual([]);
  });

  it('accepts RPE steps from 6 through 10 and rejects values between those steps', () => {
    expect(
      validateProgramDraft(
        draft({
          weeks: [
            { weekIndex: 0, prescriptionKind: 'target_rpe', prescriptionValue: 6 },
            { weekIndex: 1, prescriptionKind: 'target_rpe', prescriptionValue: 7.5 },
            { weekIndex: 2, prescriptionKind: 'target_rpe', prescriptionValue: 10 },
            { weekIndex: 3, prescriptionKind: 'target_rpe', prescriptionValue: 8 },
          ],
        }),
        new Set(['routine-a']),
      ),
    ).toEqual([]);

    expect(
      validateProgramDraft(
        draft({
          weeks: [
            { weekIndex: 0, prescriptionKind: 'target_rpe', prescriptionValue: 5.5 },
            { weekIndex: 1, prescriptionKind: 'target_rpe', prescriptionValue: 8.25 },
            { weekIndex: 2, prescriptionKind: 'target_rpe', prescriptionValue: 10.5 },
            { weekIndex: 3, prescriptionKind: 'target_rpe', prescriptionValue: 8 },
          ],
        }),
        new Set(['routine-a']),
      ),
    ).toEqual(['invalid_target_rpe']);
  });

  it('requires a scheduled session backed by an available routine', () => {
    expect(validateProgramDraft(draft({ scheduleEntries: [] }), new Set())).toEqual([
      'empty_schedule',
    ]);

    expect(validateProgramDraft(draft(), new Set())).toEqual(['missing_routine']);
  });
});
