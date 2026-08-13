import { db } from '@/data/db';
import type { Exercise, Workout, WorkoutExercise, WorkoutSet } from '@/data/types';
import {
  collectCoachSignals,
  evaluateCoach,
  pickSignals,
  type CoachExerciseLine,
  type CoachSignal,
  type CoachSignalCode,
} from '@/lib/coach';
import { coachLineFromSource } from '@/lib/coach/fromWorkout';
import { alive } from './base';
import { recordCoachSignals, reconcileFollowedLoads } from './coachRecommendations';
import { getOneRepMaxFormula } from './settings';
import { getWorkoutDetail, workoutExerciseIdentityOf } from './workoutDetail';

const PROGRAM_ALLOWED_CODES = new Set<CoachSignalCode>([
  'intra_session_drop',
  'long_rest',
]);

/**
 * Build coach history lines for the given exercise ids (completed sets only).
 * Used at end of session so plateau sees prior workouts.
 */
export async function loadCoachHistoryLines(
  exerciseIds: readonly string[],
  options: { excludeWorkoutId?: string } = {},
): Promise<CoachExerciseLine[]> {
  if (exerciseIds.length === 0) return [];

  const uniqueIds = [...new Set(exerciseIds)];
  const sets = alive(
    await db.workoutSets
      .where('exerciseId')
      .anyOf(uniqueIds)
      .filter((set) => set.isCompleted === 1 && set.performedAt > 0)
      .toArray(),
  ).filter((set) => set.workoutId !== (options.excludeWorkoutId ?? ''));

  if (sets.length === 0) return [];

  const workoutIds = [...new Set(sets.map((set) => set.workoutId))];
  const rowIds = [...new Set(sets.map((set) => set.workoutExerciseId))];
  const [workouts, exercises, rows] = await Promise.all([
    db.workouts.bulkGet(workoutIds),
    db.exercises.bulkGet(uniqueIds),
    db.workoutExercises.bulkGet(rowIds),
  ]);

  const workoutById = new Map<string, Workout>();
  for (const workout of workouts) {
    if (workout !== undefined && workout.deletedAt === 0) workoutById.set(workout.id, workout);
  }

  const exerciseById = new Map<string, Exercise>();
  for (const exercise of exercises) {
    if (exercise !== undefined) exerciseById.set(exercise.id, exercise);
  }

  const rowById = new Map<string, WorkoutExercise>();
  for (const row of rows) {
    if (row !== undefined) rowById.set(row.id, row);
  }

  const blocks = new Map<
    string,
    { workout: Workout; exerciseId: string; rowId: string; sets: WorkoutSet[] }
  >();

  for (const set of sets) {
    const workout = workoutById.get(set.workoutId);
    if (workout === undefined) continue;
    const block = blocks.get(set.workoutExerciseId);
    if (block === undefined) {
      blocks.set(set.workoutExerciseId, {
        workout,
        exerciseId: set.exerciseId,
        rowId: set.workoutExerciseId,
        sets: [set],
      });
    } else {
      block.sets.push(set);
    }
  }

  const lines: CoachExerciseLine[] = [];
  for (const block of blocks.values()) {
    const exercise = exerciseById.get(block.exerciseId);
    const row = rowById.get(block.rowId);
    const measurementType =
      exercise?.measurementType ?? row?.exerciseMeasurementType;
    if (measurementType === undefined) continue;

    lines.push(
      coachLineFromSource({
        workout: block.workout,
        exerciseId: block.exerciseId,
        measurementType,
        equipment: exercise?.equipment ?? row?.exerciseEquipment ?? 'other',
        loadIncrementKg: exercise?.loadIncrementKg,
        sets: block.sets.sort((a, b) => a.order - b.order),
      }),
    );
  }

  return lines;
}

/** Signals for the open finish screen (current session + history). */
export async function evaluateCoachForWorkout(workoutId: string): Promise<CoachSignal[]> {
  const detail = await getWorkoutDetail(workoutId);
  if (detail === null) return [];

  const formula = await getOneRepMaxFormula();
  const exerciseIds = detail.exercises.map((line) => line.row.exerciseId);

  const history = await loadCoachHistoryLines(exerciseIds, { excludeWorkoutId: workoutId });

  const current: CoachExerciseLine[] = [];
  for (const line of detail.exercises) {
    const identity = workoutExerciseIdentityOf(line);
    if (identity.measurementType === undefined) continue;
    current.push(
      coachLineFromSource({
        workout: detail.workout,
        exerciseId: line.row.exerciseId,
        measurementType: identity.measurementType,
        equipment: identity.equipment ?? line.exercise?.equipment ?? 'other',
        loadIncrementKg: line.exercise?.loadIncrementKg,
        sets: line.sets,
      }),
    );
  }

  const lines = [...history, ...current];
  if (detail.workout.programId === undefined) {
    return evaluateCoach(lines, { formula });
  }

  return pickSignals(
    collectCoachSignals(lines, { formula }).filter((signal) =>
      PROGRAM_ALLOWED_CODES.has(signal.code),
    ),
  );
}

/**
 * Persist finish-screen signals and mark loads that match pending objectives.
 * Call after `finishWorkout` so abandoned sets are already gone.
 */
export async function finalizeCoachForWorkout(workoutId: string): Promise<CoachSignal[]> {
  const signals = await evaluateCoachForWorkout(workoutId);
  await recordCoachSignals(signals, {
    workoutId,
    recommendedAt: Date.now(),
  });

  const detail = await getWorkoutDetail(workoutId);
  if (detail !== null) {
    const outcomes = detail.exercises
      .map((line) => {
        const working = line.sets.filter(
          (set) => set.isCompleted === 1 && set.weight !== undefined,
        );
        const last = working[working.length - 1];
        return {
          exerciseId: line.row.exerciseId,
          loadKg: last?.weight ?? Number.NaN,
          workoutId,
        };
      })
      .filter((item) => Number.isFinite(item.loadKg));

    await reconcileFollowedLoads(outcomes);
  }

  return signals;
}
