import { db } from '@/data/db';
import type {
  ProgramScheduleEntry,
  ProgramScheduleRevision,
  ProgramWeek,
} from '@/data/types';
import { programPosition } from '@/lib/programs';
import { alive, newEntity, touch } from './base';
import { ProgramRepositoryError } from './programLifecycle';

export interface ProgramWeekInput {
  weekIndex: number;
  prescriptionKind: ProgramWeek['prescriptionKind'];
  prescriptionValue: number;
  isDeload: 0 | 1;
  notes?: string;
}

export interface ProgramScheduleEntryDraft {
  routineId: string;
  dayOfWeek: number;
  order: number;
}

export async function replaceProgramWeeks(
  programId: string,
  weeks: readonly ProgramWeekInput[],
): Promise<void> {
  await db.transaction('rw', [db.programs, db.programWeeks], async () => {
    const program = await db.programs.get(programId);
    if (program === undefined || program.deletedAt !== 0) {
      throw new ProgramRepositoryError('program_not_found');
    }
    if (program.status !== 'draft') throw new ProgramRepositoryError('program_invalid');

    const indices = new Set(weeks.map((week) => week.weekIndex));
    const isCompleteReplacement =
      weeks.length === program.durationWeeks &&
      indices.size === weeks.length &&
      weeks.every(
        (week) =>
          Number.isInteger(week.weekIndex) &&
          week.weekIndex >= 0 &&
          week.weekIndex < program.durationWeeks,
      ) &&
      Array.from({ length: program.durationWeeks }, (_, weekIndex) => weekIndex).every(
        (weekIndex) => indices.has(weekIndex),
      );
    if (!isCompleteReplacement) throw new ProgramRepositoryError('program_invalid');

    const existing = alive(await db.programWeeks.where('programId').equals(programId).toArray());
    const now = Date.now();
    if (existing.length > 0) {
      await db.programWeeks.bulkPut(
        existing.map((row) => touch(row, { deletedAt: now })),
      );
    }
    await db.programWeeks.bulkAdd(
      weeks.map((week) => newEntity<ProgramWeek>({ ...week, programId })),
    );
  });
}

function validateScheduleInput(
  effectiveFromWeekIndex: number,
  durationWeeks: number,
  entries: readonly ProgramScheduleEntryDraft[],
): void {
  const hasValidWeek =
    Number.isInteger(effectiveFromWeekIndex) &&
    effectiveFromWeekIndex >= 0 &&
    effectiveFromWeekIndex < durationWeeks;
  const hasValidEntries =
    entries.length > 0 &&
    entries.every(
      (entry) =>
        Number.isInteger(entry.dayOfWeek) &&
        entry.dayOfWeek >= 1 &&
        entry.dayOfWeek <= 7 &&
        Number.isInteger(entry.order) &&
        entry.order >= 0,
    );
  const placements = new Set(entries.map((entry) => `${entry.dayOfWeek}:${entry.order}`));

  if (!hasValidWeek || !hasValidEntries || placements.size !== entries.length) {
    throw new ProgramRepositoryError('program_invalid');
  }
}

/**
 * Stores a complete split snapshot. Reusing an effective week atomically supersedes
 * the previous living row, so the compound key never has two live revisions.
 */
export async function createScheduleRevision(
  programId: string,
  effectiveFromWeekIndex: number,
  entries: readonly ProgramScheduleEntryDraft[],
): Promise<ProgramScheduleRevision> {
  return db.transaction(
    'rw',
    [
      db.programs,
      db.programScheduleRevisions,
      db.programScheduleEntries,
      db.routines,
      db.workouts,
    ],
    async () => {
      const program = await db.programs.get(programId);
      if (program === undefined || program.deletedAt !== 0) {
        throw new ProgramRepositoryError('program_not_found');
      }
      if (program.status === 'completed') {
        throw new ProgramRepositoryError('retroactive_revision');
      }
      validateScheduleInput(effectiveFromWeekIndex, program.durationWeeks, entries);

      const routines = await db.routines.bulkGet([...new Set(entries.map((entry) => entry.routineId))]);
      if (
        routines.some(
          (routine) =>
            routine === undefined ||
            routine.deletedAt !== 0 ||
            routine.versionState !== 'published',
        )
      ) {
        throw new ProgramRepositoryError('routine_missing');
      }

      const revisions = alive(
        await db.programScheduleRevisions.where('programId').equals(programId).toArray(),
      );
      const latestEffectiveWeek = revisions.reduce(
        (latest, revision) => Math.max(latest, revision.effectiveFromWeekIndex),
        -1,
      );
      if (effectiveFromWeekIndex < latestEffectiveWeek) {
        throw new ProgramRepositoryError('retroactive_revision');
      }

      if (program.status === 'active') {
        const position = programPosition(program.startsAt, program.durationWeeks, Date.now());
        if (position.phase === 'after') {
          throw new ProgramRepositoryError('retroactive_revision');
        }
        if (position.phase === 'active') {
          if (effectiveFromWeekIndex < position.weekIndex) {
            throw new ProgramRepositoryError('retroactive_revision');
          }
          if (effectiveFromWeekIndex === position.weekIndex) {
            const hasWorkoutThisWeek = alive(await db.workouts.toArray()).some(
              (workout) =>
                workout.programId === programId &&
                workout.programWeekIndex === position.weekIndex,
            );
            if (hasWorkoutThisWeek) throw new ProgramRepositoryError('retroactive_revision');
          }
        }
      }

      const superseded = revisions.filter(
        (revision) => revision.effectiveFromWeekIndex === effectiveFromWeekIndex,
      );
      const supersededIds = superseded.map((revision) => revision.id);
      const now = Date.now();
      if (supersededIds.length > 0) {
        const oldEntries = alive(
          await db.programScheduleEntries.where('revisionId').anyOf(supersededIds).toArray(),
        );
        await db.programScheduleEntries.bulkPut(
          oldEntries.map((entry) => touch(entry, { deletedAt: now })),
        );
        await db.programScheduleRevisions.bulkPut(
          superseded.map((revision) => touch(revision, { deletedAt: now })),
        );
      }

      const revision = newEntity<ProgramScheduleRevision>({
        programId,
        effectiveFromWeekIndex,
      });
      const scheduleEntries = entries.map((entry) =>
        newEntity<ProgramScheduleEntry>({ ...entry, revisionId: revision.id }),
      );
      await db.programScheduleRevisions.add(revision);
      await db.programScheduleEntries.bulkAdd(scheduleEntries);
      return revision;
    },
  );
}
