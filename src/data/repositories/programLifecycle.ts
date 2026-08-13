import { db } from '@/data/db';
import type { Program } from '@/data/types';
import {
  isoDayOfWeek,
  resolveSchedule,
  shiftLocalDate,
  validateProgramDraft,
} from '@/lib/programs';
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

interface PreparedProgramActivation {
  program: Program;
  initialExerciseIds: string[];
}

/** Reads and validates an activation candidate inside the caller's transaction. */
async function prepareProgramActivation(programId: string): Promise<PreparedProgramActivation> {
  const program = await db.programs.get(programId);
  if (program === undefined || program.deletedAt !== 0) {
    throw new ProgramRepositoryError('program_not_found');
  }
  if (program.status !== 'draft') {
    throw new ProgramRepositoryError('program_invalid');
  }

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
  return { program, initialExerciseIds };
}

const activationTables = [
  db.programs,
  db.programWeeks,
  db.programScheduleRevisions,
  db.programScheduleEntries,
  db.routines,
  db.routineExercises,
  db.coachRecommendations,
] as const;

export async function activateProgram(programId: string): Promise<void> {
  await db.transaction('rw', activationTables, async () => {
    const prepared = await prepareProgramActivation(programId);
    const anotherActive = alive(
      await db.programs.where('status').equals('active').toArray(),
    ).some((candidate) => candidate.id !== programId);
    if (anotherActive) throw new ProgramRepositoryError('another_program_active');

    await supersedePendingLoadRecommendations(prepared.initialExerciseIds);
    await db.programs.put(touch(prepared.program, { status: 'active' }));
  });
}

/**
 * Confirmation seam: validates the draft, then completes the one current block
 * and activates its replacement in the same transaction.
 */
export async function replaceActiveProgram(programId: string): Promise<void> {
  await db.transaction('rw', activationTables, async () => {
    const prepared = await prepareProgramActivation(programId);
    const currentActive = alive(
      await db.programs.where('status').equals('active').toArray(),
    ).filter((candidate) => candidate.id !== programId);
    if (currentActive.length === 0) {
      throw new ProgramRepositoryError('program_invalid');
    }
    if (currentActive.length > 1) {
      throw new ProgramRepositoryError('another_program_active');
    }

    await supersedePendingLoadRecommendations(prepared.initialExerciseIds);
    await db.programs.bulkPut([
      touch(currentActive[0]!, { status: 'completed' }),
      touch(prepared.program, { status: 'active' }),
    ]);
  });
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
    if (program.status !== 'active') throw new ProgramRepositoryError('program_invalid');
    const startsAt = shiftLocalDate(program.startsAt, days);
    if (isoDayOfWeek(startsAt) !== 1) {
      throw new ProgramRepositoryError('program_invalid');
    }
    await db.programs.put(touch(program, { startsAt }));
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
