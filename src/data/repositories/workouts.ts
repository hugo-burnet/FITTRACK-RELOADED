import Dexie from 'dexie';
import { db } from '@/data/db';
import type { Syncable, Workout, WorkoutSet } from '@/data/types';
import { alive, newEntity, softDelete, touch } from './base';

/** What a caller may set on a new set. The identity fields are derived, never passed. */
export type NewSetValues = Partial<
  Omit<WorkoutSet, keyof Syncable | 'workoutExerciseId' | 'exerciseId' | 'workoutId'>
>;

/** RF-25. Resumed on startup, which is why it is a query and not a store. */
export async function getActiveWorkout(): Promise<Workout | undefined> {
  const candidates = alive(await db.workouts.where('status').equals('active').toArray());
  // Only one session should ever be active. If a crash left two behind, the
  // most recent one is the one the user was actually in.
  return candidates.sort((a, b) => b.startedAt - a.startedAt)[0];
}

/** RF-17. `routineId` is '' for an empty workout — never null, cf. architecture §3. */
export async function startWorkout(routineId: string, name: string): Promise<Workout> {
  const workout = newEntity<Workout>({
    routineId,
    name,
    status: 'active',
    startedAt: Date.now(),
    endedAt: 0,
    durationSeconds: 0,
  });
  await db.workouts.add(workout);
  return workout;
}

/**
 * Appends a set to an exercise of the current workout.
 *
 * `exerciseId` and `workoutId` are copied from the parent row rather than
 * accepted from the caller: they are denormalised for the sake of one index
 * (§5), and a copy that can disagree with its source is a bug waiting to
 * happen.
 */
export async function addSet(
  workoutExerciseId: string,
  values: NewSetValues = {},
): Promise<WorkoutSet> {
  const parent = await db.workoutExercises.get(workoutExerciseId);
  if (parent === undefined) {
    throw new Error(`Ligne d'exercice introuvable : ${workoutExerciseId}`);
  }

  const siblings = await db.workoutSets
    .where('workoutExerciseId')
    .equals(workoutExerciseId)
    .count();

  const set = newEntity<WorkoutSet>({
    order: siblings,
    setType: 'normal',
    side: 'both',
    isCompleted: 0,
    performedAt: 0,
    ...values,
    workoutExerciseId,
    exerciseId: parent.exerciseId,
    workoutId: parent.workoutId,
  });

  await db.workoutSets.add(set);
  return set;
}

/**
 * RF-18 / RF-24. Writes on every validated set, never at the end of the session:
 * a crash, a phone call or a task-manager kill must not cost a single set
 * (non-negotiable rule n°4).
 *
 * `performedAt` is what makes the set visible to `getLastPerformance` — until
 * then it is 0 and sits below the index's lower bound.
 */
export async function completeSet(
  setId: string,
  values: { weight?: number; reps?: number; rpe?: number },
): Promise<void> {
  const existing = await db.workoutSets.get(setId);
  if (existing === undefined) return;
  await db.workoutSets.put(touch(existing, { ...values, isCompleted: 1, performedAt: Date.now() }));
}

export async function finishWorkout(workoutId: string): Promise<void> {
  const workout = await db.workouts.get(workoutId);
  if (workout === undefined) return;

  const endedAt = Date.now();
  await db.workouts.put(
    touch(workout, {
      status: 'completed',
      endedAt,
      durationSeconds: Math.round((endedAt - workout.startedAt) / 1000),
    }),
  );
}

/**
 * Soft-deletes the session AND its exercises AND its sets, in one transaction.
 *
 * Without the cascade a deleted session keeps feeding the previous-value display
 * and the records: a ghost row that is very hard to diagnose weeks later.
 */
export async function deleteWorkout(workoutId: string): Promise<void> {
  const deleted = { deletedAt: Date.now(), updatedAt: Date.now() };

  await db.transaction('rw', db.workouts, db.workoutExercises, db.workoutSets, async () => {
    await db.workoutSets.where('workoutId').equals(workoutId).modify(deleted);
    await db.workoutExercises.where('workoutId').equals(workoutId).modify(deleted);
    await softDelete(db.workouts, workoutId);
  });
}

/**
 * RF-19 — the critical query. Runs for every exercise when the live workout
 * screen opens, and the user expects it instantly. Hence the composite index
 * `[exerciseId+performedAt]` and the denormalised `exerciseId`: without them
 * this would be three cascading queries (§5.1).
 *
 * The lower bound is 1, not 0: sets that are not validated yet carry
 * `performedAt: 0` and must stay out.
 *
 * The scan walks backwards and stops on the first live set rather than reading
 * the last one and filtering after: a deleted session must fall back to the one
 * before it, not blank the display.
 */
export async function getLastPerformance(exerciseId: string): Promise<WorkoutSet[]> {
  const lastSet = await db.workoutSets
    .where('[exerciseId+performedAt]')
    .between([exerciseId, 1], [exerciseId, Dexie.maxKey])
    .reverse()
    .filter((set) => set.deletedAt === 0 && set.isCompleted === 1)
    .first();

  if (lastSet === undefined) return [];

  return db.workoutSets
    .where({ workoutExerciseId: lastSet.workoutExerciseId })
    .filter((set) => set.deletedAt === 0 && set.isCompleted === 1)
    .sortBy('order');
}
