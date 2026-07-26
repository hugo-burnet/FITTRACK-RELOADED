import { db } from '@/data/db';
import type { RoutineSet } from '@/data/types';
import { alive, newEntity, softDelete, touch } from './base';

/** What a set sheet may change. `order` is excluded: it belongs to the list, not to a form. */
export type RoutineSetTargets = Partial<
  Pick<
    RoutineSet,
    | 'setType'
    | 'targetReps'
    | 'targetRepsMax'
    | 'targetWeight'
    | 'targetDurationSeconds'
    | 'targetDistanceMeters'
    | 'targetRpe'
  >
>;

const byOrder = <T extends { order: number }>(a: T, b: T): number => a.order - b.order;

// ---------------------------------------------------------------------------
// Planned sets (RF-11)
// ---------------------------------------------------------------------------

/**
 * Appends a set **copied from the last one**. Writing 3 × 8-12 @ 80 kg then
 * costs one entry and two taps instead of three entries — and that is the
 * overwhelmingly common shape of a routine.
 */
export async function addRoutineSet(routineExerciseId: string): Promise<RoutineSet> {
  const siblings = alive(
    await db.routineSets.where('routineExerciseId').equals(routineExerciseId).toArray(),
  ).sort(byOrder);

  const last = siblings.at(-1);
  const set = newEntity<RoutineSet>({
    routineExerciseId,
    order: siblings.length,
    setType: last?.setType ?? 'normal',
    targetReps: last?.targetReps,
    targetRepsMax: last?.targetRepsMax,
    targetWeight: last?.targetWeight,
    targetDurationSeconds: last?.targetDurationSeconds,
    targetDistanceMeters: last?.targetDistanceMeters,
    targetRpe: last?.targetRpe,
  });

  await db.routineSets.add(set);
  return set;
}

export async function updateRoutineSet(id: string, changes: RoutineSetTargets): Promise<void> {
  const set = await db.routineSets.get(id);
  if (set === undefined) return;
  await db.routineSets.put(touch(set, changes));
}

/** Moving a whole exercise from 80 to 85 kg is a routine's most frequent edit. */
export async function applyToAllSets(
  routineExerciseId: string,
  changes: RoutineSetTargets,
): Promise<void> {
  const sets = alive(
    await db.routineSets.where('routineExerciseId').equals(routineExerciseId).toArray(),
  );
  if (sets.length === 0) return;
  await db.routineSets.bulkPut(sets.map((set) => touch(set, changes)));
}

/** Renumbers what is left: "série 1, série 3" is a hole you can read on screen. */
export async function deleteRoutineSet(id: string): Promise<void> {
  await db.transaction('rw', db.routineSets, async () => {
    const set = await db.routineSets.get(id);
    if (set === undefined) return;
    await softDelete(db.routineSets, id);

    const rest = alive(
      await db.routineSets.where('routineExerciseId').equals(set.routineExerciseId).toArray(),
    ).sort(byOrder);

    const renumbered = rest
      .map((row, order) => ({ row, order }))
      .filter(({ row, order }) => row.order !== order)
      .map(({ row, order }) => touch(row, { order }));

    if (renumbered.length > 0) await db.routineSets.bulkPut(renumbered);
  });
}
