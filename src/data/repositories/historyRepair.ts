import { db } from '@/data/db';
import type { Exercise, WorkoutExercise } from '@/data/types';
import { snapshotOf } from '@/lib/exerciseSnapshot';
import { touch } from './base';
import { reconcileRecordsForExercises } from './recordReconciliation';
import { getOneRepMaxFormula } from './settings';

/**
 * Replays the exercise snapshot of the whole history from today's library.
 *
 * **This deliberately repaints the past, which is the one thing milestone 08A
 * exists to prevent** — so it is never automatic and never silent. The snapshot
 * is right whenever the library was right when the session was recorded; it is
 * wrong when the library itself was wrong, and no amount of freezing fixes a
 * value that was already false. That was the case here: hip adduction was filed
 * under `glutes`, external rotation had no catalogue entry at all, and the
 * version 2 migration froze both onto every row it touched.
 *
 * The caller confirms first. The button says what it does, in French, and the
 * cost is real: a session whose exercise was legitimately renamed *after* it was
 * performed will take the new name.
 */
export interface HistoryRepairResult {
  /** Rows whose snapshot actually changed. */
  repaired: number;
  /** Rows left exactly as they were, for either reason below. */
  kept: number;
}

export interface HistoryRepairPreview {
  changed: number;
  names: number;
  muscles: number;
  equipment: number;
  measurements: number;
}

/**
 * Same list, same order, or the row is out of date.
 *
 * The secondaries are the one snapshot field that is an array, so it cannot be
 * compared with `!==` — two identical lists are two different objects. Order is
 * treated as significant rather than sorted away: `snapshotOf` copies the
 * catalogue's order verbatim, so a row that matches the library matches it
 * exactly, and a difference in order is a difference in what was written.
 */
function sameSecondaries(row: WorkoutExercise, exercise: Exercise): boolean {
  const stored = row.exerciseSecondaryMuscles ?? [];
  const current = exercise.secondaryMuscles;
  return stored.length === current.length && stored.every((muscle, i) => muscle === current[i]);
}

/**
 * Whether today's library says something different from what the row carries.
 *
 * **The secondaries joined this list when they joined the snapshot**, and
 * leaving them out was a silent half-repair: fixing an exercise's secondary
 * muscles alone left every past row untouched — the action reported "kept" and
 * changed nothing — while fixing them *alongside* a rename repaired them as a
 * side effect, since `snapshotOf` rewrites the whole snapshot at once. Repaired
 * or not depending on what else you happened to change is worse than never
 * repaired.
 */
function differs(row: WorkoutExercise, exercise: Exercise): boolean {
  return (
    row.exerciseName !== exercise.name ||
    row.exerciseMeasurementType !== exercise.measurementType ||
    row.exercisePrimaryMuscle !== exercise.primaryMuscle ||
    !sameSecondaries(row, exercise) ||
    row.exerciseEquipment !== exercise.equipment ||
    row.exerciseBodyweightLoadFactor !== exercise.bodyweightLoadFactor
  );
}

export async function inspectHistoryResnapshot(): Promise<HistoryRepairPreview> {
  const [rows, exercises] = await Promise.all([
    db.workoutExercises.toArray(),
    db.exercises.toArray(),
  ]);
  const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  const preview: HistoryRepairPreview = {
    changed: 0,
    names: 0,
    muscles: 0,
    equipment: 0,
    measurements: 0,
  };

  for (const row of rows) {
    const exercise = byId.get(row.exerciseId);
    if (exercise === undefined || !differs(row, exercise)) continue;

    preview.changed += 1;
    if (row.exerciseName !== exercise.name) preview.names += 1;
    if (row.exercisePrimaryMuscle !== exercise.primaryMuscle || !sameSecondaries(row, exercise)) {
      preview.muscles += 1;
    }
    if (row.exerciseEquipment !== exercise.equipment) preview.equipment += 1;
    if (
      row.exerciseMeasurementType !== exercise.measurementType ||
      row.exerciseBodyweightLoadFactor !== exercise.bodyweightLoadFactor
    ) {
      preview.measurements += 1;
    }
  }

  return preview;
}

export async function resnapshotHistory(): Promise<HistoryRepairResult> {
  return db.transaction(
    'rw',
    [
      db.settings,
      db.exercises,
      db.workouts,
      db.workoutExercises,
      db.workoutSets,
      db.bodyMeasurements,
      db.personalRecords,
    ],
    async () => {
      // Soft-deleted exercises included: `deleteExercise` never really removes
      // one, and a deleted exercise is still the exercise that was performed.
      const exercises = await db.exercises.toArray();
      const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));

      let repaired = 0;
      let kept = 0;
      const affectedExerciseIds = new Set<string>();

      await db.workoutExercises.toCollection().modify((row) => {
        const exercise = byId.get(row.exerciseId);
        // The guard that keeps this a repair rather than a loss: `snapshotOf`
        // returns `{}` for an unknown exercise, and writing that would erase the
        // only surviving record of what the row was.
        if (exercise === undefined || !differs(row, exercise)) {
          kept += 1;
          return;
        }

        const snapshot = snapshotOf(exercise);
        if (snapshot.exerciseBodyweightLoadFactor === undefined) {
          delete row.exerciseBodyweightLoadFactor;
        }
        Object.assign(row, touch(row, snapshot));
        affectedExerciseIds.add(row.exerciseId);
        repaired += 1;
      });

      await reconcileRecordsForExercises([...affectedExerciseIds], await getOneRepMaxFormula());

      return { repaired, kept };
    },
  );
}
