import { db } from '@/data/db';
import type {
  Exercise,
  Routine,
  RoutineExercise,
  RoutineFolder,
  RoutineSet,
  Syncable,
} from '@/data/types';
import { moveItem, normalizeSupersets } from '@/lib/routineOrder';
import { alive, newEntity, softDelete, touch } from './base';

/** What a set sheet may change. `order` is excluded: it belongs to the list, not to a form. */
export type RoutineSetTargets = Partial<
  Pick<RoutineSet, 'setType' | 'targetReps' | 'targetRepsMax' | 'targetWeight' | 'targetRpe'>
>;

const byOrder = <T extends { order: number }>(a: T, b: T): number => a.order - b.order;

// ---------------------------------------------------------------------------
// Folders (RF-12)
// ---------------------------------------------------------------------------

export async function listFolders(): Promise<RoutineFolder[]> {
  return alive(await db.routineFolders.toArray()).sort(byOrder);
}

export async function createFolder(name: string): Promise<RoutineFolder> {
  const order = (await listFolders()).length;
  const folder = newEntity<RoutineFolder>({ name, order });
  await db.routineFolders.add(folder);
  return folder;
}

export async function renameFolder(id: string, name: string): Promise<void> {
  const folder = await db.routineFolders.get(id);
  if (folder === undefined) return;
  await db.routineFolders.put(touch(folder, { name }));
}

export async function countRoutinesInFolder(id: string): Promise<number> {
  return alive(await db.routines.where('folderId').equals(id).toArray()).length;
}

/**
 * Deletes the folder and **keeps its routines**, which return to the root.
 *
 * Filing and destroying are two different acts, and conflating them is the
 * fastest way to lose twenty minutes of writing to a tap meant to tidy up. The
 * confirmation text announces how many routines are about to move — hence
 * `countRoutinesInFolder`.
 */
export async function deleteFolder(id: string): Promise<void> {
  await db.transaction('rw', db.routineFolders, db.routines, async () => {
    await db.routines.where('folderId').equals(id).modify({ folderId: '', updatedAt: Date.now() });
    await softDelete(db.routineFolders, id);
  });
}

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
  const routine = newEntity<Routine>({ name, folderId, order, version: 1 });
  await db.routines.add(routine);
  return routine;
}

export async function updateRoutine(
  id: string,
  changes: Partial<Omit<Routine, keyof Syncable>>,
): Promise<void> {
  const routine = await db.routines.get(id);
  if (routine === undefined) return;
  await db.routines.put(touch(routine, changes));
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
 * `originRoutineId` is deliberately left unset: a copy is not a version. The
 * field describes a lineage no screen reads yet, and versioning belongs to the
 * periodisation of Lot 17. The name comes from the caller — UI text does not
 * belong in the data layer.
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
      version: 1,
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

/** Soft-deletes the routine AND its exercise rows AND their sets, in one transaction. */
export async function deleteRoutine(id: string): Promise<void> {
  await db.transaction('rw', db.routines, db.routineExercises, db.routineSets, async () => {
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
  });
}

// ---------------------------------------------------------------------------
// Exercises of a routine (RF-13, RF-14)
// ---------------------------------------------------------------------------

/**
 * The one write path for order and superset groups.
 *
 * Every caller — drag, group, ungroup, remove — hands over a transformed list
 * and gets renumbering for free, so `order` can never grow a hole and a group
 * can never be left with one member. Only the rows that actually changed are
 * written: `updatedAt` is what the Lot 14 sync diffs on, and rewriting an
 * untouched row would send it across the wire for nothing.
 */
async function rewriteOrder(
  routineId: string,
  transform: (rows: RoutineExercise[]) => RoutineExercise[],
): Promise<void> {
  await db.transaction('rw', db.routineExercises, async () => {
    const rows = alive(await db.routineExercises.where('routineId').equals(routineId).toArray()).sort(
      byOrder,
    );

    const next = normalizeSupersets(transform(rows)).map((row, order) => ({ ...row, order }));
    const before = new Map(rows.map((row) => [row.id, row]));

    const changed = next.filter((row) => {
      const was = before.get(row.id);
      return (
        was === undefined || was.order !== row.order || was.supersetGroup !== row.supersetGroup
      );
    });

    if (changed.length > 0) await db.routineExercises.bulkPut(changed.map((row) => touch(row, {})));
  });
}

/** Appends exercises, each with one blank planned set: a line with no set has nothing to do. */
export async function addExercisesToRoutine(
  routineId: string,
  exerciseIds: string[],
): Promise<void> {
  if (exerciseIds.length === 0) return;

  await db.transaction('rw', db.routineExercises, db.routineSets, async () => {
    const count = alive(
      await db.routineExercises.where('routineId').equals(routineId).toArray(),
    ).length;

    const rows = exerciseIds.map((exerciseId, index) =>
      newEntity<RoutineExercise>({
        routineId,
        exerciseId,
        order: count + index,
        supersetGroup: 0,
        restSeconds: 0,
      }),
    );

    await db.routineExercises.bulkAdd(rows);
    await db.routineSets.bulkAdd(
      rows.map((row) =>
        newEntity<RoutineSet>({ routineExerciseId: row.id, order: 0, setType: 'normal' }),
      ),
    );
  });
}

export async function updateRoutineExercise(
  id: string,
  changes: Partial<Pick<RoutineExercise, 'restSeconds' | 'notes'>>,
): Promise<void> {
  const row = await db.routineExercises.get(id);
  if (row === undefined) return;
  await db.routineExercises.put(touch(row, changes));
}

export async function removeRoutineExercise(routineExerciseId: string): Promise<void> {
  await db.transaction('rw', db.routineExercises, db.routineSets, async () => {
    const row = await db.routineExercises.get(routineExerciseId);
    if (row === undefined) return;

    const now = Date.now();
    await db.routineSets
      .where('routineExerciseId')
      .equals(routineExerciseId)
      .modify({ deletedAt: now, updatedAt: now });
    await softDelete(db.routineExercises, routineExerciseId);

    // Closes the hole in `order`, and dissolves a superset this row leaves with
    // a single member behind.
    await rewriteOrder(row.routineId, (rows) => rows);
  });
}

export async function reorderRoutineExercises(
  routineId: string,
  from: number,
  to: number,
): Promise<void> {
  await rewriteOrder(routineId, (rows) => moveItem(rows, from, to));
}

/** RF-14. Joins the superset above if there is one, otherwise opens a new one with it. */
export async function groupWithPrevious(
  routineId: string,
  routineExerciseId: string,
): Promise<void> {
  await rewriteOrder(routineId, (rows) => {
    const index = rows.findIndex((row) => row.id === routineExerciseId);
    const previous = rows[index - 1];
    if (index < 1 || previous === undefined) return rows;

    const group =
      previous.supersetGroup !== 0
        ? previous.supersetGroup
        : Math.max(0, ...rows.map((row) => row.supersetGroup)) + 1;

    return rows.map((row, i) =>
      i === index || i === index - 1 ? { ...row, supersetGroup: group } : row,
    );
  });
}

/**
 * Dissolves the **whole** group, never a single member.
 *
 * One meaning, always the same. Pulling one exercise out would mean something
 * different on the first row of a group of three than on the middle one, and an
 * action whose effect depends on where you tapped is an action nobody trusts.
 */
export async function ungroupSuperset(
  routineId: string,
  routineExerciseId: string,
): Promise<void> {
  await rewriteOrder(routineId, (rows) => {
    const group = rows.find((row) => row.id === routineExerciseId)?.supersetGroup ?? 0;
    if (group === 0) return rows;
    return rows.map((row) => (row.supersetGroup === group ? { ...row, supersetGroup: 0 } : row));
  });
}

// ---------------------------------------------------------------------------
// Planned sets (RF-11)
// ---------------------------------------------------------------------------

/**
 * Appends a set **copied from the last one**. Writing 3 × 8-12 @ 80 kg then
 * costs one entry and two taps instead of three entries — and that is the
 * overwhelmingly common shape of a routine.
 */
export async function addRoutineSet(routineExerciseId: string): Promise<RoutineSet> {
  const siblings = alive(
    await db.routineSets.where('routineExerciseId').equals(routineExerciseId).toArray(),
  ).sort(byOrder);

  const last = siblings.at(-1);
  const set = newEntity<RoutineSet>({
    routineExerciseId,
    order: siblings.length,
    setType: last?.setType ?? 'normal',
    targetReps: last?.targetReps,
    targetRepsMax: last?.targetRepsMax,
    targetWeight: last?.targetWeight,
    targetRpe: last?.targetRpe,
  });

  await db.routineSets.add(set);
  return set;
}

export async function updateRoutineSet(id: string, changes: RoutineSetTargets): Promise<void> {
  const set = await db.routineSets.get(id);
  if (set === undefined) return;
  await db.routineSets.put(touch(set, changes));
}

/** Moving a whole exercise from 80 to 85 kg is a routine's most frequent edit. */
export async function applyToAllSets(
  routineExerciseId: string,
  changes: RoutineSetTargets,
): Promise<void> {
  const sets = alive(
    await db.routineSets.where('routineExerciseId').equals(routineExerciseId).toArray(),
  );
  if (sets.length === 0) return;
  await db.routineSets.bulkPut(sets.map((set) => touch(set, changes)));
}

/** Renumbers what is left: "série 1, série 3" is a hole you can read on screen. */
export async function deleteRoutineSet(id: string): Promise<void> {
  await db.transaction('rw', db.routineSets, async () => {
    const set = await db.routineSets.get(id);
    if (set === undefined) return;
    await softDelete(db.routineSets, id);

    const rest = alive(
      await db.routineSets.where('routineExerciseId').equals(set.routineExerciseId).toArray(),
    ).sort(byOrder);

    const renumbered = rest
      .map((row, order) => ({ row, order }))
      .filter(({ row, order }) => row.order !== order)
      .map(({ row, order }) => touch(row, { order }));

    if (renumbered.length > 0) await db.routineSets.bulkPut(renumbered);
  });
}
