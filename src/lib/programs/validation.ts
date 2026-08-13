import { PROGRAM_PHASES, type ProgramPhase } from '@/data/types';

import { isoDayOfWeek } from './calendar';

/** Display bounds for loadIndex — narrative, not a load operator. */
export const MIN_LOAD_INDEX = 1;
export const MAX_LOAD_INDEX = 200;

export type ProgramValidationCode =
  | 'duration_out_of_range'
  | 'start_not_monday'
  | 'missing_week'
  | 'invalid_load_index'
  | 'invalid_phase'
  | 'empty_schedule'
  | 'missing_routine';

export interface ProgramDraftWeek {
  weekIndex: number;
  loadIndex: number;
  phase: ProgramPhase;
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
  'invalid_load_index',
  'invalid_phase',
  'empty_schedule',
  'missing_routine',
];

const PHASE_SET = new Set<string>(PROGRAM_PHASES);

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
        !Number.isFinite(week.loadIndex) ||
        !Number.isInteger(week.loadIndex) ||
        week.loadIndex < MIN_LOAD_INDEX ||
        week.loadIndex > MAX_LOAD_INDEX,
    )
  ) {
    issues.add('invalid_load_index');
  }

  if (draft.weeks.some((week) => !PHASE_SET.has(week.phase))) {
    issues.add('invalid_phase');
  }

  if (draft.scheduleEntries.length === 0) {
    issues.add('empty_schedule');
  } else if (draft.scheduleEntries.some((entry) => !availableRoutineIds.has(entry.routineId))) {
    issues.add('missing_routine');
  }

  return VALIDATION_ORDER.filter((code) => issues.has(code));
}
