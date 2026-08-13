import { db } from '@/data/db';
import type {
  ProgramScheduleEntry,
  ProgramScheduleRevision,
  Routine,
  RoutineExercise,
  RoutineSet,
} from '@/data/types';
import { programPosition, resolveSchedule } from '@/lib/programs';
import { alive, newEntity, touch } from './base';
import { ProgramRepositoryError } from './programLifecycle';

const byVersion = (left: Routine, right: Routine): number =>
  left.version - right.version ||
  left.createdAt - right.createdAt ||
  left.id.localeCompare(right.id);

const rootIdOf = (routine: Routine): string => routine.originRoutineId ?? routine.id;

export class RoutineReferencedError extends Error {
  constructor(readonly routineId: string) {
    super('routine_referenced');
    this.name = 'RoutineReferencedError';
  }
}

/** Transaction-compatible reference check for lifecycle mutations. */
export async function hasLiveScheduleReference(routineId: string): Promise<boolean> {
  return alive(
    await db.programScheduleEntries.where('routineId').equals(routineId).toArray(),
  ).length > 0;
}

export async function isRoutineSealed(routineId: string): Promise<boolean> {
  return db.transaction('r', [db.routines, db.programScheduleEntries], async () => {
    const routine = await db.routines.get(routineId);
    if (
      routine === undefined ||
      routine.deletedAt !== 0 ||
      routine.versionState !== 'published'
    ) {
      return false;
    }
    return hasLiveScheduleReference(routineId);
  });
}

export async function listRoutineLineage(routineId: string): Promise<Routine[]> {
  const routine = await db.routines.get(routineId);
  if (routine === undefined) return [];
  const rootId = rootIdOf(routine);
  return alive(await db.routines.toArray())
    .filter((candidate) => rootIdOf(candidate) === rootId)
    .sort(byVersion);
}

export async function listRoutineVersionDrafts(routineId: string): Promise<Routine[]> {
  return (await listRoutineLineage(routineId)).filter(
    (routine) => routine.versionState === 'draft',
  );
}

export async function createRoutineVersionDraft(sourceRoutineId: string): Promise<Routine> {
  return db.transaction(
    'rw',
    [db.routines, db.routineExercises, db.routineSets],
    async () => {
      const source = await db.routines.get(sourceRoutineId);
      if (source === undefined || source.deletedAt !== 0) {
        throw new ProgramRepositoryError('routine_missing');
      }

      const rootId = rootIdOf(source);
      const lineage = (await db.routines.toArray()).filter(
        (candidate) => rootIdOf(candidate) === rootId,
      );
      const version = Math.max(...lineage.map((candidate) => candidate.version)) + 1;
      const draft = newEntity<Routine>({
        name: source.name,
        subtitle: source.subtitle,
        folderId: source.folderId,
        order: source.order,
        notes: source.notes,
        version,
        originRoutineId: rootId,
        versionState: 'draft',
      });

      const rows = alive(
        await db.routineExercises.where('routineId').equals(sourceRoutineId).toArray(),
      ).sort((left, right) => left.order - right.order);
      const sourceRowIds = rows.map((row) => row.id);
      const sets =
        sourceRowIds.length === 0
          ? []
          : alive(
              await db.routineSets
                .where('routineExerciseId')
                .anyOf(sourceRowIds)
                .toArray(),
            );
      const copiedRowIds = new Map<string, string>();
      const copiedRows = rows.map((row) => {
        const copy = newEntity<RoutineExercise>({ ...row, routineId: draft.id });
        copiedRowIds.set(row.id, copy.id);
        return copy;
      });
      const copiedSets = sets.map((set) =>
        newEntity<RoutineSet>({
          ...set,
          routineExerciseId: copiedRowIds.get(set.routineExerciseId) ?? '',
        }),
      );

      await db.routines.add(draft);
      if (copiedRows.length > 0) await db.routineExercises.bulkAdd(copiedRows);
      if (copiedSets.length > 0) await db.routineSets.bulkAdd(copiedSets);
      return draft;
    },
  );
}

function validateEffectiveWeek(
  effectiveFromWeekIndex: number,
  durationWeeks: number,
): void {
  if (
    !Number.isInteger(effectiveFromWeekIndex) ||
    effectiveFromWeekIndex < 0 ||
    effectiveFromWeekIndex >= durationWeeks
  ) {
    throw new ProgramRepositoryError('program_invalid');
  }
}

export interface PublishRoutineVersionInput {
  draftRoutineId: string;
  programId: string;
  effectiveFromWeekIndex: number;
}

interface CompleteScheduleEntry {
  routineId: string;
  dayOfWeek: number;
  order: number;
}

/** Writes inside the caller's Dexie transaction; never opens a nested transaction. */
async function writeCompleteScheduleRevision(
  programId: string,
  effectiveFromWeekIndex: number,
  entries: readonly CompleteScheduleEntry[],
  revisions: readonly ProgramScheduleRevision[],
): Promise<void> {
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
}

/** Publishes the draft and its complete effective split revision atomically. */
export async function publishRoutineVersion(
  input: PublishRoutineVersionInput,
): Promise<Routine> {
  return db.transaction(
    'rw',
    [
      db.programs,
      db.routines,
      db.programScheduleRevisions,
      db.programScheduleEntries,
      db.workouts,
    ],
    async () => {
      const [draft, program] = await Promise.all([
        db.routines.get(input.draftRoutineId),
        db.programs.get(input.programId),
      ]);
      if (
        draft === undefined ||
        draft.deletedAt !== 0 ||
        draft.versionState !== 'draft'
      ) {
        throw new ProgramRepositoryError('routine_missing');
      }
      if (program === undefined || program.deletedAt !== 0) {
        throw new ProgramRepositoryError('program_not_found');
      }
      if (program.status === 'completed') {
        throw new ProgramRepositoryError('retroactive_revision');
      }
      validateEffectiveWeek(input.effectiveFromWeekIndex, program.durationWeeks);

      const revisions = alive(
        await db.programScheduleRevisions.where('programId').equals(input.programId).toArray(),
      );
      const latestEffectiveWeek = revisions.reduce(
        (latest, revision) => Math.max(latest, revision.effectiveFromWeekIndex),
        -1,
      );
      if (input.effectiveFromWeekIndex < latestEffectiveWeek) {
        throw new ProgramRepositoryError('retroactive_revision');
      }

      if (program.status === 'active') {
        const position = programPosition(program.startsAt, program.durationWeeks, Date.now());
        if (position.phase === 'after') {
          throw new ProgramRepositoryError('retroactive_revision');
        }
        if (position.phase === 'active') {
          if (input.effectiveFromWeekIndex < position.weekIndex) {
            throw new ProgramRepositoryError('retroactive_revision');
          }
          if (input.effectiveFromWeekIndex === position.weekIndex) {
            const hasWorkoutThisWeek = alive(await db.workouts.toArray()).some(
              (workout) =>
                workout.programId === input.programId &&
                workout.programWeekIndex === position.weekIndex,
            );
            if (hasWorkoutThisWeek) {
              throw new ProgramRepositoryError('retroactive_revision');
            }
          }
        }
      }

      const revisionIds = revisions.map((revision) => revision.id);
      const allEntries =
        revisionIds.length === 0
          ? []
          : alive(
              await db.programScheduleEntries.where('revisionId').anyOf(revisionIds).toArray(),
            );
      const effectiveEntries = resolveSchedule(
        revisions,
        allEntries,
        input.effectiveFromWeekIndex,
      );
      if (effectiveEntries.length === 0) {
        throw new ProgramRepositoryError('program_invalid');
      }

      const referencedRoutines = await db.routines.bulkGet([
        ...new Set(effectiveEntries.map((entry) => entry.routineId)),
      ]);
      const routineById = new Map(
        referencedRoutines.flatMap((routine) =>
          routine === undefined ? [] : [[routine.id, routine] as const],
        ),
      );
      const rootId = rootIdOf(draft);
      let replacementCount = 0;
      const replacementEntries = effectiveEntries.map((entry) => {
        const referenced = routineById.get(entry.routineId);
        if (referenced === undefined || referenced.deletedAt !== 0) {
          throw new ProgramRepositoryError('routine_missing');
        }
        if (rootIdOf(referenced) !== rootId) return entry;
        replacementCount += 1;
        return { ...entry, routineId: draft.id };
      });
      if (replacementCount === 0) {
        throw new ProgramRepositoryError('routine_missing');
      }

      const published = touch(draft, { versionState: 'published' });
      await db.routines.put(published);
      await writeCompleteScheduleRevision(
        input.programId,
        input.effectiveFromWeekIndex,
        replacementEntries,
        revisions,
      );
      return published;
    },
  );
}
