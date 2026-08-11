import { db } from '@/data/db';
import type {
  Exercise,
  PersonalRecord,
  PersonalRecordType,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '@/data/types';
import { isWorkingSet } from '@/lib/records';

export interface RecordTimelineFilters {
  exerciseId?: string;
  type?: PersonalRecordType;
}

export interface RecordTimelineEntry {
  record: PersonalRecord;
  exerciseName: string;
  workoutStatus: 'active' | 'completed';
  previousValue?: number;
  triggerWorkoutSetId?: string;
}

const workoutExerciseKey = (workoutId: string, exerciseId: string): string =>
  `${workoutId}\u0000${exerciseId}`;

function compareRecordTimeline(
  left: PersonalRecord,
  right: PersonalRecord,
  triggerByRecordId: ReadonlyMap<string, string | undefined>,
  setById: ReadonlyMap<string, WorkoutSet>,
  rowById: ReadonlyMap<string, WorkoutExercise>,
): number {
  const leftSet = setById.get(triggerByRecordId.get(left.id) ?? '');
  const rightSet = setById.get(triggerByRecordId.get(right.id) ?? '');
  const leftRow = leftSet === undefined ? undefined : rowById.get(leftSet.workoutExerciseId);
  const rightRow = rightSet === undefined ? undefined : rowById.get(rightSet.workoutExerciseId);

  return (
    left.achievedAt - right.achievedAt ||
    (leftRow?.order ?? 0) - (rightRow?.order ?? 0) ||
    (leftSet?.order ?? 0) - (rightSet?.order ?? 0) ||
    (left.workoutSetId ?? left.workoutId).localeCompare(
      right.workoutSetId ?? right.workoutId,
    ) ||
    left.id.localeCompare(right.id)
  );
}

function exerciseNameFor(
  record: PersonalRecord,
  triggerWorkoutSetId: string | undefined,
  rowsByWorkoutExercise: ReadonlyMap<string, WorkoutExercise[]>,
  exercises: ReadonlyMap<string, Exercise>,
  setById: ReadonlyMap<string, WorkoutSet>,
  rowById: ReadonlyMap<string, WorkoutExercise>,
): string {
  const triggerSet = triggerWorkoutSetId === undefined ? undefined : setById.get(triggerWorkoutSetId);
  const triggerRow = triggerSet === undefined ? undefined : rowById.get(triggerSet.workoutExerciseId);
  const workoutRow =
    triggerRow?.deletedAt === 0 &&
    triggerRow.workoutId === record.workoutId &&
    triggerRow.exerciseId === record.exerciseId
      ? triggerRow
      : rowsByWorkoutExercise.get(workoutExerciseKey(record.workoutId, record.exerciseId))?.[0];
  return workoutRow?.exerciseName ?? exercises.get(record.exerciseId)?.name ?? '';
}

function lastContributingSetId(
  record: PersonalRecord,
  setsByWorkoutExercise: ReadonlyMap<string, WorkoutSet[]>,
  rowById: ReadonlyMap<string, WorkoutExercise>,
): string | undefined {
  if (record.workoutSetId !== undefined) return record.workoutSetId;

  return [...(setsByWorkoutExercise.get(workoutExerciseKey(record.workoutId, record.exerciseId)) ?? [])]
    .filter(
      (set) =>
        set.deletedAt === 0 &&
        set.isCompleted === 1 &&
        isWorkingSet(set) &&
        rowById.get(set.workoutExerciseId)?.deletedAt === 0 &&
        rowById.get(set.workoutExerciseId)?.workoutId === set.workoutId &&
        rowById.get(set.workoutExerciseId)?.exerciseId === set.exerciseId,
    )
    .sort((left, right) => {
      const leftRow = rowById.get(left.workoutExerciseId);
      const rightRow = rowById.get(right.workoutExerciseId);
      return (
        left.performedAt - right.performedAt ||
        (leftRow?.order ?? 0) - (rightRow?.order ?? 0) ||
        left.order - right.order ||
        left.id.localeCompare(right.id)
      );
    })
    .at(-1)?.id;
}

async function readRecords(
  filters: RecordTimelineFilters,
  exerciseIds?: readonly string[],
): Promise<PersonalRecord[]> {
  if (exerciseIds !== undefined) {
    if (exerciseIds.length === 0) return [];
    const records = await db.personalRecords.where('exerciseId').anyOf(exerciseIds).toArray();
    return filters.type === undefined
      ? records
      : records.filter((record) => record.type === filters.type);
  }
  if (filters.exerciseId !== undefined && filters.type !== undefined) {
    return db.personalRecords
      .where('[exerciseId+type]')
      .equals([filters.exerciseId, filters.type])
      .toArray();
  }
  if (filters.exerciseId !== undefined) {
    return db.personalRecords.where('exerciseId').equals(filters.exerciseId).toArray();
  }
  if (filters.type !== undefined) {
    return db.personalRecords.filter((record) => record.type === filters.type).toArray();
  }
  return db.personalRecords.toArray();
}

async function listRecordTimelineScoped(
  filters: RecordTimelineFilters = {},
  exerciseIds?: readonly string[],
): Promise<RecordTimelineEntry[]> {
  return db.transaction(
    'r',
    db.personalRecords,
    db.workouts,
    db.workoutExercises,
    db.exercises,
    db.workoutSets,
    async () => {
      const records = (await readRecords(filters, exerciseIds)).filter(
        (record) => record.deletedAt === 0,
      );
      if (records.length === 0) return [];

      const workoutIds = [...new Set(records.map((record) => record.workoutId))];
      const workouts = await db.workouts.bulkGet(workoutIds);
      const workoutById = new Map(
        workouts.flatMap((workout) => (workout === undefined ? [] : [[workout.id, workout] as const])),
      );
      const included = records.filter((record) => {
        const workout = workoutById.get(record.workoutId);
        return (
          workout !== undefined &&
          workout.deletedAt === 0 &&
          (workout.status === 'active' || workout.status === 'completed')
        );
      });
      if (included.length === 0) return [];

      const includedWorkoutIds = [...new Set(included.map((record) => record.workoutId))];
      const relevantExerciseIds = new Set(included.map((record) => record.exerciseId));
      const [allRows, allSets, exercises] = await Promise.all([
        db.workoutExercises.where('workoutId').anyOf(includedWorkoutIds).toArray(),
        db.workoutSets.where('workoutId').anyOf(includedWorkoutIds).toArray(),
        db.exercises.bulkGet([...relevantExerciseIds]),
      ]);
      const rows = allRows.filter((row) => relevantExerciseIds.has(row.exerciseId));
      const sets = allSets.filter((set) => relevantExerciseIds.has(set.exerciseId));
      const exerciseById = new Map(
        exercises.flatMap((exercise) => (exercise === undefined ? [] : [[exercise.id, exercise] as const])),
      );
      const rowById = new Map(rows.map((row) => [row.id, row]));
      const setById = new Map(sets.map((set) => [set.id, set]));
      const rowsByWorkoutExercise = new Map<string, WorkoutExercise[]>();
      for (const row of rows) {
        if (row.deletedAt !== 0) continue;
        const key = workoutExerciseKey(row.workoutId, row.exerciseId);
        const bucket = rowsByWorkoutExercise.get(key) ?? [];
        bucket.push(row);
        rowsByWorkoutExercise.set(key, bucket);
      }
      const setsByWorkoutExercise = new Map<string, WorkoutSet[]>();
      for (const set of sets) {
        const key = workoutExerciseKey(set.workoutId, set.exerciseId);
        const bucket = setsByWorkoutExercise.get(key) ?? [];
        bucket.push(set);
        setsByWorkoutExercise.set(key, bucket);
      }
      const triggerByRecordId = new Map(
        included.map((record) => [
          record.id,
          lastContributingSetId(record, setsByWorkoutExercise, rowById),
        ]),
      );
      const compareTimeline = (left: PersonalRecord, right: PersonalRecord): number =>
        compareRecordTimeline(left, right, triggerByRecordId, setById, rowById);
      const previousById = new Map<string, number>();
      const previousByCategory = new Map<string, number>();
      for (const record of [...included].sort(compareTimeline)) {
        const category = `${record.exerciseId}\u0000${record.type}`;
        const previous = previousByCategory.get(category);
        if (previous !== undefined) previousById.set(record.id, previous);
        previousByCategory.set(category, record.value);
      }

      return [...included].sort((left, right) => compareTimeline(right, left)).map((record) => {
        const workout = workoutById.get(record.workoutId) as Workout & {
          status: 'active' | 'completed';
        };
        const previousValue = previousById.get(record.id);
        const triggerWorkoutSetId = triggerByRecordId.get(record.id);
        return {
          record,
          exerciseName: exerciseNameFor(
            record,
            triggerWorkoutSetId,
            rowsByWorkoutExercise,
            exerciseById,
            setById,
            rowById,
          ),
          workoutStatus: workout.status,
          ...(previousValue === undefined ? {} : { previousValue }),
          ...(triggerWorkoutSetId === undefined ? {} : { triggerWorkoutSetId }),
        };
      });
    },
  );
}

export function listRecordTimeline(
  filters: RecordTimelineFilters = {},
): Promise<RecordTimelineEntry[]> {
  return listRecordTimelineScoped(filters);
}

export function listRecordTimelineForExercises(
  exerciseIds: readonly string[],
): Promise<RecordTimelineEntry[]> {
  return listRecordTimelineScoped({}, exerciseIds);
}
