import { db } from '@/data/db';
import type { SetType, Syncable, WorkoutSet } from '@/data/types';
import type { WarmupSetSuggestion } from '@/lib/warmup';
import { alive, newEntity, softDelete, touch } from './base';

/** What a caller may set on a new set. The identity fields are derived, never passed. */
export type NewSetValues = Partial<
  Omit<WorkoutSet, keyof Syncable | 'workoutExerciseId' | 'exerciseId' | 'workoutId'>
>;

/** What the grid writes as it is typed, and what the tick validates. */
export type SetValues = Pick<
  WorkoutSet,
  'weight' | 'reps' | 'durationSeconds' | 'distanceMeters' | 'rpe'
>;

/**
 * Reads and replaces one set under the same IndexedDB write transaction.
 *
 * IndexedDB serializes overlapping read-write transactions that touch this
 * object store. The callback therefore derives its replacement from the state
 * left by the transaction ordered before it, rather than publishing a stale
 * whole-row snapshot after another repository operation has committed.
 */
async function mutateSet(
  setId: string,
  changes: (set: WorkoutSet) => Partial<WorkoutSet>,
): Promise<void> {
  await db.transaction('rw', db.workoutSets, async () => {
    const set = await db.workoutSets.get(setId);
    if (set === undefined) return;
    await db.workoutSets.put(touch(set, changes(set)));
  });
}

const byOrder = <T extends { order: number }>(a: T, b: T): number => a.order - b.order;

const liveSetsOf = async (workoutExerciseId: string): Promise<WorkoutSet[]> =>
  alive(await db.workoutSets.where('workoutExerciseId').equals(workoutExerciseId).toArray()).sort(
    byOrder,
  );

// ---------------------------------------------------------------------------
// Sets (RF-18, RF-21, RF-24)
// ---------------------------------------------------------------------------

/**
 * Appends a set to an exercise of the current workout — the one write path for
 * `addSet` and `duplicateLastSet`, which differ only in what they derive from
 * the siblings.
 *
 * `exerciseId` and `workoutId` are copied from the parent row rather than
 * accepted from the caller: they are denormalised for the sake of one index
 * (§5), and a copy that can disagree with its source is a bug waiting to
 * happen.
 *
 * The rank comes from the **live** siblings. Dexie's `.count()` does not filter
 * `deletedAt`, so counting rows would hand a freshly added set the rank of one
 * that was deleted.
 *
 * Reading that rank and writing the set is **one transaction**, and that is the
 * whole point. Read-then-write outside one leaves the gap open for a second
 * call to read the same length before the first has written: two live sets at
 * the same `order`, displayed in whatever order IndexedDB returns them, and a
 * `getLastPerformance` — indexed by `order` — matching ranks ambiguously next
 * session. It takes no exotic timing, only a double tap or a late frame; it was
 * reproduced with two clicks in the same JS tick. Same symptom as the `.count()`
 * trap, another cause.
 */
async function appendSet(
  workoutExerciseId: string,
  derive: (siblings: WorkoutSet[]) => NewSetValues,
): Promise<WorkoutSet> {
  return db.transaction('rw', db.workoutExercises, db.workoutSets, async () => {
    const parent = await db.workoutExercises.get(workoutExerciseId);
    if (parent === undefined) {
      throw new Error(`Ligne d'exercice introuvable : ${workoutExerciseId}`);
    }

    const siblings = await liveSetsOf(workoutExerciseId);

    const set = newEntity<WorkoutSet>({
      order: siblings.length,
      setType: 'normal',
      side: 'both',
      isCompleted: 0,
      performedAt: 0,
      ...derive(siblings),
      workoutExerciseId,
      exerciseId: parent.exerciseId,
      workoutId: parent.workoutId,
    });

    await db.workoutSets.add(set);
    return set;
  });
}

export async function addSet(
  workoutExerciseId: string,
  values: NewSetValues = {},
): Promise<WorkoutSet> {
  return appendSet(workoutExerciseId, () => values);
}

/**
 * Appends a set **proposing the last one again** — another set at the same load
 * is by far the most common next move, and this makes it one tap.
 *
 * What the previous set holds becomes the new one's *prescription*, not its
 * result: the figures come up greyed, and the tick is what turns them into
 * something performed. A set that arrived already filled in would be a set the
 * app claims you did.
 *
 * The last set is read from the same siblings the rank comes from, inside the
 * same transaction: what is copied and where it lands are one decision.
 */
export async function duplicateLastSet(workoutExerciseId: string): Promise<WorkoutSet> {
  return appendSet(workoutExerciseId, (siblings) => {
    const last = siblings.at(-1);

    return {
      setType: last?.setType ?? 'normal',
      targetReps: last?.reps ?? last?.targetReps,
      targetRepsMax: last?.reps === undefined ? last?.targetRepsMax : undefined,
      targetWeight: last?.weight ?? last?.targetWeight,
      targetDurationSeconds: last?.durationSeconds ?? last?.targetDurationSeconds,
      targetDistanceMeters: last?.distanceMeters ?? last?.targetDistanceMeters,
    };
  });
}

/**
 * Inserts a complete warm-up ramp before the existing live sets.
 *
 * The generated figures are prescriptions only. The athlete still validates
 * every set in the grid, so performed values and completion timestamps remain
 * empty until that tap.
 *
 * Reading, inserting and shifting share one Dexie transaction. Concurrent
 * insertions therefore cannot leave duplicate ranks, and a failure while
 * shifting rolls the whole ramp back.
 */
export async function insertWarmupSets(
  workoutExerciseId: string,
  suggestions: readonly WarmupSetSuggestion[],
): Promise<WorkoutSet[]> {
  return db.transaction('rw', db.workoutExercises, db.workoutSets, async () => {
    const parent = await db.workoutExercises.get(workoutExerciseId);
    if (parent === undefined) {
      throw new Error(`Ligne d’exercice introuvable : ${workoutExerciseId}`);
    }

    const siblings = await liveSetsOf(workoutExerciseId);
    const inserted = suggestions.map((suggestion, order) =>
      newEntity<WorkoutSet>({
        workoutExerciseId,
        exerciseId: parent.exerciseId,
        workoutId: parent.workoutId,
        order,
        setType: 'warmup',
        side: 'both',
        targetWeight: suggestion.weightKg,
        targetReps: suggestion.reps,
        isCompleted: 0,
        performedAt: 0,
      }),
    );
    const shifted = siblings.map((set, index) => touch(set, { order: inserted.length + index }));

    if (inserted.length > 0) {
      await db.workoutSets.bulkAdd(inserted);
    }
    if (shifted.length > 0) {
      await db.workoutSets.bulkPut(shifted);
    }

    return inserted;
  });
}

/**
 * RF-24 — what the grid writes as it is typed.
 *
 * Earlier than the non-negotiable rule n°4 asks for: the rule requires a write
 * on every validated set, this writes on every keystroke. `isCompleted` and
 * `performedAt` stay at 0, so nothing enters the history and nothing feeds the
 * previous-value column — but a kill of the app does not even cost the three
 * characters being typed.
 *
 * `undefined` erases: emptying a field must clear the value, not silently keep
 * the old one under a blank cell.
 */
export async function updateSetValues(setId: string, values: Partial<SetValues>): Promise<void> {
  await mutateSet(setId, () => values);
}

/**
 * RF-20 — what kind of set this is, decided **with the bar in your hands**.
 *
 * Only warm-up and normal can be planned (`RoutineSetSheet`): whether a set
 * turns into a drop set or goes to failure is not something a routine written on
 * the sofa can know. Changing the type never touches the figures — a set
 * re-labelled as a warm-up keeps what was lifted, it simply stops counting
 * towards volume and records (`isWorkingSet`).
 */
export async function updateSetType(setId: string, setType: SetType): Promise<void> {
  await mutateSet(setId, () => ({ setType }));
}

/**
 * RF-18 — the tick. `performedAt` is what makes the set visible to
 * `getLastPerformance`; until then it is 0 and sits below the index's lower
 * bound.
 */
export async function completeSet(
  setId: string,
  values: Partial<SetValues> = {},
): Promise<void> {
  await mutateSet(setId, () => ({ ...values, isCompleted: 1, performedAt: Date.now() }));
}

/**
 * Un-ticks a set — a mis-tap is the most likely error on this screen.
 *
 * The values stay: un-ticking corrects a gesture, it does not erase what was
 * typed. `performedAt` returns to 0, which is what takes the set back out of
 * the history and out of the previous-value column.
 */
export async function uncompleteSet(setId: string): Promise<void> {
  await mutateSet(setId, () => ({ isCompleted: 0, performedAt: 0 }));
}

/** Renumbers what is left: "série 1, série 3" is a hole you can read on screen. */
export async function deleteSet(setId: string): Promise<void> {
  await db.transaction('rw', db.workoutSets, async () => {
    const set = await db.workoutSets.get(setId);
    if (set === undefined) return;
    await softDelete(db.workoutSets, setId);

    const renumbered = (await liveSetsOf(set.workoutExerciseId))
      .map((row, order) => ({ row, order }))
      .filter(({ row, order }) => row.order !== order)
      .map(({ row, order }) => touch(row, { order }));

    if (renumbered.length > 0) await db.workoutSets.bulkPut(renumbered);
  });
}

/**
 * Reprend une suppression — la contrepartie du balayage, qui supprime sans
 * demander.
 *
 * La suppression est douce : la ligne n'a jamais quitté la base, seul son rang
 * est parti. `deleteSet` a retassé ses voisines derrière elle, si bien que son
 * ancien `order` est maintenant occupé — c'est **devant** l'occupante qu'elle
 * doit revenir, sinon une série reprise à la deuxième place réapparaît à la
 * troisième et le rang affiché ment sur ce qui a été soulevé.
 *
 * D'où le tri à deux clés : l'ordre, puis la rescapée d'abord à égalité.
 */
export async function restoreSet(setId: string): Promise<void> {
  await db.transaction('rw', db.workoutSets, async () => {
    const set = await db.workoutSets.get(setId);
    if (set === undefined || set.deletedAt === 0) return;

    await db.workoutSets.put(touch(set, { deletedAt: 0 }));

    const renumbered = (await liveSetsOf(set.workoutExerciseId))
      .sort((a, b) => a.order - b.order || (a.id === setId ? -1 : b.id === setId ? 1 : 0))
      .map((row, order) => ({ row, order }))
      .filter(({ row, order }) => row.order !== order)
      .map(({ row, order }) => touch(row, { order }));

    if (renumbered.length > 0) await db.workoutSets.bulkPut(renumbered);
  });
}
