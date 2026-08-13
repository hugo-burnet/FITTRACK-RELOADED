import { db } from '@/data/db';
import type {
  Program,
  ProgramScheduleEntry,
  ProgramScheduleRevision,
  ProgramWeek,
  Workout,
} from '@/data/types';
import { programPosition, resolveSchedule } from '@/lib/programs';
import { alive, newEntity, touch } from './base';
import { supersedePendingLoadRecommendations } from './coachRecommendations';
import { ProgramRepositoryError } from './programLifecycle';

export interface ProgramWeekInput {
  weekIndex: number;
  loadIndex: ProgramWeek['loadIndex'];
  phase: ProgramWeek['phase'];
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
 * Rejects any write that would change the revision resolved by a persisted workout,
 * including after a civil-date shift makes an old week look future again.
 */
function assertForwardOnlyRevision(
  program: Program,
  effectiveFromWeekIndex: number,
  revisions: readonly ProgramScheduleRevision[],
  entries: readonly ProgramScheduleEntry[],
  workouts: readonly Workout[],
): void {
  if (program.status === 'completed') {
    throw new ProgramRepositoryError('retroactive_revision');
  }

  const latestEffectiveWeek = revisions.reduce(
    (latest, revision) => Math.max(latest, revision.effectiveFromWeekIndex),
    -1,
  );
  if (effectiveFromWeekIndex < latestEffectiveWeek) {
    throw new ProgramRepositoryError('retroactive_revision');
  }

  const programWorkouts = workouts.filter((workout) => workout.programId === program.id);
  const wouldRewriteWorkoutWeek = programWorkouts.some(
    (workout) =>
      workout.programWeekIndex !== undefined &&
      effectiveFromWeekIndex <= workout.programWeekIndex,
  );
  const supersededRevisionIds = new Set(
    revisions
      .filter((revision) => revision.effectiveFromWeekIndex === effectiveFromWeekIndex)
      .map((revision) => revision.id),
  );
  const supersededEntryIds = new Set(
    entries
      .filter((entry) => supersededRevisionIds.has(entry.revisionId))
      .map((entry) => entry.id),
  );
  const wouldDeleteReferencedEntry = programWorkouts.some(
    (workout) =>
      workout.programScheduleEntryId !== undefined &&
      supersededEntryIds.has(workout.programScheduleEntryId),
  );
  if (wouldRewriteWorkoutWeek || wouldDeleteReferencedEntry) {
    throw new ProgramRepositoryError('retroactive_revision');
  }

  if (program.status !== 'active') return;
  const position = programPosition(program.startsAt, program.durationWeeks, Date.now());
  if (position.phase === 'after') {
    throw new ProgramRepositoryError('retroactive_revision');
  }
  if (
    position.phase === 'active' &&
    effectiveFromWeekIndex < position.weekIndex
  ) {
    throw new ProgramRepositoryError('retroactive_revision');
  }
}

async function exerciseIdsForRoutines(routineIds: readonly string[]): Promise<Set<string>> {
  const uniqueRoutineIds = [...new Set(routineIds)];
  if (uniqueRoutineIds.length === 0) return new Set();
  return new Set(
    alive(
      await db.routineExercises.where('routineId').anyOf(uniqueRoutineIds).toArray(),
    ).map((row) => row.exerciseId),
  );
}

/**
 * Transaction-compatible complete-snapshot writer shared by generic split edits
 * and routine publication. The caller must include every touched table.
 */
export async function writeScheduleRevisionInTransaction(
  programId: string,
  effectiveFromWeekIndex: number,
  entries: readonly ProgramScheduleEntryDraft[],
): Promise<ProgramScheduleRevision> {
  const program = await db.programs.get(programId);
  if (program === undefined || program.deletedAt !== 0) {
    throw new ProgramRepositoryError('program_not_found');
  }
  validateScheduleInput(effectiveFromWeekIndex, program.durationWeeks, entries);

  const routines = await db.routines.bulkGet([
    ...new Set(entries.map((entry) => entry.routineId)),
  ]);
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
  const revisionIds = revisions.map((revision) => revision.id);
  const allEntries =
    revisionIds.length === 0
      ? []
      : alive(
          await db.programScheduleEntries.where('revisionId').anyOf(revisionIds).toArray(),
        );
  const workouts = alive(await db.workouts.toArray());
  assertForwardOnlyRevision(
    program,
    effectiveFromWeekIndex,
    revisions,
    allEntries,
    workouts,
  );

  const previousEntries = resolveSchedule(
    revisions,
    allEntries,
    effectiveFromWeekIndex,
  );
  const [previousExerciseIds, nextExerciseIds] = await Promise.all([
    exerciseIdsForRoutines(previousEntries.map((entry) => entry.routineId)),
    exerciseIdsForRoutines(entries.map((entry) => entry.routineId)),
  ]);
  const introducedExerciseIds = [...nextExerciseIds].filter(
    (exerciseId) => !previousExerciseIds.has(exerciseId),
  );

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
  if (revisions.length > 0) {
    await supersedePendingLoadRecommendations(introducedExerciseIds, now);
  }
  return revision;
}

/** Stores a complete split snapshot and all ownership side effects atomically. */
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
      db.routineExercises,
      db.workouts,
      db.coachRecommendations,
    ],
    () => writeScheduleRevisionInTransaction(programId, effectiveFromWeekIndex, entries),
  );
}
