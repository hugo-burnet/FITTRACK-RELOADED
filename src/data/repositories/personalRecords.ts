import { db } from '@/data/db';
import type { PersonalRecordType } from '@/data/types';
import { getOneRepMaxFormula } from './settings';
import {
  listRecordTimeline,
  listRecordTimelineForExercises,
  type RecordTimelineEntry,
} from './recordTimeline';
import {
  reconcileAllRecords,
  reconcileRecordsForExercises,
  type RecordRebuildResult,
} from './recordReconciliation';

export const PERSONAL_RECORDS_PROJECTION_VERSION = 1;
const PROJECTION_VERSION_KEY = 'personalRecordsProjectionVersion';

export type { RecordRebuildResult } from './recordReconciliation';
export {
  listRecordTimeline,
  type RecordTimelineEntry,
  type RecordTimelineFilters,
} from './recordTimeline';

export async function listCurrentRecordsForExercise(
  exerciseId: string,
): Promise<RecordTimelineEntry[]> {
  const timeline = await listRecordTimeline({ exerciseId });
  const seen = new Set<PersonalRecordType>();
  return timeline.filter(({ record }) => {
    if (seen.has(record.type)) return false;
    seen.add(record.type);
    return true;
  });
}

export async function listRecordsForWorkout(workoutId: string): Promise<RecordTimelineEntry[]> {
  const rows = await db.workoutExercises.where('workoutId').equals(workoutId).toArray();
  const exerciseIds = [
    ...new Set(rows.filter((row) => row.deletedAt === 0).map((row) => row.exerciseId)),
  ];
  const timeline = await listRecordTimelineForExercises(exerciseIds);
  return timeline.filter(({ record }) => record.workoutId === workoutId);
}

function writeProjectionVersion(): Promise<string> {
  return db.settings.put({
    key: PROJECTION_VERSION_KEY,
    value: PERSONAL_RECORDS_PROJECTION_VERSION,
    updatedAt: Date.now(),
  });
}

export function rebuildRecordsForExercises(
  exerciseIds: readonly string[],
): Promise<RecordRebuildResult> {
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
    async () => reconcileRecordsForExercises(exerciseIds, await getOneRepMaxFormula()),
  );
}

export function rebuildAllRecords(): Promise<RecordRebuildResult> {
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
      const result = await reconcileAllRecords(await getOneRepMaxFormula());
      await writeProjectionVersion();
      return result;
    },
  );
}

export async function isRecordProjectionCurrent(): Promise<boolean> {
  return (await db.settings.get(PROJECTION_VERSION_KEY))?.value === PERSONAL_RECORDS_PROJECTION_VERSION;
}

export function ensureRecordProjection(): Promise<'ready' | 'rebuilt'> {
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
      if (await isRecordProjectionCurrent()) return 'ready';
      await reconcileAllRecords(await getOneRepMaxFormula());
      await writeProjectionVersion();
      return 'rebuilt';
    },
  );
}
