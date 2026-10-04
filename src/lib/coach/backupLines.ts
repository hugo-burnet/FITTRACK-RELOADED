import type { Exercise, Workout, WorkoutExercise, WorkoutSet } from '@/data/types';
import type { BackupFile, BackupRow } from '@/lib/backup/types';
import { coachLineFromSource } from './fromWorkout';
import type { CoachExerciseLine } from './types';

/**
 * A backup has passed `parseBackup`'s structural check: its rows are the
 * app's own records, serialised. Reading them back as such is the whole point
 * of the replay bench — normalising them here would replay a different
 * history from the one the engine saw on the phone.
 */
function rowsOf<T>(table: readonly BackupRow[] | undefined): T[] {
  return (table ?? []) as unknown as T[];
}

/**
 * Coach lines from a backup file, for the replay bench (spec coach v2 § 7).
 *
 * Same reading as `loadCoachHistoryLines` — completed, timestamped sets of
 * living workouts; measurement and equipment from the library exercise, else
 * from the line's snapshot — without Dexie: a backup is a frozen history
 * replayed outside the app. Workouts still `active` are left out, because a
 * replay judges sessions that ended.
 */
export function coachLinesFromBackup(backup: BackupFile): CoachExerciseLine[] {
  const workouts = new Map<string, Workout>();
  for (const workout of rowsOf<Workout>(backup.tables.workouts)) {
    if (!workout.deletedAt && workout.status === 'completed') workouts.set(workout.id, workout);
  }
  const exercises = new Map<string, Exercise>();
  for (const exercise of rowsOf<Exercise>(backup.tables.exercises)) {
    exercises.set(exercise.id, exercise);
  }
  const rows = new Map<string, WorkoutExercise>();
  for (const row of rowsOf<WorkoutExercise>(backup.tables.workoutExercises)) {
    rows.set(row.id, row);
  }

  const blocks = new Map<string, WorkoutSet[]>();
  for (const set of rowsOf<WorkoutSet>(backup.tables.workoutSets)) {
    if (set.deletedAt || set.isCompleted !== 1 || !(set.performedAt > 0)) continue;
    if (!workouts.has(set.workoutId)) continue;
    const block = blocks.get(set.workoutExerciseId);
    if (block === undefined) blocks.set(set.workoutExerciseId, [set]);
    else block.push(set);
  }

  const lines: CoachExerciseLine[] = [];
  for (const [rowId, sets] of blocks) {
    const first = sets[0]!;
    const workout = workouts.get(first.workoutId)!;
    const exercise = exercises.get(first.exerciseId);
    const row = rows.get(rowId);
    const measurementType = exercise?.measurementType ?? row?.exerciseMeasurementType;
    if (measurementType === undefined) continue;

    lines.push(
      coachLineFromSource({
        workout,
        exerciseId: first.exerciseId,
        measurementType,
        equipment: exercise?.equipment ?? row?.exerciseEquipment ?? 'other',
        loadIncrementKg: exercise?.loadIncrementKg,
        sets: sets.slice().sort((a, b) => a.order - b.order),
      }),
    );
  }
  return lines;
}
