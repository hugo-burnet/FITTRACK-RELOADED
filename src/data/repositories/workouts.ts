import { db } from '@/data/db';
import type {
  Exercise,
  SetType,
  Syncable,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '@/data/types';
import { resolveRestSeconds } from '@/lib/rest';
import { moveItem, normalizeSupersets } from '@/lib/routineOrder';
import { alive, newEntity, softDelete, touch } from './base';
import { getLastPerformance } from './workoutHistory';

/** What a caller may set on a new set. The identity fields are derived, never passed. */
export type NewSetValues = Partial<
  Omit<WorkoutSet, keyof Syncable | 'workoutExerciseId' | 'exerciseId' | 'workoutId'>
>;

/** What the grid writes as it is typed, and what the tick validates. */
export type SetValues = Pick<
  WorkoutSet,
  'weight' | 'reps' | 'durationSeconds' | 'distanceMeters' | 'rpe'
>;

const byOrder = <T extends { order: number }>(a: T, b: T): number => a.order - b.order;

const liveSetsOf = async (workoutExerciseId: string): Promise<WorkoutSet[]> =>
  alive(await db.workoutSets.where('workoutExerciseId').equals(workoutExerciseId).toArray()).sort(
    byOrder,
  );

// ---------------------------------------------------------------------------
// Starting and closing a session (RF-17, RF-24, RF-25)
// ---------------------------------------------------------------------------

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
 * RF-17 — a session laid out from a routine: its exercises, their order, their
 * superset groups, their notes and their planned sets.
 *
 * The prescription is copied into the set's `target*` fields, **never into
 * `weight`/`reps`**. One rule follows from that and the screen rests on it
 * entirely: nothing is shown in ink until it is typed. What the routine asks
 * for is greyed, exactly like what you lifted last week, and the tick records
 * whichever of the two is offered.
 *
 * Filling `reps` directly was the first attempt and it broke on the very first
 * real routine: a range of 8 – 12 is not a number, so it landed nowhere and the
 * screen showed an empty box where the routine had a prescription.
 */
export async function startWorkoutFromRoutine(routineId: string): Promise<Workout> {
  const routine = await db.routines.get(routineId);
  if (routine === undefined || routine.deletedAt !== 0) {
    throw new Error(`Routine introuvable : ${routineId}`);
  }

  const rows = alive(await db.routineExercises.where('routineId').equals(routineId).toArray()).sort(
    byOrder,
  );
  const planned = alive(
    await db.routineSets
      .where('routineExerciseId')
      .anyOf(rows.map((row) => row.id))
      .toArray(),
  ).sort(byOrder);

  const workout = newEntity<Workout>({
    routineId,
    name: routine.name,
    status: 'active',
    startedAt: Date.now(),
    endedAt: 0,
    durationSeconds: 0,
  });

  // The rest is resolved **here**, once, and copied in: the routine may be
  // edited or deleted while the session runs, and `0` on a routine row means
  // "use the exercise's default", which only the library can answer.
  const library = await db.exercises.bulkGet([...new Set(rows.map((row) => row.exerciseId))]);
  const defaultRest = new Map(
    library
      .filter((exercise) => exercise !== undefined)
      .map((exercise) => [exercise.id, exercise.defaultRestSeconds]),
  );

  const exercises = rows.map((row) =>
    newEntity<WorkoutExercise>({
      workoutId: workout.id,
      exerciseId: row.exerciseId,
      order: row.order,
      supersetGroup: row.supersetGroup,
      notes: row.notes,
      restSeconds: resolveRestSeconds(row.restSeconds, defaultRest.get(row.exerciseId)),
    }),
  );

  const rowIndex = new Map(rows.map((row, index) => [row.id, index]));
  const sets = planned.flatMap((plan) => {
    const index = rowIndex.get(plan.routineExerciseId);
    const parent = index === undefined ? undefined : exercises[index];
    if (parent === undefined) return [];

    return [
      newEntity<WorkoutSet>({
        workoutExerciseId: parent.id,
        exerciseId: parent.exerciseId,
        workoutId: workout.id,
        order: plan.order,
        setType: plan.setType,
        side: 'both',
        targetReps: plan.targetReps,
        targetRepsMax: plan.targetRepsMax,
        targetWeight: plan.targetWeight,
        targetDurationSeconds: plan.targetDurationSeconds,
        targetDistanceMeters: plan.targetDistanceMeters,
        isCompleted: 0,
        performedAt: 0,
      }),
    ];
  });

  await db.transaction('rw', db.workouts, db.workoutExercises, db.workoutSets, async () => {
    await db.workouts.add(workout);
    await db.workoutExercises.bulkAdd(exercises);
    await db.workoutSets.bulkAdd(sets);
  });

  return workout;
}

export async function updateWorkout(
  id: string,
  changes: Partial<Pick<Workout, 'name' | 'notes'>>,
): Promise<void> {
  const workout = await db.workouts.get(id);
  if (workout === undefined) return;
  await db.workouts.put(touch(workout, changes));
}

/**
 * Closes the session — and **drops what did not happen**.
 *
 * A routine of six exercises at four sets lays out twenty-four rows; you do
 * seventeen. The other seven are not sets at zero, they are sets that did not
 * take place: kept, they would show up in the history, in the set counts and in
 * `getLastPerformance` as empty performances. An exercise left with no
 * validated set at all goes the same way.
 */
export async function finishWorkout(workoutId: string): Promise<void> {
  await db.transaction('rw', db.workouts, db.workoutExercises, db.workoutSets, async () => {
    const workout = await db.workouts.get(workoutId);
    if (workout === undefined) return;

    const now = Date.now();
    const sets = alive(await db.workoutSets.where('workoutId').equals(workoutId).toArray());

    const abandoned = sets.filter((set) => set.isCompleted === 0);
    if (abandoned.length > 0) {
      await db.workoutSets.bulkPut(
        abandoned.map((set) => touch(set, { deletedAt: now })),
      );
    }

    const withResults = new Set(
      sets.filter((set) => set.isCompleted === 1).map((set) => set.workoutExerciseId),
    );
    const empty = alive(
      await db.workoutExercises.where('workoutId').equals(workoutId).toArray(),
    ).filter((row) => !withResults.has(row.id));
    if (empty.length > 0) {
      await db.workoutExercises.bulkPut(empty.map((row) => touch(row, { deletedAt: now })));
    }

    await db.workouts.put(
      touch(workout, {
        status: 'completed',
        endedAt: now,
        durationSeconds: Math.round((now - workout.startedAt) / 1000),
      }),
    );
  });
}

/**
 * Abandons the session: the status **and** the cascade.
 *
 * The status alone would not be enough. Its validated sets keep
 * `isCompleted: 1` and `performedAt > 0`, and both `getLastPerformance` and the
 * records of Lot 3 read sets without ever looking at their session's status —
 * so a session you gave up on would become the reference for the next one. The
 * row survives for the trash and for the Lot 14 sync; nothing reads it.
 */
export async function discardWorkout(workoutId: string): Promise<void> {
  const workout = await db.workouts.get(workoutId);
  if (workout === undefined) return;

  const now = Date.now();
  await db.transaction('rw', db.workouts, db.workoutExercises, db.workoutSets, async () => {
    await db.workoutSets
      .where('workoutId')
      .equals(workoutId)
      .modify({ deletedAt: now, updatedAt: now });
    await db.workoutExercises
      .where('workoutId')
      .equals(workoutId)
      .modify({ deletedAt: now, updatedAt: now });
    await db.workouts.put(touch(workout, { status: 'discarded', deletedAt: now }));
  });
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
    const rows = alive(await db.workoutExercises.where('workoutId').equals(workoutId).toArray()).sort(
      byOrder,
    );

    const next = normalizeSupersets(transform(rows)).map((row, order) => ({ ...row, order }));
    const before = new Map(rows.map((row) => [row.id, row]));

    const changed = next.filter((row) => {
      const was = before.get(row.id);
      return was === undefined || was.order !== row.order || was.supersetGroup !== row.supersetGroup;
    });

    if (changed.length > 0) await db.workoutExercises.bulkPut(changed.map((row) => touch(row, {})));
  });
}

/**
 * RF-21 — an exercise you did not plan, added mid-session, **with a first set**.
 * An exercise carrying no row to tick is a dead end.
 */
export async function addWorkoutExercise(
  workoutId: string,
  exerciseId: string,
): Promise<WorkoutExercise> {
  const count = alive(await db.workoutExercises.where('workoutId').equals(workoutId).toArray())
    .length;

  // No routine to override anything: an exercise added mid-session takes its
  // own default, or the product default.
  const exercise = await db.exercises.get(exerciseId);

  const row = newEntity<WorkoutExercise>({
    workoutId,
    exerciseId,
    order: count,
    supersetGroup: 0,
    restSeconds: resolveRestSeconds(undefined, exercise?.defaultRestSeconds),
  });

  await db.transaction('rw', db.workoutExercises, db.workoutSets, async () => {
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
  });

  return row;
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
  await db.transaction('rw', db.workoutExercises, db.workoutSets, async () => {
    const row = await db.workoutExercises.get(workoutExerciseId);
    if (row === undefined) return;

    const now = Date.now();
    await db.workoutSets
      .where('workoutExerciseId')
      .equals(workoutExerciseId)
      .modify({ deletedAt: now, updatedAt: now });
    await softDelete(db.workoutExercises, workoutExerciseId);

    await rewriteOrder(row.workoutId, (rows) => rows);
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

// ---------------------------------------------------------------------------
// Sets (RF-18, RF-21, RF-24)
// ---------------------------------------------------------------------------

/**
 * Appends a set to an exercise of the current workout.
 *
 * `exerciseId` and `workoutId` are copied from the parent row rather than
 * accepted from the caller: they are denormalised for the sake of one index
 * (§5), and a copy that can disagree with its source is a bug waiting to
 * happen.
 *
 * The rank comes from the **live** siblings. Dexie's `.count()` does not filter
 * `deletedAt`, so counting rows would hand a freshly added set the rank of one
 * that was deleted, and two sets sharing an `order` display in whatever order
 * IndexedDB happens to return them.
 */
export async function addSet(
  workoutExerciseId: string,
  values: NewSetValues = {},
): Promise<WorkoutSet> {
  const parent = await db.workoutExercises.get(workoutExerciseId);
  if (parent === undefined) {
    throw new Error(`Ligne d'exercice introuvable : ${workoutExerciseId}`);
  }

  const set = newEntity<WorkoutSet>({
    order: (await liveSetsOf(workoutExerciseId)).length,
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
 * Appends a set **proposing the last one again** — another set at the same load
 * is by far the most common next move, and this makes it one tap.
 *
 * What the previous set holds becomes the new one's *prescription*, not its
 * result: the figures come up greyed, and the tick is what turns them into
 * something performed. A set that arrived already filled in would be a set the
 * app claims you did.
 */
export async function duplicateLastSet(workoutExerciseId: string): Promise<WorkoutSet> {
  const last = (await liveSetsOf(workoutExerciseId)).at(-1);

  return addSet(workoutExerciseId, {
    setType: last?.setType ?? 'normal',
    targetReps: last?.reps ?? last?.targetReps,
    targetRepsMax: last?.reps === undefined ? last?.targetRepsMax : undefined,
    targetWeight: last?.weight ?? last?.targetWeight,
    targetDurationSeconds: last?.durationSeconds ?? last?.targetDurationSeconds,
    targetDistanceMeters: last?.distanceMeters ?? last?.targetDistanceMeters,
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
  const set = await db.workoutSets.get(setId);
  if (set === undefined) return;
  await db.workoutSets.put(touch(set, values));
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
  const set = await db.workoutSets.get(setId);
  if (set === undefined) return;
  await db.workoutSets.put(touch(set, { setType }));
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
  const set = await db.workoutSets.get(setId);
  if (set === undefined) return;
  await db.workoutSets.put(touch(set, { ...values, isCompleted: 1, performedAt: Date.now() }));
}

/**
 * Un-ticks a set — a mis-tap is the most likely error on this screen.
 *
 * The values stay: un-ticking corrects a gesture, it does not erase what was
 * typed. `performedAt` returns to 0, which is what takes the set back out of
 * the history and out of the previous-value column.
 */
export async function uncompleteSet(setId: string): Promise<void> {
  const set = await db.workoutSets.get(setId);
  if (set === undefined) return;
  await db.workoutSets.put(touch(set, { isCompleted: 0, performedAt: 0 }));
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

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export interface WorkoutExerciseDetail {
  row: WorkoutExercise;
  /** `undefined` when the exercise was deleted from the library after being added. */
  exercise: Exercise | undefined;
  sets: WorkoutSet[];
  /** RF-19 — the same exercise, last time. Never this session. */
  previous: WorkoutSet[];
}

export interface WorkoutDetail {
  workout: Workout;
  exercises: WorkoutExerciseDetail[];
}

/**
 * Everything the live screen draws, in one read.
 *
 * Returns `null` and never `undefined` for a session that is gone: `useLiveQuery`
 * uses `undefined` for "has not answered yet", and blurring the two makes a
 * freshly opened screen flash its empty state.
 */
export async function getWorkoutDetail(workoutId: string): Promise<WorkoutDetail | null> {
  const workout = await db.workouts.get(workoutId);
  if (workout === undefined || workout.deletedAt !== 0) return null;

  const rows = alive(await db.workoutExercises.where('workoutId').equals(workoutId).toArray()).sort(
    byOrder,
  );

  const [sets, found] = await Promise.all([
    db.workoutSets
      .where('workoutExerciseId')
      .anyOf(rows.map((row) => row.id))
      .toArray(),
    db.exercises.bulkGet([...new Set(rows.map((row) => row.exerciseId))]),
  ]);

  const library = new Map<string, Exercise>();
  // A soft-deleted exercise reads as missing, exactly as `getExercise` has it.
  for (const exercise of found) {
    if (exercise !== undefined && exercise.deletedAt === 0) library.set(exercise.id, exercise);
  }

  const setsPerRow = new Map<string, WorkoutSet[]>();
  for (const set of alive(sets)) {
    const list = setsPerRow.get(set.workoutExerciseId);
    if (list === undefined) setsPerRow.set(set.workoutExerciseId, [set]);
    else list.push(set);
  }

  // One lookup per distinct exercise, not per row: the same movement done twice
  // in a session has one and the same "last time".
  const history = new Map<string, WorkoutSet[]>();
  await Promise.all(
    [...new Set(rows.map((row) => row.exerciseId))].map(async (exerciseId) => {
      history.set(exerciseId, await getLastPerformance(exerciseId, workoutId));
    }),
  );

  return {
    workout,
    exercises: rows.map((row) => ({
      row,
      exercise: library.get(row.exerciseId),
      sets: (setsPerRow.get(row.id) ?? []).sort(byOrder),
      previous: history.get(row.exerciseId) ?? [],
    })),
  };
}

