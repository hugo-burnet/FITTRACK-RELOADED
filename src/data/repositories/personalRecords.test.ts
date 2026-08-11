import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/data/db';
import type {
  Exercise,
  PersonalRecord,
  PersonalRecordType,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '@/data/types';
import { newEntity } from '@/data/repositories/base';
import { resetDb } from '@/test/resetDb';
import { persistRecordsForCompletedSet, reconcileRecordsForExercises } from './recordReconciliation';
import {
  PERSONAL_RECORDS_PROJECTION_VERSION,
  ensureRecordProjection,
  isRecordProjectionCurrent,
  listCurrentRecordsForExercise,
  listRecordsForWorkout,
  listRecordTimeline,
  rebuildAllRecords,
  rebuildRecordsForExercises,
} from './personalRecords';

const at = (day: number, minute = 0): number =>
  Date.UTC(2026, 0, day, 12, minute);

const exercise = (id: string, name: string): Exercise => ({
  ...newEntity<Exercise>({
    name,
    primaryMuscle: 'chest',
    secondaryMuscles: [],
    equipment: 'barbell',
    measurementType: 'weight_reps',
    isCustom: 1,
    isUnilateral: 0,
  }),
  id,
});

const workout = (id: string, status: Workout['status'], startedAt: number): Workout => ({
  ...newEntity<Workout>({
    routineId: '',
    name: id,
    status,
    startedAt,
    endedAt: status === 'active' ? 0 : startedAt + 3_600_000,
    durationSeconds: status === 'active' ? 0 : 3600,
  }),
  id,
});

const row = (
  id: string,
  workoutId: string,
  exerciseId: string,
  exerciseName?: string,
): WorkoutExercise => ({
  ...newEntity<WorkoutExercise>({
    workoutId,
    exerciseId,
    order: 0,
    supersetGroup: 0,
    restSeconds: 120,
    ...(exerciseName === undefined
      ? {}
      : {
          exerciseName,
          exerciseMeasurementType: 'weight_reps' as const,
          exercisePrimaryMuscle: 'chest' as const,
          exerciseEquipment: 'barbell' as const,
        }),
  }),
  id,
});

const set = (
  id: string,
  workoutRow: WorkoutExercise,
  order: number,
  performedAt: number,
  weight: number,
  reps: number,
): WorkoutSet => ({
  ...newEntity<WorkoutSet>({
    workoutExerciseId: workoutRow.id,
    exerciseId: workoutRow.exerciseId,
    workoutId: workoutRow.workoutId,
    order,
    setType: 'normal',
    side: 'both',
    weight,
    reps,
    isCompleted: 1,
    performedAt,
  }),
  id,
});

function businessKey(record: PersonalRecord): string {
  return [record.exerciseId, record.type, record.workoutId, record.workoutSetId ?? ''].join('|');
}

function idsByBusinessKey(records: readonly PersonalRecord[]): Map<string, string> {
  return new Map(records.map((record) => [businessKey(record), record.id]));
}

async function seedHistory(): Promise<void> {
  const bench = exercise('bench', 'Développé actuel');
  const other = exercise('row', 'Rowing');
  const firstWorkout = workout('workout-1', 'completed', at(1));
  const secondWorkout = workout('workout-2', 'active', at(2));
  const ignoredWorkout = workout('workout-discarded', 'discarded', at(3));
  const firstRow = row('row-1', firstWorkout.id, bench.id, 'Développé historique');
  const secondRow = row('row-2', secondWorkout.id, bench.id);
  const ignoredRow = row('row-discarded', ignoredWorkout.id, bench.id, 'Nom ignoré');
  const otherRow = row('other-row', firstWorkout.id, other.id, 'Rowing historique');

  await db.transaction(
    'rw',
    db.exercises,
    db.workouts,
    db.workoutExercises,
    db.workoutSets,
    async () => {
      await db.exercises.bulkAdd([bench, other]);
      await db.workouts.bulkAdd([firstWorkout, secondWorkout, ignoredWorkout]);
      await db.workoutExercises.bulkAdd([firstRow, secondRow, ignoredRow, otherRow]);
      await db.workoutSets.bulkAdd([
        set('set-1', firstRow, 0, at(1, 10), 50, 5),
        set('set-2', secondRow, 0, at(2, 10), 60, 5),
        set('set-3', secondRow, 1, at(2, 20), 55, 10),
        set('set-discarded', ignoredRow, 0, at(3, 10), 200, 10),
        set('other-set', otherRow, 0, at(1, 20), 40, 8),
      ]);
    },
  );
}

describe('personal record reconciliation', () => {
  beforeEach(resetDb);

  it('rebuilds exact history and preserves surviving IDs while soft-deleting obsolete events', async () => {
    await seedHistory();

    const first = await rebuildAllRecords();
    const original = await db.personalRecords.toArray();
    const originalIds = idsByBusinessKey(original);

    await db.workoutSets.update('set-2', { weight: 77.5 });
    const second = await rebuildAllRecords();
    const reconciled = await db.personalRecords.toArray();
    const liveKeys = reconciled.filter(({ deletedAt }) => deletedAt === 0).map(businessKey).sort();

    expect(first.created).toBe(14);
    expect(second.deleted).toBeGreaterThan(0);
    expect(liveKeys).toEqual([
      'bench|best_1rm|workout-1|set-1',
      'bench|best_1rm|workout-2|set-2',
      'bench|max_volume_session|workout-1|',
      'bench|max_volume_session|workout-2|',
      'bench|max_volume_set|workout-1|set-1',
      'bench|max_volume_set|workout-2|set-2',
      'bench|max_volume_set|workout-2|set-3',
      'bench|max_weight|workout-1|set-1',
      'bench|max_weight|workout-2|set-2',
      'row|best_1rm|workout-1|other-set',
      'row|max_volume_session|workout-1|',
      'row|max_volume_set|workout-1|other-set',
      'row|max_weight|workout-1|other-set',
    ]);
    expect(idsByBusinessKey(reconciled).get('bench|max_weight|workout-1|set-1')).toBe(
      originalIds.get('bench|max_weight|workout-1|set-1'),
    );
    expect(reconciled.some(({ deletedAt }) => deletedAt > 0)).toBe(true);
  });

  it('is idempotent and updates changed values without replacing stable rows', async () => {
    await seedHistory();
    await rebuildAllRecords();
    const original = await db.personalRecords.toArray();
    const originalIds = idsByBusinessKey(original);

    const unchanged = await rebuildAllRecords();
    expect(unchanged).toEqual({ created: 0, updated: 0, deleted: 0, unchanged: 14 });
    expect(idsByBusinessKey(await db.personalRecords.toArray())).toEqual(originalIds);

    await db.workoutSets.update('set-1', { weight: 52 });
    const changed = await rebuildAllRecords();
    const updated = await db.personalRecords
      .where('[exerciseId+type]')
      .equals(['bench', 'max_weight'])
      .filter((record) => record.workoutSetId === 'set-1')
      .first();

    expect(changed.updated).toBeGreaterThan(0);
    expect(updated?.id).toBe(originalIds.get('bench|max_weight|workout-1|set-1'));
    expect(updated?.value).toBe(52);
  });

  it('revives an obsolete matching event with its original UUID', async () => {
    await seedHistory();
    await rebuildAllRecords();
    const original = await db.personalRecords
      .where('[exerciseId+type]')
      .equals(['bench', 'best_1rm'])
      .filter((record) => record.workoutSetId === 'set-3')
      .first();

    await db.workoutSets.update('set-2', { weight: 77.5 });
    await rebuildAllRecords();
    expect((await db.personalRecords.get(original!.id))?.deletedAt).toBeGreaterThan(0);

    await db.workoutSets.update('set-2', { weight: 60 });
    const result = await rebuildAllRecords();
    const revived = await db.personalRecords.get(original!.id);

    expect(result.updated).toBeGreaterThan(0);
    expect(revived?.deletedAt).toBe(0);
    expect(revived?.id).toBe(original?.id);
  });

  it('scopes rebuilding by exercise and record type', async () => {
    await seedHistory();
    await rebuildAllRecords();
    const otherBefore = await db.personalRecords.where('exerciseId').equals('row').toArray();
    await db.workoutSets.update('set-2', { weight: 77.5 });
    await rebuildRecordsForExercises(['bench']);
    expect(await db.personalRecords.where('exerciseId').equals('row').toArray()).toEqual(otherBefore);
    const benchNonOneRepMaxBefore = await db.personalRecords
      .where('exerciseId')
      .equals('bench')
      .filter((record) => record.type !== 'best_1rm')
      .toArray();

    await db.workoutSets.update('set-2', { weight: 65 });
    await db.transaction(
      'rw',
      [
        db.exercises,
        db.workouts,
        db.workoutExercises,
        db.workoutSets,
        db.bodyMeasurements,
        db.personalRecords,
      ],
      async () => reconcileRecordsForExercises(['bench'], 'brzycki', new Set(['best_1rm'])),
    );

    expect(
      await db.personalRecords
        .where('exerciseId')
        .equals('bench')
        .filter((record) => record.type !== 'best_1rm')
        .toArray(),
    ).toEqual(benchNonOneRepMaxBefore);
    expect(
      (await db.personalRecords.where('[exerciseId+type]').equals(['bench', 'best_1rm']).toArray())
        .filter((record) => record.deletedAt === 0)
        .every((record) => record.formula === 'brzycki'),
    ).toBe(true);
  });

  it('enriches ordered reads with previous values, trigger sets, names, and statuses', async () => {
    await seedHistory();
    await rebuildAllRecords();

    const timeline = await listRecordTimeline({ exerciseId: 'bench' });
    const maxWeights = timeline.filter(({ record }) => record.type === 'max_weight');
    const firstWeight = maxWeights.find(({ record }) => record.workoutSetId === 'set-1');
    const latestWeight = maxWeights.find(({ record }) => record.workoutSetId === 'set-2');
    const activeSession = timeline.find(
      ({ record }) => record.workoutId === 'workout-2' && record.type === 'max_volume_session',
    );

    expect(timeline.map(({ record }) => record.achievedAt)).toEqual(
      [...timeline].map(({ record }) => record.achievedAt).sort((a, b) => b - a),
    );
    expect(firstWeight).toMatchObject({
      exerciseName: 'Développé historique',
      workoutStatus: 'completed',
      triggerWorkoutSetId: 'set-1',
    });
    expect(firstWeight).not.toHaveProperty('previousValue');
    expect(latestWeight).toMatchObject({
      exerciseName: 'Développé actuel',
      workoutStatus: 'active',
      previousValue: 50,
      triggerWorkoutSetId: 'set-2',
    });
    expect(activeSession?.triggerWorkoutSetId).toBe('set-3');
    expect(activeSession?.record.workoutSetId).toBeUndefined();
    expect(new Set(timeline.map(({ workoutStatus }) => workoutStatus))).toEqual(
      new Set(['active', 'completed']),
    );

    const current = await listCurrentRecordsForExercise('bench');
    expect(current).toHaveLength(4);
    expect(new Set(current.map(({ record }) => record.type))).toEqual(
      new Set<PersonalRecordType>([
        'max_weight',
        'max_volume_set',
        'best_1rm',
        'max_volume_session',
      ]),
    );

    const workoutRecords = await listRecordsForWorkout('workout-2');
    expect(new Set(workoutRecords.map(({ record }) => record.type))).toEqual(
      new Set<PersonalRecordType>([
        'max_weight',
        'max_volume_set',
        'best_1rm',
        'max_volume_session',
      ]),
    );
    expect(timeline.every(({ record }) => record.workoutId !== 'workout-discarded')).toBe(true);
  });

  it('uses the snapshot of the row that owns the triggering set', async () => {
    const bench = exercise('bench', 'Nom actuel');
    const completedWorkout = workout('workout', 'completed', at(1));
    const firstRow = row('first-row', completedWorkout.id, bench.id, 'Premier snapshot');
    const secondRow = { ...row('second-row', completedWorkout.id, bench.id, 'Second snapshot'), order: 1 };
    const firstSet = set('first-set', firstRow, 0, at(1, 10), 40, 5);
    const triggeringSet = set('triggering-set', secondRow, 0, at(1, 20), 60, 5);
    await db.transaction('rw', db.exercises, db.workouts, db.workoutExercises, db.workoutSets, async () => {
      await db.exercises.add(bench);
      await db.workouts.add(completedWorkout);
      await db.workoutExercises.bulkAdd([firstRow, secondRow]);
      await db.workoutSets.bulkAdd([firstSet, triggeringSet]);
    });
    await rebuildAllRecords();

    const entry = (await listRecordTimeline({ exerciseId: bench.id })).find(
      ({ record }) => record.workoutSetId === triggeringSet.id && record.type === 'max_weight',
    );

    expect(entry?.exerciseName).toBe('Second snapshot');
  });

  it('uses canonical set order for previous and current records at equal timestamps', async () => {
    const bench = exercise('bench', 'Développé');
    const completedWorkout = workout('workout', 'completed', at(1));
    const workoutRow = row('row', completedWorkout.id, bench.id, 'Développé');
    const lowerFirst = set('z-lower-first', workoutRow, 0, at(1, 10), 50, 5);
    const higherSecond = set('a-higher-second', workoutRow, 1, at(1, 10), 60, 5);
    await db.transaction('rw', db.exercises, db.workouts, db.workoutExercises, db.workoutSets, async () => {
      await db.exercises.add(bench);
      await db.workouts.add(completedWorkout);
      await db.workoutExercises.add(workoutRow);
      await db.workoutSets.bulkAdd([lowerFirst, higherSecond]);
    });
    await rebuildAllRecords();

    const maxWeights = (await listRecordTimeline({ exerciseId: bench.id, type: 'max_weight' }));
    const current = await listCurrentRecordsForExercise(bench.id);

    expect(maxWeights.map(({ record }) => record.workoutSetId)).toEqual([
      higherSecond.id,
      lowerFirst.id,
    ]);
    expect(maxWeights[0]?.previousValue).toBe(50);
    expect(current.find(({ record }) => record.type === 'max_weight')?.record.value).toBe(60);
  });

  it('compares an incremental set with the canonical latest equal-timestamp incumbent', async () => {
    const bench = exercise('bench', 'Développé');
    const activeWorkout = workout('workout', 'active', at(1));
    const workoutRow = row('row', activeWorkout.id, bench.id, 'Développé');
    const lowerFirst = set('z-lower-first', workoutRow, 0, at(1, 10), 50, 5);
    const higherSecond = set('a-higher-second', workoutRow, 1, at(1, 10), 60, 5);
    const lowerCandidate = {
      ...set('candidate', workoutRow, 2, at(1, 20), 55, 5),
      isCompleted: 0 as const,
      performedAt: 0,
    };
    await db.transaction('rw', db.exercises, db.workouts, db.workoutExercises, db.workoutSets, async () => {
      await db.exercises.add(bench);
      await db.workouts.add(activeWorkout);
      await db.workoutExercises.add(workoutRow);
      await db.workoutSets.bulkAdd([lowerFirst, higherSecond, lowerCandidate]);
    });
    await rebuildAllRecords();
    await db.workoutSets.update(lowerCandidate.id, { isCompleted: 1, performedAt: at(1, 20) });

    await db.transaction(
      'rw',
      [
        db.exercises,
        db.workouts,
        db.workoutExercises,
        db.workoutSets,
        db.bodyMeasurements,
        db.personalRecords,
      ],
      async () => persistRecordsForCompletedSet(lowerCandidate.id, 'epley'),
    );

    expect(
      await db.personalRecords
        .where('[exerciseId+type]')
        .equals([bench.id, 'max_weight'])
        .filter((record) => record.deletedAt === 0 && record.workoutSetId === lowerCandidate.id)
        .count(),
    ).toBe(0);
  });

  it('updates the workout-scoped session row incrementally without duplicating its business key', async () => {
    const bench = exercise('bench', 'Développé');
    const activeWorkout = workout('workout-active', 'active', at(1));
    const activeRow = row('active-row', activeWorkout.id, bench.id, 'Développé');
    const firstSet = set('set-1', activeRow, 0, at(1, 10), 50, 5);
    const secondSet = set('set-2', activeRow, 1, at(1, 20), 60, 5);
    await db.transaction('rw', db.exercises, db.workouts, db.workoutExercises, db.workoutSets, async () => {
      await db.exercises.add(bench);
      await db.workouts.add(activeWorkout);
      await db.workoutExercises.add(activeRow);
      await db.workoutSets.bulkAdd([firstSet, { ...secondSet, isCompleted: 0, performedAt: 0 }]);
    });

    await db.transaction(
      'rw',
      [
        db.exercises,
        db.workouts,
        db.workoutExercises,
        db.workoutSets,
        db.bodyMeasurements,
        db.personalRecords,
      ],
      async () => persistRecordsForCompletedSet(firstSet.id, 'epley'),
    );
    const firstSession = await db.personalRecords
      .where('[exerciseId+type]')
      .equals(['bench', 'max_volume_session'])
      .first();

    await db.workoutSets.update(secondSet.id, { isCompleted: 1, performedAt: secondSet.performedAt });
    await db.transaction(
      'rw',
      [
        db.exercises,
        db.workouts,
        db.workoutExercises,
        db.workoutSets,
        db.bodyMeasurements,
        db.personalRecords,
      ],
      async () => persistRecordsForCompletedSet(secondSet.id, 'epley'),
    );
    const sessions = await db.personalRecords
      .where('[exerciseId+type]')
      .equals(['bench', 'max_volume_session'])
      .toArray();

    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({ id: firstSession?.id, value: 550, workoutId: activeWorkout.id });
  });
});

describe('personal record projection version', () => {
  beforeEach(resetDb);

  it('rebuilds once and stays ready at the current version', async () => {
    await seedHistory();

    expect(await ensureRecordProjection()).toBe('rebuilt');
    expect(await ensureRecordProjection()).toBe('ready');
    expect(await isRecordProjectionCurrent()).toBe(true);
    expect((await db.settings.get('personalRecordsProjectionVersion'))?.value).toBe(
      PERSONAL_RECORDS_PROJECTION_VERSION,
    );
  });

  it('keeps a stale version when rebuilding fails so the next launch retries', async () => {
    await seedHistory();
    await db.settings.put({ key: 'personalRecordsProjectionVersion', value: 0, updatedAt: 1 });
    vi.spyOn(db.personalRecords, 'bulkPut').mockRejectedValueOnce(new Error('rebuild failed'));

    await expect(ensureRecordProjection()).rejects.toThrow('rebuild failed');
    expect((await db.settings.get('personalRecordsProjectionVersion'))?.value).toBe(0);
  });
});
