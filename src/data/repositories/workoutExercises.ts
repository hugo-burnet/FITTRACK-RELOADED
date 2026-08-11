import { db } from '@/data/db';
import type { WorkoutExercise, WorkoutSet } from '@/data/types';
import { resolveRestSeconds } from '@/lib/rest';
import { moveItem, normalizeSupersets } from '@/lib/routineOrder';
import { alive, newEntity, softDelete, touch } from './base';
import { snapshotOf } from '@/lib/exerciseSnapshot';
import { reconcileRecordsForExercises } from './recordReconciliation';
import { getOneRepMaxFormula } from './settings';

const byOrder = <T extends { order: number }>(a: T, b: T): number => a.order - b.order;

const RECORD_PROJECTION_TABLES = [
  db.settings,
  db.exercises,
  db.workouts,
  db.workoutExercises,
  db.workoutSets,
  db.bodyMeasurements,
  db.personalRecords,
] as const;

// ---------------------------------------------------------------------------
// Exercises of the session in progress (RF-21)
// ---------------------------------------------------------------------------

/**
 * The one write path for order and superset groups, exactly as the routine
 * editor has it: every caller hands over a transformed list and gets
 * renumbering for free, so `order` can never grow a hole and a group can never
 * be left with a single member.
 */
async function rewriteOrder(
  workoutId: string,
  transform: (rows: WorkoutExercise[]) => WorkoutExercise[],
): Promise<void> {
  await db.transaction('rw', db.workoutExercises, async () => {
    const rows = alive(
      await db.workoutExercises.where('workoutId').equals(workoutId).toArray(),
    ).sort(byOrder);

    const next = normalizeSupersets(transform(rows)).map((row, order) => ({ ...row, order }));
    const before = new Map(rows.map((row) => [row.id, row]));

    const changed = next.filter((row) => {
      const was = before.get(row.id);
      return (
        was === undefined || was.order !== row.order || was.supersetGroup !== row.supersetGroup
      );
    });

    if (changed.length > 0) await db.workoutExercises.bulkPut(changed.map((row) => touch(row, {})));
  });
}

/**
 * RF-21 — an exercise you did not plan, added mid-session, **with a first set**.
 * An exercise carrying no row to tick is a dead end.
 *
 * Its rank is read and written inside the transaction, for the same reason
 * `appendSet` does it: two exercises added in the same tick would otherwise
 * both land at the end.
 */
export async function addWorkoutExercise(
  workoutId: string,
  exerciseId: string,
): Promise<WorkoutExercise> {
  // No routine to override anything: an exercise added mid-session takes its
  // own default, or the product default. Resolved once, outside: the library is
  // not what the concurrent callers are racing over, and the value is a
  // snapshot either way.
  const exercise = await db.exercises.get(exerciseId);

  return db.transaction('rw', db.workoutExercises, db.workoutSets, async () => {
    const count = alive(
      await db.workoutExercises.where('workoutId').equals(workoutId).toArray(),
    ).length;

    const row = newEntity<WorkoutExercise>({
      workoutId,
      exerciseId,
      order: count,
      supersetGroup: 0,
      restSeconds: resolveRestSeconds(undefined, exercise?.defaultRestSeconds),
      ...snapshotOf(exercise),
    });

    await db.workoutExercises.add(row);
    await db.workoutSets.add(
      newEntity<WorkoutSet>({
        workoutExerciseId: row.id,
        exerciseId,
        workoutId,
        order: 0,
        setType: 'normal',
        side: 'both',
        isCompleted: 0,
        performedAt: 0,
      }),
    );

    return row;
  });
}

export async function updateWorkoutExercise(
  id: string,
  changes: Partial<Pick<WorkoutExercise, 'notes'>>,
): Promise<void> {
  const row = await db.workoutExercises.get(id);
  if (row === undefined) return;
  await db.workoutExercises.put(touch(row, changes));
}

export async function removeWorkoutExercise(workoutExerciseId: string): Promise<void> {
  await db.transaction('rw', RECORD_PROJECTION_TABLES, async () => {
    const row = await db.workoutExercises.get(workoutExerciseId);
    if (row === undefined) return;
    const sets = await db.workoutSets
      .where('workoutExerciseId')
      .equals(workoutExerciseId)
      .toArray();
    const affectedExerciseIds = new Set([row.exerciseId, ...sets.map((set) => set.exerciseId)]);

    const now = Date.now();
    await db.workoutSets
      .where('workoutExerciseId')
      .equals(workoutExerciseId)
      .modify({ deletedAt: now, updatedAt: now });
    await softDelete(db.workoutExercises, workoutExerciseId);

    await rewriteOrder(row.workoutId, (rows) => rows);
    await reconcileRecordsForExercises([...affectedExerciseIds], await getOneRepMaxFormula());
  });
}

/** Audit recommendation M4: the order of a session is decided in the session. */
export async function reorderWorkoutExercises(
  workoutId: string,
  from: number,
  to: number,
): Promise<void> {
  await rewriteOrder(workoutId, (rows) => moveItem(rows, from, to));
}
