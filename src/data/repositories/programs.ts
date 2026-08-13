import { db } from '@/data/db';
import type {
  Program,
  ProgramScheduleEntry,
  ProgramScheduleRevision,
  ProgramWeek,
  Workout,
} from '@/data/types';
import {
  programPosition,
  resolveSchedule,
  type ProgramPosition,
} from '@/lib/programs';
import { alive } from './base';

export {
  ProgramRepositoryError,
  activateProgram,
  completeProgram,
  createProgramDraft,
  deleteProgram,
  replaceActiveProgram,
  shiftProgram,
  updateProgramDraft,
} from './programLifecycle';
export type {
  CreateProgramDraftInput,
  ProgramRepositoryErrorCode,
} from './programLifecycle';
export { createScheduleRevision, replaceProgramWeeks } from './programSchedules';
export type { ProgramScheduleEntryDraft, ProgramWeekInput } from './programSchedules';

export interface ProgramScheduleRevisionDetail {
  revision: ProgramScheduleRevision;
  entries: ProgramScheduleEntry[];
}

export interface ProgramDetail {
  program: Program;
  weeks: ProgramWeek[];
  revisions: ProgramScheduleRevisionDetail[];
}

export interface ProgramSummary {
  program: Program;
}

export interface ActiveProgramDetail extends ProgramDetail {
  position: ProgramPosition;
  resolvedEntries: ProgramScheduleEntry[];
  completedWorkouts: Workout[];
}

const compareById = (left: { id: string }, right: { id: string }): number =>
  left.id.localeCompare(right.id);

const compareEntries = (left: ProgramScheduleEntry, right: ProgramScheduleEntry): number =>
  left.dayOfWeek - right.dayOfWeek || left.order - right.order || compareById(left, right);

const compareRevisions = (
  left: ProgramScheduleRevision,
  right: ProgramScheduleRevision,
): number =>
  left.effectiveFromWeekIndex - right.effectiveFromWeekIndex ||
  left.createdAt - right.createdAt ||
  compareById(left, right);

async function readProgramDetail(programId: string): Promise<ProgramDetail | null> {
  const program = await db.programs.get(programId);
  if (program === undefined || program.deletedAt !== 0) return null;

  const [weeks, revisions] = await Promise.all([
    db.programWeeks.where('programId').equals(programId).toArray(),
    db.programScheduleRevisions.where('programId').equals(programId).toArray(),
  ]);
  const livingRevisions = alive(revisions).sort(compareRevisions);
  const revisionIds = livingRevisions.map((revision) => revision.id);
  const entries =
    revisionIds.length === 0
      ? []
      : alive(await db.programScheduleEntries.where('revisionId').anyOf(revisionIds).toArray());
  const entriesByRevision = new Map<string, ProgramScheduleEntry[]>();
  for (const entry of entries) {
    const group = entriesByRevision.get(entry.revisionId);
    if (group === undefined) entriesByRevision.set(entry.revisionId, [entry]);
    else group.push(entry);
  }

  return {
    program,
    weeks: alive(weeks).sort(
      (left, right) => left.weekIndex - right.weekIndex || compareById(left, right),
    ),
    revisions: livingRevisions.map((revision) => ({
      revision,
      entries: (entriesByRevision.get(revision.id) ?? []).sort(compareEntries),
    })),
  };
}

export async function getProgramDetail(programId: string): Promise<ProgramDetail | null> {
  return db.transaction(
    'r',
    [db.programs, db.programWeeks, db.programScheduleRevisions, db.programScheduleEntries],
    () => readProgramDetail(programId),
  );
}

export async function listPrograms(): Promise<ProgramSummary[]> {
  return alive(await db.programs.toArray())
    .sort(
      (left, right) =>
        right.startsAt - left.startsAt || right.createdAt - left.createdAt || compareById(left, right),
    )
    .map((program) => ({ program }));
}

export async function getActiveProgramDetail(at = Date.now()): Promise<ActiveProgramDetail | null> {
  return db.transaction(
    'r',
    [
      db.programs,
      db.programWeeks,
      db.programScheduleRevisions,
      db.programScheduleEntries,
      db.workouts,
    ],
    async () => {
      const activePrograms = alive(
        await db.programs.where('status').equals('active').toArray(),
      ).sort((left, right) => right.updatedAt - left.updatedAt || compareById(left, right));
      const program = activePrograms[0];
      if (program === undefined) return null;

      const detail = await readProgramDetail(program.id);
      if (detail === null) return null;

      const position = programPosition(program.startsAt, program.durationWeeks, at);
      const revisions = detail.revisions.map(({ revision }) => revision);
      const entries = detail.revisions.flatMap(({ entries: revisionEntries }) => revisionEntries);
      const resolvedEntries =
        position.phase === 'active' ? resolveSchedule(revisions, entries, position.weekIndex) : [];
      const completedWorkouts = alive(
        await db.workouts.where('status').equals('completed').toArray(),
      )
        .filter(
          (workout) =>
            workout.programId === program.id &&
            workout.programWeekIndex !== undefined &&
            workout.programScheduleEntryId !== undefined,
        )
        .sort(
          (left, right) => left.startedAt - right.startedAt || left.id.localeCompare(right.id),
        );

      return { ...detail, position, resolvedEntries, completedWorkouts };
    },
  );
}
