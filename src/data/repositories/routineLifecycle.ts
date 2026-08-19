import { db } from '@/data/db';
import type {
  Exercise,
  Routine,
  RoutineExercise,
  RoutineSet,
} from '@/data/types';
import { alive, newEntity, softDelete, touch } from './base';

const byOrder = <T extends { order: number }>(a: T, b: T): number => a.order - b.order;

// ---------------------------------------------------------------------------
// Routines (RF-11, RF-13)
// ---------------------------------------------------------------------------

export interface RoutineSummary {
  routine: Routine;
  exerciseCount: number;
  setCount: number;
}

/**
 * The list screen's only read. Reads the three tables once and recomposes in
 * memory rather than querying per routine: the N+1 is the natural reflex here
 * and it becomes visible at around ten routines, on the screen the user opens
 * most often.
 */
export async function listRoutineSummaries(): Promise<RoutineSummary[]> {
  const [routines, rows, sets] = await Promise.all([
    db.routines.toArray(),
    db.routineExercises.toArray(),
    db.routineSets.toArray(),
  ]);

  const setsPerRow = new Map<string, number>();
  for (const set of alive(sets)) {
    setsPerRow.set(set.routineExerciseId, (setsPerRow.get(set.routineExerciseId) ?? 0) + 1);
  }

  const stats = new Map<string, { exerciseCount: number; setCount: number }>();
  // Driven by the live rows, so the sets of a removed exercise are never counted.
  for (const row of alive(rows)) {
    const stat = stats.get(row.routineId) ?? { exerciseCount: 0, setCount: 0 };
    stat.exerciseCount += 1;
    stat.setCount += setsPerRow.get(row.id) ?? 0;
    stats.set(row.routineId, stat);
  }

  return alive(routines)
    .sort(byOrder)
    .map((routine) => ({
      routine,
      ...(stats.get(routine.id) ?? { exerciseCount: 0, setCount: 0 }),
    }));
}

export interface RoutineExerciseDetail {
  row: RoutineExercise;
  /** `undefined` when the exercise was deleted from the library after being added. */
  exercise: Exercise | undefined;
  sets: RoutineSet[];
}

export interface RoutineDetail {
  routine: Routine;
  exercises: RoutineExerciseDetail[];
}

/**
 * Everything the editor draws, in one read.
 *
 * Returns `null` and never `undefined` for a routine that is gone: `useLiveQuery`
 * uses `undefined` for "has not answered yet", and blurring the two makes a
 * freshly opened screen flash "cette routine n'existe plus".
 */
export async function getRoutineDetail(id: string): Promise<RoutineDetail | null> {
  const routine = await db.routines.get(id);
  if (routine === undefined || routine.deletedAt !== 0) return null;

  const rows = alive(await db.routineExercises.where('routineId').equals(id).toArray()).sort(
    byOrder,
  );

  const [sets, found] = await Promise.all([
    db.routineSets
      .where('routineExerciseId')
      .anyOf(rows.map((row) => row.id))
      .toArray(),
    db.exercises.bulkGet([...new Set(rows.map((row) => row.exerciseId))]),
  ]);

  const library = new Map<string, Exercise>();
  // A soft-deleted exercise reads as missing, exactly as `getExercise` has it.
  for (const exercise of found) {
    if (exercise !== undefined && exercise.deletedAt === 0) library.set(exercise.id, exercise);
  }

  const setsPerRow = new Map<string, RoutineSet[]>();
  for (const set of alive(sets)) {
    const list = setsPerRow.get(set.routineExerciseId);
    if (list === undefined) setsPerRow.set(set.routineExerciseId, [set]);
    else list.push(set);
  }

  return {
    routine,
    exercises: rows.map((row) => ({
      row,
      exercise: library.get(row.exerciseId),
      sets: (setsPerRow.get(row.id) ?? []).sort(byOrder),
    })),
  };
}

export async function createRoutine(name: string, folderId = ''): Promise<Routine> {
  const order = alive(await db.routines.toArray()).length;
  const routine = newEntity<Routine>({ name, folderId, order });
  await db.routines.add(routine);
  return routine;
}

export type RoutineChanges = Partial<
  Pick<Routine, 'name' | 'subtitle' | 'folderId' | 'order' | 'notes'>
>;

function editableRoutineChanges(changes: RoutineChanges): RoutineChanges {
  const editable: RoutineChanges = {};
  if ('name' in changes) editable.name = changes.name;
  if ('subtitle' in changes) editable.subtitle = changes.subtitle;
  if ('folderId' in changes) editable.folderId = changes.folderId;
  if ('order' in changes) editable.order = changes.order;
  if ('notes' in changes) editable.notes = changes.notes;
  return editable;
}

export async function updateRoutine(id: string, changes: RoutineChanges): Promise<void> {
  await db.transaction('rw', db.routines, async () => {
    const routine = await db.routines.get(id);
    if (routine === undefined || routine.deletedAt !== 0) return;
    await db.routines.put(touch(routine, editableRoutineChanges(changes)));
  });
}

/**
 * RF-13 — a **deep** copy: the routine, its exercise rows and every planned set
 * are re-created with fresh UUIDs.
 *
 * A shallow copy that shared the `routineExercise` rows would display perfectly
 * and destroy the original the moment the copy is edited — which is precisely
 * what the lot's checkpoint asks the user to try. The fresh identity comes from
 * `newEntity`, which stamps `id`/`createdAt`/`updatedAt`/`deletedAt` **after**
 * the spread, so no source id can survive even if a field is added to the
 * entity later.
 *
 * The name comes from the caller — UI text does not belong in the data layer.
 */
export async function duplicateRoutine(id: string, name: string): Promise<Routine | undefined> {
  return db.transaction('rw', db.routines, db.routineExercises, db.routineSets, async () => {
    const source = await db.routines.get(id);
    if (source === undefined || source.deletedAt !== 0) return undefined;

    const order = alive(await db.routines.toArray()).length;
    const copy = newEntity<Routine>({
      name,
      folderId: source.folderId,
      order,
      notes: source.notes,
    });

    const rows = alive(await db.routineExercises.where('routineId').equals(id).toArray()).sort(
      byOrder,
    );
    const sets = alive(
      await db.routineSets
        .where('routineExerciseId')
        .anyOf(rows.map((row) => row.id))
        .toArray(),
    );

    const rowIdBySource = new Map<string, string>();
    const copiedRows = rows.map((row) => {
      const copied = newEntity<RoutineExercise>({ ...row, routineId: copy.id });
      rowIdBySource.set(row.id, copied.id);
      return copied;
    });

    const copiedSets = sets.map((set) =>
      newEntity<RoutineSet>({
        ...set,
        routineExerciseId: rowIdBySource.get(set.routineExerciseId) ?? '',
      }),
    );

    await db.routines.add(copy);
    await db.routineExercises.bulkAdd(copiedRows);
    await db.routineSets.bulkAdd(copiedSets);
    return copy;
  });
}

/**
 * Applies a whole new arrangement of the routine list: which folder each routine
 * sits in, and in what order.
 *
 * Takes the final list rather than a from/to pair because on this screen the two
 * are the same gesture — the folder a routine belongs to **is** the heading it
 * was dropped under, so moving and re-filing cannot be told apart and must be
 * written together. `order` is the position in the list, so the caller never
 * computes it.
 */
export async function reorderRoutines(
  placement: { id: string; folderId: string }[],
): Promise<void> {
  await db.transaction('rw', db.routines, async () => {
    const existing = new Map((await db.routines.toArray()).map((row) => [row.id, row]));

    const changed = placement.flatMap(({ id, folderId }, order) => {
      const routine = existing.get(id);
      if (routine === undefined || routine.deletedAt !== 0) return [];
      if (routine.folderId === folderId && routine.order === order) return [];
      return [touch(routine, { folderId, order })];
    });

    if (changed.length > 0) await db.routines.bulkPut(changed);
  });
}

/**
 * Soft-deletes the routine AND its exercise rows AND their sets, in one transaction.
 *
 * A block scheduling this routine is not consulted: it points at the routine,
 * the routine knows nothing of it. Its session then reads « séance à repointer »
 * and offers to repair the split — a decision that belongs to the block's own
 * screen, not a refusal thrown at someone tidying their library.
 */
export async function deleteRoutine(id: string): Promise<void> {
  await db.transaction(
    'rw',
    [db.routines, db.routineExercises, db.routineSets],
    async () => {
      const now = Date.now();
      const rowIds = (await db.routineExercises.where('routineId').equals(id).toArray()).map(
        (row) => row.id,
      );

      await db.routineSets
        .where('routineExerciseId')
        .anyOf(rowIds)
        .modify({ deletedAt: now, updatedAt: now });
      await db.routineExercises
        .where('routineId')
        .equals(id)
        .modify({ deletedAt: now, updatedAt: now });
      await softDelete(db.routines, id);
    },
  );
}
