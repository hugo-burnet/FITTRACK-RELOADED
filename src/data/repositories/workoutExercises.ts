import { db } from '@/data/db';
import type { WorkoutExercise, WorkoutSet } from '@/data/types';
import { rowWithoutExerciseIdentity, setForReplacement } from '@/lib/exerciseReplacement';
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
  await db.transaction('rw', RECORD_PROJECTION_TABLES, async () => {
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

    if (changed.length === 0) return;

    await db.workoutExercises.bulkPut(changed.map((row) => touch(row, {})));
    const changedRowIds = new Set(changed.map((row) => row.id));
    const completedSets = (
      await db.workoutSets.where('workoutId').equals(workoutId).toArray()
    ).filter(
      (set) =>
        set.deletedAt === 0 &&
        set.isCompleted === 1 &&
        changedRowIds.has(set.workoutExerciseId),
    );
    const affectedExerciseIds = [...new Set(completedSets.map((set) => set.exerciseId))];
    if (affectedExerciseIds.length > 0) {
      await reconcileRecordsForExercises(
        affectedExerciseIds,
        await getOneRepMaxFormula(),
      );
    }
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
  changes: Partial<Pick<WorkoutExercise, 'notes' | 'repSeconds'>>,
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

/**
 * Ce qui s'est passé quand on a remplacé l'exercice d'une ligne de séance.
 *
 * `replaced` : aucune série n'était validée, la ligne est devenue l'autre exercice. `continued` :
 * des séries l'étaient, l'autre exercice reprend derrière avec ce qu'il restait. Les trois autres
 * ne changent rien.
 */
export type ReplaceOutcome =
  | 'replaced'
  | 'continued'
  | 'nothing_left'
  | 'same_exercise'
  | 'unknown';

/**
 * « La machine est prise » : l'exercice d'une ligne de la séance en cours remplacé par un autre.
 *
 * **On remplace ce qu'il reste à faire, jamais ce qui est fait.** Une série validée dit ce qui a
 * été soulevé sur une machine précise ; la réattribuer à une autre réécrirait la séance — et les
 * records, qui se calculent sur ce que l'exercice a réellement fait. Deux cas :
 *
 * - **Aucune série validée** : la ligne garde sa place (rang, superset, notes) et devient l'autre
 *   exercice, avec ses séries à faire. C'est le cas de la salle : on arrive devant la machine, elle
 *   est prise.
 * - **Des séries validées** : elles restent sur l'ancien exercice, et une nouvelle ligne pour
 *   l'autre se glisse juste derrière — dans le même superset — avec les séries qu'il restait.
 *
 * Ce qui parlait de l'ancien exercice ne suit pas (`lib/exerciseReplacement`) : l'instantané, la
 * cadence, le repos par défaut, les chiffres saisis, la charge visée. Ce qui est la place reste.
 * Tout se fait dans une seule transaction : une séance en cours ne doit jamais se lire à moitié
 * remplacée.
 */
export async function replaceWorkoutExercise(
  workoutExerciseId: string,
  newExerciseId: string,
): Promise<ReplaceOutcome> {
  const exercise = await db.exercises.get(newExerciseId);
  if (exercise === undefined || exercise.deletedAt !== 0) return 'unknown';

  return db.transaction('rw', RECORD_PROJECTION_TABLES, async (): Promise<ReplaceOutcome> => {
    const row = await db.workoutExercises.get(workoutExerciseId);
    if (row === undefined || row.deletedAt !== 0) return 'unknown';
    if (row.exerciseId === newExerciseId) return 'same_exercise';

    const sets = alive(
      await db.workoutSets.where('workoutExerciseId').equals(row.id).toArray(),
    ).sort(byOrder);
    const todo = sets.filter((set) => set.isCompleted === 0);
    if (todo.length === 0) return 'nothing_left';

    const identity = {
      exerciseId: newExerciseId,
      restSeconds: resolveRestSeconds(undefined, exercise.defaultRestSeconds),
      ...snapshotOf(exercise),
    };
    const restart = (set: WorkoutSet, order: number, rowId: string) =>
      touch(
        {
          ...setForReplacement(set, exercise.measurementType),
          workoutExerciseId: rowId,
          exerciseId: newExerciseId,
          order,
        },
        {},
      );

    if (todo.length === sets.length) {
      await db.workoutExercises.put(touch({ ...rowWithoutExerciseIdentity(row), ...identity }, {}));
      await db.workoutSets.bulkPut(todo.map((set) => restart(set, set.order, row.id)));
      return 'replaced';
    }

    const continuation = newEntity<WorkoutExercise>({
      workoutId: row.workoutId,
      order: row.order + 1,
      supersetGroup: row.supersetGroup,
      ...identity,
    });
    await rewriteOrder(row.workoutId, (rows) => {
      const index = rows.findIndex((candidate) => candidate.id === row.id);
      return [...rows.slice(0, index + 1), continuation, ...rows.slice(index + 1)];
    });
    await db.workoutSets.bulkPut(todo.map((set, index) => restart(set, index, continuation.id)));
    return 'continued';
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
