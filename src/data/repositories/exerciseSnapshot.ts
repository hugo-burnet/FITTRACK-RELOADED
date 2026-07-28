import { db } from '@/data/db';
import { type ExerciseSnapshot, snapshotOf } from '@/lib/exerciseSnapshot';

/**
 * Snapshots for a set of exercise ids, in one round trip.
 *
 * Reads through `bulkGet` rather than `alive()`: a soft-deleted exercise is
 * still the exercise that was performed, and refusing to copy its name would
 * lose the one piece of information the snapshot exists to keep.
 */
export async function loadExerciseSnapshots(
  exerciseIds: readonly string[],
): Promise<Map<string, ExerciseSnapshot>> {
  const unique = [...new Set(exerciseIds)];
  const exercises = await db.exercises.bulkGet(unique);

  return new Map(unique.map((id, index) => [id, snapshotOf(exercises[index])]));
}
