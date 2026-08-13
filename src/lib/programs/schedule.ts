import type { ProgramPosition } from './calendar';

export interface ProgramScheduleRevisionInput {
  id: string;
  effectiveFromWeekIndex: number;
  createdAt: number;
}

export interface ProgramScheduleEntryInput {
  id: string;
  revisionId: string;
  routineId: string;
  dayOfWeek: number;
  order: number;
}

export interface ProgramSessionCandidate {
  entryId: string;
  routineId: string;
  weekIndex: number;
  dayOfWeek: number;
  order: number;
  completed: boolean;
}

export type ProgramSessionPick =
  | { kind: 'today' | 'missed' | 'upcoming'; session: ProgramSessionCandidate }
  | { kind: 'next_week'; weekIndex: number }
  | { kind: 'none' };

function compareScheduleEntries(
  left: Pick<ProgramScheduleEntryInput, 'dayOfWeek' | 'order' | 'id'>,
  right: Pick<ProgramScheduleEntryInput, 'dayOfWeek' | 'order' | 'id'>,
): number {
  return (
    left.dayOfWeek - right.dayOfWeek || left.order - right.order || left.id.localeCompare(right.id)
  );
}

/** Returns the complete split applicable to a program week. */
export function resolveSchedule<
  TRevision extends ProgramScheduleRevisionInput,
  TEntry extends ProgramScheduleEntryInput,
>(revisions: readonly TRevision[], entries: readonly TEntry[], weekIndex: number): TEntry[] {
  let applicableRevision: TRevision | undefined;

  for (const revision of revisions) {
    if (revision.effectiveFromWeekIndex > weekIndex) continue;
    if (
      applicableRevision === undefined ||
      revision.effectiveFromWeekIndex > applicableRevision.effectiveFromWeekIndex ||
      (revision.effectiveFromWeekIndex === applicableRevision.effectiveFromWeekIndex &&
        (revision.createdAt > applicableRevision.createdAt ||
          (revision.createdAt === applicableRevision.createdAt &&
            revision.id.localeCompare(applicableRevision.id) > 0)))
    ) {
      applicableRevision = revision;
    }
  }

  if (applicableRevision === undefined) return [];

  return entries
    .filter((entry) => entry.revisionId === applicableRevision.id)
    .slice()
    .sort(compareScheduleEntries);
}

function compareCandidates(left: ProgramSessionCandidate, right: ProgramSessionCandidate): number {
  return compareScheduleEntries(
    { dayOfWeek: left.dayOfWeek, order: left.order, id: left.entryId },
    { dayOfWeek: right.dayOfWeek, order: right.order, id: right.entryId },
  );
}

function firstCandidate(
  candidates: readonly ProgramSessionCandidate[],
  predicate: (candidate: ProgramSessionCandidate) => boolean,
): ProgramSessionCandidate | undefined {
  return candidates.filter(predicate).slice().sort(compareCandidates)[0];
}

/**
 * Picks one suggested program session from a position calculated by
 * `programPosition`. The returned `next_week` sentinel leaves date resolution
 * to the caller, which owns the program's civil start date.
 */
export function pickProgramSession(
  candidates: readonly ProgramSessionCandidate[],
  position: ProgramPosition,
  durationWeeks: number,
): ProgramSessionPick {
  if (position.phase !== 'active') return { kind: 'none' };

  const unfinishedThisWeek = candidates.filter(
    (candidate) => candidate.weekIndex === position.weekIndex && !candidate.completed,
  );

  const today = firstCandidate(
    unfinishedThisWeek,
    (candidate) => candidate.dayOfWeek === position.dayOfWeek,
  );
  if (today !== undefined) return { kind: 'today', session: today };

  const missed = firstCandidate(
    unfinishedThisWeek,
    (candidate) => candidate.dayOfWeek < position.dayOfWeek,
  );
  if (missed !== undefined) return { kind: 'missed', session: missed };

  const upcoming = firstCandidate(
    unfinishedThisWeek,
    (candidate) => candidate.dayOfWeek > position.dayOfWeek,
  );
  if (upcoming !== undefined) return { kind: 'upcoming', session: upcoming };

  const nextWeekIndex = position.weekIndex + 1;
  if (nextWeekIndex < durationWeeks) return { kind: 'next_week', weekIndex: nextWeekIndex };

  return { kind: 'none' };
}
