import { db } from '@/data/db';
import {
  addExercisesToRoutine as addExercisesToRoutineImpl,
  groupWithPrevious as groupWithPreviousImpl,
  removeRoutineExercise as removeRoutineExerciseImpl,
  reorderRoutineExercises as reorderRoutineExercisesImpl,
  ungroupSuperset as ungroupSupersetImpl,
  updateRoutineExercise as updateRoutineExerciseImpl,
} from './routineExercises';
import {
  addRoutineSet as addRoutineSetImpl,
  applyToAllSets as applyToAllSetsImpl,
  deleteRoutineSet as deleteRoutineSetImpl,
  updateRoutineSet as updateRoutineSetImpl,
} from './routineSets';
import type { RoutineSetTargets } from './routineSets';
import {
  RoutineReferencedError,
  hasLiveScheduleReference,
} from './routineVersions';

export {
  countRoutinesInFolder,
  createFolder,
  deleteFolder,
  listFolders,
  renameFolder,
} from './routineFolders';

export {
  createRoutine,
  deleteRoutine,
  duplicateRoutine,
  getRoutineDetail,
  listRoutineSummaries,
  reorderRoutines,
  updateRoutine,
} from './routineLifecycle';
export type {
  RoutineChanges,
  RoutineDetail,
  RoutineExerciseDetail,
  RoutineSummary,
} from './routineLifecycle';

export {
  RoutineReferencedError,
  createRoutineVersionDraft,
  isRoutineSealed,
  listRoutineLineage,
  listRoutineVersionDrafts,
  publishRoutineVersion,
} from './routineVersions';
export type { PublishRoutineVersionInput } from './routineVersions';

type RoutineIdResolver = () => Promise<string | undefined>;

async function assertRoutineEditable(routineId: string | undefined): Promise<void> {
  if (routineId === undefined) return;
  const routine = await db.routines.get(routineId);
  if (
    routine !== undefined &&
    routine.deletedAt === 0 &&
    routine.versionState === 'published' &&
    (await hasLiveScheduleReference(routineId))
  ) {
    throw new RoutineReferencedError(routineId);
  }
}

/** Keeps the seal check and the delegated write in the same Dexie transaction. */
async function withEditableRoutine<T>(resolveRoutineId: RoutineIdResolver, write: () => Promise<T>) {
  return db.transaction(
    'rw',
    [db.routines, db.programScheduleEntries, db.routineExercises, db.routineSets],
    async () => {
      await assertRoutineEditable(await resolveRoutineId());
      return write();
    },
  );
}

const routineIdForExerciseRow = async (
  routineExerciseId: string,
): Promise<string | undefined> => (await db.routineExercises.get(routineExerciseId))?.routineId;

const routineIdForSet = async (setId: string): Promise<string | undefined> => {
  const set = await db.routineSets.get(setId);
  if (set === undefined) return undefined;
  return routineIdForExerciseRow(set.routineExerciseId);
};

export async function addExercisesToRoutine(
  routineId: string,
  exerciseIds: string[],
): Promise<void> {
  if (exerciseIds.length === 0) return;
  return withEditableRoutine(
    async () => routineId,
    () => addExercisesToRoutineImpl(routineId, exerciseIds),
  );
}

export async function updateRoutineExercise(
  id: string,
  changes: Parameters<typeof updateRoutineExerciseImpl>[1],
): Promise<void> {
  return withEditableRoutine(
    () => routineIdForExerciseRow(id),
    () => updateRoutineExerciseImpl(id, changes),
  );
}

export async function removeRoutineExercise(routineExerciseId: string): Promise<void> {
  return withEditableRoutine(
    () => routineIdForExerciseRow(routineExerciseId),
    () => removeRoutineExerciseImpl(routineExerciseId),
  );
}

export async function reorderRoutineExercises(
  routineId: string,
  from: number,
  to: number,
): Promise<void> {
  return withEditableRoutine(
    async () => routineId,
    () => reorderRoutineExercisesImpl(routineId, from, to),
  );
}

export async function groupWithPrevious(
  routineId: string,
  routineExerciseId: string,
): Promise<void> {
  return withEditableRoutine(
    async () => routineId,
    () => groupWithPreviousImpl(routineId, routineExerciseId),
  );
}

export async function ungroupSuperset(
  routineId: string,
  routineExerciseId: string,
): Promise<void> {
  return withEditableRoutine(
    async () => routineId,
    () => ungroupSupersetImpl(routineId, routineExerciseId),
  );
}

export async function addRoutineSet(routineExerciseId: string) {
  return withEditableRoutine(
    () => routineIdForExerciseRow(routineExerciseId),
    () => addRoutineSetImpl(routineExerciseId),
  );
}

export async function updateRoutineSet(id: string, changes: RoutineSetTargets): Promise<void> {
  return withEditableRoutine(
    () => routineIdForSet(id),
    () => updateRoutineSetImpl(id, changes),
  );
}

export async function applyToAllSets(
  routineExerciseId: string,
  changes: RoutineSetTargets,
): Promise<void> {
  return withEditableRoutine(
    () => routineIdForExerciseRow(routineExerciseId),
    () => applyToAllSetsImpl(routineExerciseId, changes),
  );
}

export async function deleteRoutineSet(id: string): Promise<void> {
  return withEditableRoutine(
    () => routineIdForSet(id),
    () => deleteRoutineSetImpl(id),
  );
}

export type { RoutineSetTargets };
