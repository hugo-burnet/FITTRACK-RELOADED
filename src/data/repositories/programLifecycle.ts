import { db } from '@/data/db';
import type { Program } from '@/data/types';
import { resolveSchedule, shiftLocalDate, validateProgramDraft } from '@/lib/programs';
import { alive, newEntity, touch } from './base';
import { supersedePendingLoadRecommendations } from './coachRecommendations';

export type ProgramRepositoryErrorCode =
  | 'program_not_found'
  | 'program_invalid'
  | 'another_program_active'
  | 'retroactive_revision'
  | 'routine_missing';

export class ProgramRepositoryError extends Error {
  constructor(readonly code: ProgramRepositoryErrorCode) {
    super(code);
    this.name = 'ProgramRepositoryError';
  }
}

export interface CreateProgramDraftInput {
  name: string;
  startsAt: number;
  durationWeeks: number;
}

export async function createProgramDraft(input: CreateProgramDraftInput): Promise<Program> {
  const program = newEntity<Program>({ ...input, status: 'draft' });
  await db.programs.add(program);
  return program;
}

export async function updateProgramDraft(
  programId: string,
  input: CreateProgramDraftInput,
): Promise<void> {
  await db.transaction('rw', db.programs, async () => {
    const program = await db.programs.get(programId);
    if (program === undefined || program.deletedAt !== 0) {
      throw new ProgramRepositoryError('program_not_found');
    }
    if (program.status !== 'draft') throw new ProgramRepositoryError('program_invalid');
    await db.programs.put(touch(program, input));
  });
}

export async function activateProgram(programId: string): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.programs,
      db.programWeeks,
      db.programScheduleRevisions,
      db.programScheduleEntries,
      db.routines,
      db.routineExercises,
      db.coachRecommendations,
    ],
    async () => {
      const program = await db.programs.get(programId);
      if (program === undefined || program.deletedAt !== 0) {
        throw new ProgramRepositoryError('program_not_found');
      }
      if (program.status === 'completed') {
        throw new ProgramRepositoryError('program_invalid');
      }

      const anotherActive = alive(await db.programs.where('status').equals('active').toArray()).some(
        (candidate) => candidate.id !== programId,
      );
      if (anotherActive) throw new ProgramRepositoryError('another_program_active');

      const weeks = alive(await db.programWeeks.where('programId').equals(programId).toArray());
      const revisions = alive(
        await db.programScheduleRevisions.where('programId').equals(programId).toArray(),
      );
      const revisionIds = revisions.map((revision) => revision.id);
      const entries =
        revisionIds.length === 0
          ? []
          : alive(
              await db.programScheduleEntries.where('revisionId').anyOf(revisionIds).toArray(),
            );
      const routines = alive(await db.routines.toArray()).filter(
        (routine) => routine.versionState === 'published',
      );
      const availableRoutineIds = new Set(routines.map((routine) => routine.id));
      const initialSchedule = resolveSchedule(revisions, entries, 0);
      const issues = validateProgramDraft(
        {
          startsAt: program.startsAt,
          durationWeeks: program.durationWeeks,
          weeks,
          scheduleEntries: initialSchedule,
        },
        availableRoutineIds,
      );

      if (issues.includes('missing_routine')) {
        throw new ProgramRepositoryError('routine_missing');
      }
      if (issues.length > 0) throw new ProgramRepositoryError('program_invalid');

      const initialRoutineIds = [...new Set(initialSchedule.map((entry) => entry.routineId))];
      const initialExerciseIds = alive(
        await db.routineExercises.where('routineId').anyOf(initialRoutineIds).toArray(),
      ).map((row) => row.exerciseId);
      await supersedePendingLoadRecommendations(initialExerciseIds);
      await db.programs.put(touch(program, { status: 'active' }));
    },
  );
}

export async function completeProgram(programId: string): Promise<void> {
  await db.transaction('rw', db.programs, async () => {
    const program = await db.programs.get(programId);
    if (program === undefined || program.deletedAt !== 0) {
      throw new ProgramRepositoryError('program_not_found');
    }
    if (program.status !== 'active') throw new ProgramRepositoryError('program_invalid');
    await db.programs.put(touch(program, { status: 'completed' }));
  });
}

export async function shiftProgram(programId: string, days: number): Promise<void> {
  if (!Number.isInteger(days)) throw new ProgramRepositoryError('program_invalid');

  await db.transaction('rw', db.programs, async () => {
    const program = await db.programs.get(programId);
    if (program === undefined || program.deletedAt !== 0) {
      throw new ProgramRepositoryError('program_not_found');
    }
    await db.programs.put(touch(program, { startsAt: shiftLocalDate(program.startsAt, days) }));
  });
}

/** Soft-deletes the owned program graph, never a referenced routine or historical workout. */
export async function deleteProgram(programId: string): Promise<void> {
  await db.transaction(
    'rw',
    [db.programs, db.programWeeks, db.programScheduleRevisions, db.programScheduleEntries],
    async () => {
      const program = await db.programs.get(programId);
      if (program === undefined || program.deletedAt !== 0) return;

      const revisions = alive(
        await db.programScheduleRevisions.where('programId').equals(programId).toArray(),
      );
      const revisionIds = revisions.map((revision) => revision.id);
      const now = Date.now();
      const deleted = { deletedAt: now, updatedAt: now };

      if (revisionIds.length > 0) {
        await db.programScheduleEntries.where('revisionId').anyOf(revisionIds).modify(deleted);
      }
      await db.programScheduleRevisions.where('programId').equals(programId).modify(deleted);
      await db.programWeeks.where('programId').equals(programId).modify(deleted);
      await db.programs.update(programId, deleted);
    },
  );
}
