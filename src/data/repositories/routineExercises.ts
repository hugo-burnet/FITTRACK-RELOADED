import { db } from '@/data/db';
import type { RoutineExercise, RoutineSet } from '@/data/types';
import { moveItem, normalizeSupersets } from '@/lib/routineOrder';
import { alive, newEntity, softDelete, touch } from './base';

const byOrder = <T extends { order: number }>(a: T, b: T): number => a.order - b.order;

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
