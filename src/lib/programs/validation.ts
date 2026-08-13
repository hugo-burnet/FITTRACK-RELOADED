import type { ProgramPrescriptionKind } from '@/data/types';

import { isoDayOfWeek } from './calendar';

export type ProgramValidationCode =
  | 'duration_out_of_range'
  | 'start_not_monday'
  | 'missing_week'
  | 'invalid_percent_1rm'
  | 'invalid_target_rpe'
  | 'empty_schedule'
  | 'missing_routine';

export interface ProgramDraftWeek {
  weekIndex: number;
  prescriptionKind: ProgramPrescriptionKind;
  prescriptionValue: number;
}

export interface ProgramDraftScheduleEntry {
  routineId: string;
  dayOfWeek: number;
  order: number;
}

export interface ProgramDraft {
  startsAt: number;
  durationWeeks: number;
  weeks: readonly ProgramDraftWeek[];
  scheduleEntries: readonly ProgramDraftScheduleEntry[];
}

const VALIDATION_ORDER: readonly ProgramValidationCode[] = [
  'duration_out_of_range',
  'start_not_monday',
  'missing_week',
  'invalid_percent_1rm',
  'invalid_target_rpe',
  'empty_schedule',
  'missing_routine',
];

function isValidRpe(value: number): boolean {
  return value >= 6 && value <= 10 && Number.isInteger(value * 2);
}

/** Validates a program draft with stable machine codes only. */
export function validateProgramDraft(
  draft: ProgramDraft,
  availableRoutineIds: ReadonlySet<string>,
): ProgramValidationCode[] {
  const issues = new Set<ProgramValidationCode>();
  const hasValidDuration =
    Number.isInteger(draft.durationWeeks) && draft.durationWeeks >= 4 && draft.durationWeeks <= 12;

  if (!hasValidDuration) issues.add('duration_out_of_range');
  if (isoDayOfWeek(draft.startsAt) !== 1) issues.add('start_not_monday');

  const weekIndices = new Set(draft.weeks.map((week) => week.weekIndex));
  const expectedWeekCount =
    Number.isInteger(draft.durationWeeks) && draft.durationWeeks >= 0
      ? draft.durationWeeks
      : undefined;
  if (
    expectedWeekCount !== undefined &&
    (draft.weeks.length !== expectedWeekCount ||
      Array.from({ length: expectedWeekCount }, (_, weekIndex) => weekIndex).some(
        (weekIndex) => !weekIndices.has(weekIndex),
      ))
  ) {
    issues.add('missing_week');
  }

  if (
    draft.weeks.some(
      (week) =>
        week.prescriptionKind === 'percent_1rm' &&
        (!Number.isFinite(week.prescriptionValue) ||
          week.prescriptionValue < 1 ||
          week.prescriptionValue > 100),
    )
  ) {
    issues.add('invalid_percent_1rm');
  }

  if (
    draft.weeks.some(
      (week) =>
        week.prescriptionKind === 'target_rpe' &&
        (!Number.isFinite(week.prescriptionValue) || !isValidRpe(week.prescriptionValue)),
    )
  ) {
    issues.add('invalid_target_rpe');
  }

  if (draft.scheduleEntries.length === 0) {
    issues.add('empty_schedule');
  } else if (draft.scheduleEntries.some((entry) => !availableRoutineIds.has(entry.routineId))) {
    issues.add('missing_routine');
  }

  return VALIDATION_ORDER.filter((code) => issues.has(code));
}
