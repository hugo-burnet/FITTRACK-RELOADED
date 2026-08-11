import { db } from '@/data/db';
import type { PersonalRecord, PersonalRecordType } from '@/data/types';
import type { OneRepMaxFormula } from '@/lib/oneRepMax';
import { projectRecordTimeline, type RecordEventDraft } from '@/lib/records';
import { newEntity, touch } from './base';
import {
  getCompletedSetRecordSources,
  listRecordSourcesForExercises,
} from './recordSources';

export interface RecordRebuildResult {
  created: number;
  updated: number;
  deleted: number;
  unchanged: number;
}

const emptyResult = (): RecordRebuildResult => ({
  created: 0,
  updated: 0,
  deleted: 0,
  unchanged: 0,
});

function businessKey(
  record: Pick<PersonalRecord, 'exerciseId' | 'type' | 'workoutId' | 'workoutSetId'>,
): string {
  return `${record.exerciseId}\u0000${record.type}\u0000${record.workoutId}\u0000${record.workoutSetId ?? ''}`;
}

function relevantType(
  type: PersonalRecordType,
  types: ReadonlySet<PersonalRecordType> | undefined,
): boolean {
  return types === undefined || types.has(type);
}

function recordContent(record: PersonalRecord | RecordEventDraft): RecordEventDraft {
  return {
    exerciseId: record.exerciseId,
    type: record.type,
    value: record.value,
    achievedAt: record.achievedAt,
    workoutId: record.workoutId,
    ...(record.workoutSetId === undefined ? {} : { workoutSetId: record.workoutSetId }),
    ...(record.weight === undefined ? {} : { weight: record.weight }),
    ...(record.reps === undefined ? {} : { reps: record.reps }),
    ...(record.durationSeconds === undefined ? {} : { durationSeconds: record.durationSeconds }),
    ...(record.distanceMeters === undefined ? {} : { distanceMeters: record.distanceMeters }),
    ...(record.formula === undefined ? {} : { formula: record.formula }),
  };
}

function sameContent(record: PersonalRecord, draft: RecordEventDraft): boolean {
  return JSON.stringify(recordContent(record)) === JSON.stringify(recordContent(draft));
}

function replacementFor(record: PersonalRecord, draft: RecordEventDraft): PersonalRecord {
  return touch(
    {
      ...draft,
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deletedAt: 0,
    },
    {},
  );
}

function chooseSurvivor(records: readonly PersonalRecord[]): PersonalRecord {
  return [...records].sort(
    (left, right) =>
      Number(left.deletedAt !== 0) - Number(right.deletedAt !== 0) ||
      left.createdAt - right.createdAt ||
      left.id.localeCompare(right.id),
  )[0]!;
}

function isImprovement(
  type: PersonalRecordType,
  value: number,
  incumbent: PersonalRecord | undefined,
): boolean {
  if (incumbent === undefined) return true;
  return type === 'min_assistance' ? value < incumbent.value : value > incumbent.value;
}

async function reconcileDrafts(
  exerciseIds: ReadonlySet<string>,
  drafts: readonly RecordEventDraft[],
  types?: ReadonlySet<PersonalRecordType>,
): Promise<RecordRebuildResult> {
  const result = emptyResult();
  if (exerciseIds.size === 0 || types?.size === 0) return result;

  const persisted = (await db.personalRecords.toArray()).filter(
    (record) => exerciseIds.has(record.exerciseId) && relevantType(record.type, types),
  );
  const persistedByKey = new Map<string, PersonalRecord[]>();
  for (const record of persisted) {
    const key = businessKey(record);
    const group = persistedByKey.get(key);
    if (group === undefined) persistedByKey.set(key, [record]);
    else group.push(record);
  }

  const expected = drafts.filter((draft) => relevantType(draft.type, types));
  const expectedKeys = new Set(expected.map(businessKey));
  const writes: PersonalRecord[] = [];

  for (const draft of expected) {
    const key = businessKey(draft);
    const matching = persistedByKey.get(key) ?? [];
    const survivor = matching.length === 0 ? undefined : chooseSurvivor(matching);

    if (survivor === undefined) {
      writes.push(newEntity<PersonalRecord>(draft));
      result.created += 1;
    } else if (survivor.deletedAt !== 0 || !sameContent(survivor, draft)) {
      writes.push(replacementFor(survivor, draft));
      result.updated += 1;
    } else {
      result.unchanged += 1;
    }

    for (const duplicate of matching) {
      if (duplicate.id === survivor?.id || duplicate.deletedAt !== 0) continue;
      writes.push(touch(duplicate, { deletedAt: Date.now() }));
      result.deleted += 1;
    }
  }

  for (const record of persisted) {
    if (record.deletedAt !== 0 || expectedKeys.has(businessKey(record))) continue;
    writes.push(touch(record, { deletedAt: Date.now() }));
    result.deleted += 1;
  }

  if (writes.length > 0) await db.personalRecords.bulkPut(writes);
  return result;
}

export async function reconcileRecordsForExercises(
  exerciseIds: readonly string[],
  formula: OneRepMaxFormula,
  types?: ReadonlySet<PersonalRecordType>,
): Promise<RecordRebuildResult> {
  const targetExerciseIds = new Set(exerciseIds);
  if (targetExerciseIds.size === 0 || types?.size === 0) return emptyResult();

  const sources = await listRecordSourcesForExercises([...targetExerciseIds]);
  const drafts = projectRecordTimeline(sources, formula);
  return reconcileDrafts(targetExerciseIds, drafts, types);
}

export async function reconcileAllRecords(
  formula: OneRepMaxFormula,
  types?: ReadonlySet<PersonalRecordType>,
): Promise<RecordRebuildResult> {
  const [sets, records] = await Promise.all([
    db.workoutSets.toArray(),
    db.personalRecords.toArray(),
  ]);
  const exerciseIds = new Set([
    ...sets.map((set) => set.exerciseId),
    ...records.map((record) => record.exerciseId),
  ]);
  return reconcileRecordsForExercises([...exerciseIds], formula, types);
}

export async function persistRecordsForCompletedSet(
  workoutSetId: string,
  formula: OneRepMaxFormula,
): Promise<PersonalRecord[]> {
  const sources = await getCompletedSetRecordSources(workoutSetId);
  const sourceSet = sources.find((source) => source.workoutSetId === workoutSetId);
  if (sourceSet === undefined) return [];

  const drafts = projectRecordTimeline(sources, formula);
  const persisted = await db.personalRecords
    .where('exerciseId')
    .equals(sourceSet.exerciseId)
    .toArray();
  const writtenKeys = new Set(drafts.map(businessKey));
  const latestActiveAchievedAt = persisted.reduce<number | undefined>(
    (latest, record) =>
      record.deletedAt !== 0 || (latest !== undefined && latest >= record.achievedAt)
        ? latest
        : record.achievedAt,
    undefined,
  );

  // Incremental persistence is equivalent to the canonical timeline only for
  // a strict append. Equal timestamps still have row/set/id tie-breakers, and
  // a clock moving backwards can insert anywhere in history; both require the
  // targeted rebuild to remove events that are no longer improvements.
  if (
    latestActiveAchievedAt !== undefined &&
    sourceSet.achievedAt <= latestActiveAchievedAt
  ) {
    await reconcileRecordsForExercises([sourceSet.exerciseId], formula);
    return db.personalRecords
      .where('exerciseId')
      .equals(sourceSet.exerciseId)
      .filter((record) => record.deletedAt === 0 && writtenKeys.has(businessKey(record)))
      .toArray();
  }

  const writes: PersonalRecord[] = [];

  for (const draft of drafts) {
    const key = businessKey(draft);
    const matching = persisted.filter((record) => businessKey(record) === key);
    const survivor = matching.length === 0 ? undefined : chooseSurvivor(matching);
    const incumbent = persisted
      .filter(
        (record) =>
          record.deletedAt === 0 &&
          record.type === draft.type &&
          businessKey(record) !== key,
      )
      .reduce<PersonalRecord | undefined>(
        (best, record) => (isImprovement(record.type, record.value, best) ? record : best),
        undefined,
      );
    if (!isImprovement(draft.type, draft.value, incumbent)) continue;

    if (survivor === undefined) {
      const created = newEntity<PersonalRecord>(draft);
      writes.push(created);
      persisted.push(created);
    } else if (survivor.deletedAt !== 0 || !sameContent(survivor, draft)) {
      const updated = replacementFor(survivor, draft);
      writes.push(updated);
      persisted.splice(persisted.indexOf(survivor), 1, updated);
    }
  }

  if (writes.length > 0) await db.personalRecords.bulkPut(writes);
  return persisted.filter(
    (record) => record.deletedAt === 0 && writtenKeys.has(businessKey(record)),
  );
}
