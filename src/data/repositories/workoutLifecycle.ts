import { db } from '@/data/db';
import type {
  Exercise,
  Routine,
  RoutineExercise,
  RoutineSet,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '@/data/types';
import { resolveRestSeconds } from '@/lib/rest';
import { localOffsetMinutes } from '@/lib/timezone';
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
export type ProgramWorkoutErrorCode = 'active_workout_exists';

export class ProgramWorkoutError extends Error {
  constructor(readonly code: ProgramWorkoutErrorCode) {
    super(code);
    this.name = 'ProgramWorkoutError';
  }
}

/** Must run inside the same `rw` transaction that inserts a new workout. */
export async function assertNoActiveWorkout(): Promise<void> {
  const activeWorkout = alive(await db.workouts.where('status').equals('active').toArray())[0];
  if (activeWorkout !== undefined) throw new ProgramWorkoutError('active_workout_exists');
}

export async function startWorkout(routineId: string, name: string): Promise<Workout> {
  const startedAt = Date.now();
  const workout = newEntity<Workout>({
    routineId,
    name,
    status: 'active',
    startedAt,
    endedAt: 0,
    durationSeconds: 0,
    startedTimezoneOffsetMinutes: localOffsetMinutes(startedAt),
  });
  await db.transaction('rw', db.workouts, async () => {
    await assertNoActiveWorkout();
    await db.workouts.add(workout);
  });
  return workout;
}

export interface WorkoutRoutineSource {
  routine: Routine;
  rows: RoutineExercise[];
  plannedSets: RoutineSet[];
  exercisesById: ReadonlyMap<string, Exercise>;
}

type WorkoutProgramContext = Pick<
  Workout,
  | 'programId'
  | 'programWeekIndex'
  | 'programScheduleEntryId'
  | 'programPhase'
  | 'programLoadIndex'
  | 'programIsDeload'
>;

export type WorkoutTargetSnapshot = Pick<
  RoutineSet,
  | 'targetReps'
  | 'targetRepsMax'
  | 'targetWeight'
  | 'targetDurationSeconds'
  | 'targetDistanceMeters'
  | 'targetRpe'
>;

export interface WorkoutEntityGraph {
  workout: Workout;
  exercises: WorkoutExercise[];
  sets: WorkoutSet[];
}

/** Reads the complete routine graph used by both regular and programmed starts. */
export async function readWorkoutRoutineSource(
  routineId: string,
): Promise<WorkoutRoutineSource | null> {
  const routine = await db.routines.get(routineId);
  if (routine === undefined || routine.deletedAt !== 0) return null;

  const rows = alive(
    await db.routineExercises.where('routineId').equals(routineId).toArray(),
  ).sort(byOrder);
  const rowIds = rows.map((row) => row.id);
  const plannedSets = (
    rowIds.length === 0
      ? []
      : alive(await db.routineSets.where('routineExerciseId').anyOf(rowIds).toArray())
  ).sort(byOrder);
  const library = await db.exercises.bulkGet([...new Set(rows.map((row) => row.exerciseId))]);
  const exercisesById = new Map(
    library.filter((exercise) => exercise !== undefined).map((exercise) => [exercise.id, exercise]),
  );

  return { routine, rows, plannedSets, exercisesById };
}

/** Builds immutable workout snapshots without writing, so callers own transaction scope. */
export function buildWorkoutEntities(input: {
  source: WorkoutRoutineSource;
  startedAt: number;
  programContext?: WorkoutProgramContext;
  targetsByRoutineSetId?: ReadonlyMap<string, WorkoutTargetSnapshot>;
}): WorkoutEntityGraph {
  const { source, startedAt } = input;
  const workout = newEntity<Workout>({
    routineId: source.routine.id,
    name: source.routine.name,
    status: 'active',
    startedAt,
    endedAt: 0,
    durationSeconds: 0,
    startedTimezoneOffsetMinutes: localOffsetMinutes(startedAt),
    ...input.programContext,
  });

  // Resolve rest and exercise identity once: later routine/library edits must
  // never reinterpret a session that is already running.
  const exercises = source.rows.map((row) =>
    newEntity<WorkoutExercise>({
      workoutId: workout.id,
      exerciseId: row.exerciseId,
      order: row.order,
      supersetGroup: row.supersetGroup,
      notes: row.notes,
      restSeconds: resolveRestSeconds(
        row.restSeconds,
        source.exercisesById.get(row.exerciseId)?.defaultRestSeconds,
      ),
      ...snapshotOf(source.exercisesById.get(row.exerciseId)),
    }),
  );

  const rowIndex = new Map(source.rows.map((row, index) => [row.id, index]));
  const sets = source.plannedSets.flatMap((plan) => {
    const index = rowIndex.get(plan.routineExerciseId);
    const parent = index === undefined ? undefined : exercises[index];
    if (parent === undefined) return [];
    // When a program projection map is supplied, only sets present in it are
    // materialised (deload drops one working set). Absent map = full routine.
    const projected = input.targetsByRoutineSetId?.get(plan.id);
    if (input.targetsByRoutineSetId !== undefined && projected === undefined) {
      return [];
    }
    const targets = projected ?? plan;

    return [
      newEntity<WorkoutSet>({
        workoutExerciseId: parent.id,
        exerciseId: parent.exerciseId,
        workoutId: workout.id,
        order: plan.order,
        setType: plan.setType,
        side: 'both',
        targetReps: targets.targetReps,
        targetRepsMax: targets.targetRepsMax,
        targetWeight: targets.targetWeight,
        targetDurationSeconds: targets.targetDurationSeconds,
        targetDistanceMeters: targets.targetDistanceMeters,
        targetRpe: targets.targetRpe,
        isCompleted: 0,
        performedAt: 0,
      }),
    ];
  });

  return { workout, exercises, sets };
}

/** Inserts a prebuilt graph in the caller's transaction. */
export async function insertWorkoutEntities(graph: WorkoutEntityGraph): Promise<void> {
  await db.workouts.add(graph.workout);
  if (graph.exercises.length > 0) await db.workoutExercises.bulkAdd(graph.exercises);
  if (graph.sets.length > 0) await db.workoutSets.bulkAdd(graph.sets);
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
  const source = await readWorkoutRoutineSource(routineId);
  if (source === null) {
    throw new Error(`Routine introuvable : ${routineId}`);
  }
  const graph = buildWorkoutEntities({ source, startedAt: Date.now() });

  await db.transaction('rw', db.workouts, db.workoutExercises, db.workoutSets, async () => {
    await assertNoActiveWorkout();
    await insertWorkoutEntities(graph);
  });

  return graph.workout;
}

export async function updateWorkout(
  id: string,
  changes: Partial<Pick<Workout, 'name' | 'notes'>>,
): Promise<void> {
  await db.transaction('rw', db.workouts, async () => {
    const workout = await db.workouts.get(id);
    if (workout === undefined) return;
    await db.workouts.put(touch(workout, changes));
  });
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
      await db.workoutSets.bulkPut(abandoned.map((set) => touch(set, { deletedAt: now })));
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
  await db.transaction('rw', RECORD_PROJECTION_TABLES, async () => {
    const workout = await db.workouts.get(workoutId);
    if (workout === undefined) return;
    const [rows, sets] = await Promise.all([
      db.workoutExercises.where('workoutId').equals(workoutId).toArray(),
      db.workoutSets.where('workoutId').equals(workoutId).toArray(),
    ]);
    const affectedExerciseIds = new Set([
      ...rows.map((row) => row.exerciseId),
      ...sets.map((set) => set.exerciseId),
    ]);
    const now = Date.now();

    await db.workoutSets
      .where('workoutId')
      .equals(workoutId)
      .modify({ deletedAt: now, updatedAt: now });
    await db.workoutExercises
      .where('workoutId')
      .equals(workoutId)
      .modify({ deletedAt: now, updatedAt: now });
    await db.workouts.put(touch(workout, { status: 'discarded', deletedAt: now }));
    await reconcileRecordsForExercises([...affectedExerciseIds], await getOneRepMaxFormula());
  });
}

/**
 * Soft-deletes the session AND its exercises AND its sets, in one transaction.
 *
 * Without the cascade a deleted session keeps feeding the previous-value display
 * and the records: a ghost row that is very hard to diagnose weeks later.
 */
export async function deleteWorkout(workoutId: string): Promise<void> {
  await db.transaction('rw', RECORD_PROJECTION_TABLES, async () => {
    const [rows, sets] = await Promise.all([
      db.workoutExercises.where('workoutId').equals(workoutId).toArray(),
      db.workoutSets.where('workoutId').equals(workoutId).toArray(),
    ]);
    const affectedExerciseIds = new Set([
      ...rows.map((row) => row.exerciseId),
      ...sets.map((set) => set.exerciseId),
    ]);
    const deleted = { deletedAt: Date.now(), updatedAt: Date.now() };

    await db.workoutSets.where('workoutId').equals(workoutId).modify(deleted);
    await db.workoutExercises.where('workoutId').equals(workoutId).modify(deleted);
    await softDelete(db.workouts, workoutId);
    await reconcileRecordsForExercises([...affectedExerciseIds], await getOneRepMaxFormula());
  });
}
