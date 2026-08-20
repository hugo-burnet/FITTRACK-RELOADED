import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/data/db';
import type {
  BodyMeasurement,
  Exercise,
  PersonalRecord,
  Syncable,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '@/data/types';
import { projectRecordTimeline, type RecordEventDraft } from '@/lib/records';
import { resetDb } from '@/test/resetDb';
import { newEntity } from './base';
import { inspectHistoryResnapshot, resnapshotHistory } from './historyRepair';
import { reconcileRecordsForExercises } from './recordReconciliation';
import { listRecordSourcesForExercises } from './recordSources';

const exercise = (over: Partial<Omit<Exercise, keyof Syncable>> = {}): Exercise =>
  newEntity<Exercise>({
    name: 'Développé couché',
    primaryMuscle: 'chest',
    secondaryMuscles: [],
    equipment: 'barbell',
    measurementType: 'weight_reps',
    isCustom: 0,
    isUnilateral: 0,
    ...over,
  });

const workout = (): Workout =>
  newEntity<Workout>({
    routineId: '',
    name: 'Séance',
    status: 'completed',
    startedAt: 1_000,
    endedAt: 2_000,
    durationSeconds: 1_000,
  });

const row = (
  workoutId: string,
  exerciseId: string,
  over: Partial<Omit<WorkoutExercise, keyof Syncable>> = {},
): WorkoutExercise =>
  newEntity<WorkoutExercise>({
    workoutId,
    exerciseId,
    order: 0,
    supersetGroup: 0,
    restSeconds: 120,
    ...over,
  });

function recordContent(record: PersonalRecord): RecordEventDraft {
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

async function expectExactRecordProjection(exerciseId: string): Promise<void> {
  const expected = projectRecordTimeline(
    await listRecordSourcesForExercises([exerciseId]),
    'epley',
  );
  const active = (await db.personalRecords.where('exerciseId').equals(exerciseId).toArray()).filter(
    (record) => record.deletedAt === 0,
  );
  const key = (
    record: Pick<PersonalRecord, 'exerciseId' | 'type' | 'workoutId' | 'workoutSetId'>,
  ) => [record.exerciseId, record.type, record.workoutId, record.workoutSetId ?? ''].join('|');
  const byKey = new Map(active.map((record) => [key(record), record]));

  expect(byKey.size).toBe(active.length);
  expect([...byKey.keys()].sort()).toEqual(expected.map(key).sort());
  expect(expected.map((draft) => recordContent(byKey.get(key(draft))!))).toStrictEqual(expected);
}

async function seedRecordBearingSnapshotMismatch(): Promise<{
  bench: Exercise;
  session: Workout;
  historicalRow: WorkoutExercise;
}> {
  const bench = exercise({ measurementType: 'weight_reps' });
  const session = workout();
  const historicalRow = row(session.id, bench.id, {
    exerciseName: bench.name,
    exerciseMeasurementType: 'time_only',
    exercisePrimaryMuscle: bench.primaryMuscle,
    exerciseEquipment: bench.equipment,
  });
  const performed = newEntity<WorkoutSet>({
    workoutExerciseId: historicalRow.id,
    exerciseId: bench.id,
    workoutId: session.id,
    order: 0,
    setType: 'normal',
    side: 'both',
    weight: 100,
    reps: 5,
    durationSeconds: 45,
    isCompleted: 1,
    performedAt: 1_500,
  });

  await db.transaction(
    'rw',
    db.exercises,
    db.workouts,
    db.workoutExercises,
    db.workoutSets,
    async () => {
      await db.exercises.add(bench);
      await db.workouts.add(session);
      await db.workoutExercises.add(historicalRow);
      await db.workoutSets.add(performed);
    },
  );
  await reconcileRecordsForExercises([bench.id], 'epley');
  return { bench, session, historicalRow };
}

async function seedBodyweightFactorMismatch(
  storedFactor: number | undefined,
  libraryFactor: number | undefined,
): Promise<{ bench: Exercise; historicalRow: WorkoutExercise }> {
  const bench = exercise({
    equipment: 'bodyweight',
    measurementType: 'reps_only',
    ...(libraryFactor === undefined ? {} : { bodyweightLoadFactor: libraryFactor }),
  });
  const session = workout();
  const historicalRow = row(session.id, bench.id, {
    exerciseName: bench.name,
    exerciseMeasurementType: bench.measurementType,
    exercisePrimaryMuscle: bench.primaryMuscle,
    exerciseEquipment: bench.equipment,
    ...(storedFactor === undefined ? {} : { exerciseBodyweightLoadFactor: storedFactor }),
  });
  const performed = newEntity<WorkoutSet>({
    workoutExerciseId: historicalRow.id,
    exerciseId: bench.id,
    workoutId: session.id,
    order: 0,
    setType: 'normal',
    side: 'both',
    reps: 10,
    isCompleted: 1,
    performedAt: 1_500,
  });
  const bodyWeight = newEntity<BodyMeasurement>({
    type: 'body_weight',
    value: 80,
    unit: 'kg',
    measuredAt: 500,
  });

  await db.transaction(
    'rw',
    db.exercises,
    db.workouts,
    db.workoutExercises,
    db.workoutSets,
    db.bodyMeasurements,
    async () => {
      await db.exercises.add(bench);
      await db.workouts.add(session);
      await db.workoutExercises.add(historicalRow);
      await db.workoutSets.add(performed);
      await db.bodyMeasurements.add(bodyWeight);
    },
  );
  await reconcileRecordsForExercises([bench.id], 'epley');
  return { bench, historicalRow };
}

describe('resnapshotHistory', () => {
  beforeEach(resetDb);

  it('compte les champs qui changeraient avant toute écriture', async () => {
    const bench = exercise({
      name: 'Nouveau nom',
      primaryMuscle: 'chest',
      secondaryMuscles: ['triceps'],
      equipment: 'dumbbell',
      measurementType: 'weight_reps',
    });
    const session = workout();
    await db.exercises.add(bench);
    await db.workouts.add(session);
    await db.workoutExercises.add(
      row(session.id, bench.id, {
        exerciseName: 'Ancien nom',
        exercisePrimaryMuscle: 'abs',
        exerciseSecondaryMuscles: [],
        exerciseEquipment: 'barbell',
        exerciseMeasurementType: 'time_only',
      }),
    );

    expect(await inspectHistoryResnapshot()).toEqual({
      changed: 1,
      names: 1,
      muscles: 1,
      equipment: 1,
      measurements: 1,
    });
    expect((await db.workoutExercises.toArray())[0]?.exerciseName).toBe('Ancien nom');
  });

  it('réécrit l’instantané avec la bibliothèque d’aujourd’hui', async () => {
    const bench = exercise({ primaryMuscle: 'chest' });
    const session = workout();
    await db.exercises.add(bench);
    await db.workouts.add(session);
    // L’instantané gelé se contredit EXPRÈS avec la bibliothèque : deux valeurs
    // concordantes ne pourraient pas dire laquelle a gagné.
    await db.workoutExercises.add(
      row(session.id, bench.id, {
        exerciseName: 'Ancien nom',
        exercisePrimaryMuscle: 'abs',
        exerciseMeasurementType: 'time_only',
      }),
    );

    const result = await resnapshotHistory();

    const [updated] = await db.workoutExercises.toArray();
    expect(updated!.exercisePrimaryMuscle).toBe('chest');
    expect(updated!.exerciseName).toBe('Développé couché');
    expect(updated!.exerciseMeasurementType).toBe('weight_reps');
    expect(result).toEqual({ repaired: 1, kept: 0 });
  });

  it('n’efface jamais un instantané quand l’exercice a disparu', async () => {
    // `snapshotOf(undefined)` rend `{}`. Écrit tel quel, il détruirait la seule
    // trace de ce que la ligne était — une réparation qui perd des données.
    const session = workout();
    await db.workouts.add(session);
    await db.workoutExercises.add(
      row(session.id, 'exercice-fantome', {
        exerciseName: 'Machine de la vieille salle',
        exercisePrimaryMuscle: 'quads',
      }),
    );

    const result = await resnapshotHistory();

    const [kept] = await db.workoutExercises.toArray();
    expect(kept!.exerciseName).toBe('Machine de la vieille salle');
    expect(kept!.exercisePrimaryMuscle).toBe('quads');
    expect(result).toEqual({ repaired: 0, kept: 1 });
  });

  it('lit aussi les exercices supprimés, parce que la suppression est douce', async () => {
    // `deleteExercise` est un soft delete : un exercice supprimé est encore
    // l’exercice qui a été pratiqué, et il porte encore ses métadonnées.
    const removed = exercise({ name: 'Exercice supprimé', primaryMuscle: 'calves' });
    const session = workout();
    await db.exercises.add({ ...removed, deletedAt: 5_000 });
    await db.workouts.add(session);
    await db.workoutExercises.add(row(session.id, removed.id, { exercisePrimaryMuscle: 'abs' }));

    await resnapshotHistory();

    const [updated] = await db.workoutExercises.toArray();
    expect(updated!.exercisePrimaryMuscle).toBe('calves');
  });

  it('marque la ligne comme modifiée, parce qu’elle l’est vraiment', async () => {
    // ADR-002 : la synchronisation future diffe sur `updatedAt`. Une ligne
    // réécrite qui garde son ancien horodatage ne partirait jamais.
    const bench = exercise();
    const session = workout();
    await db.exercises.add(bench);
    await db.workouts.add(session);
    const before = row(session.id, bench.id, { exercisePrimaryMuscle: 'abs' });
    await db.workoutExercises.add({ ...before, updatedAt: 1 });

    await resnapshotHistory();

    const [updated] = await db.workoutExercises.toArray();
    expect(updated!.updatedAt).toBeGreaterThan(1);
  });

  /**
   * Le cas que la comparaison a laissé passer quand les secondaires sont entrés
   * dans l’instantané : rien d’autre ne change, donc `differs` répondait « non »
   * et l’action rendait « conservé » sans rien réparer. Corriger les secondaires
   * d’un exercice est pourtant exactement ce pour quoi ce bouton existe.
   */
  it('répare des muscles secondaires même quand rien d’autre ne bouge', async () => {
    const bench = exercise({ secondaryMuscles: ['triceps', 'shoulders'] });
    const session = workout();
    await db.exercises.add(bench);
    await db.workouts.add(session);
    await db.workoutExercises.add(
      row(session.id, bench.id, {
        exerciseName: bench.name,
        exercisePrimaryMuscle: bench.primaryMuscle,
        exerciseMeasurementType: bench.measurementType,
        exerciseEquipment: bench.equipment,
        exerciseSecondaryMuscles: ['lats'],
      }),
    );

    const result = await resnapshotHistory();

    const [updated] = await db.workoutExercises.toArray();
    expect(updated!.exerciseSecondaryMuscles).toEqual(['triceps', 'shoulders']);
    expect(result).toEqual({ repaired: 1, kept: 0 });
  });

  // Une ligne antérieure au champ ne porte rien ; la bibliothèque non plus. Les
  // deux disent « aucun secondaire » et il n’y a rien à réparer.
  it('ne voit pas de différence entre une clé absente et une liste vide', async () => {
    const bench = exercise({ secondaryMuscles: [] });
    const session = workout();
    await db.exercises.add(bench);
    await db.workouts.add(session);
    await db.workoutExercises.add(
      row(session.id, bench.id, {
        exerciseName: bench.name,
        exercisePrimaryMuscle: bench.primaryMuscle,
        exerciseMeasurementType: bench.measurementType,
        exerciseEquipment: bench.equipment,
      }),
    );

    expect(await resnapshotHistory()).toEqual({ repaired: 0, kept: 1 });
  });

  it('ne touche pas une ligne déjà juste', async () => {
    const bench = exercise();
    const session = workout();
    await db.exercises.add(bench);
    await db.workouts.add(session);
    const already = row(session.id, bench.id, {
      exerciseName: bench.name,
      exercisePrimaryMuscle: bench.primaryMuscle,
      exerciseMeasurementType: bench.measurementType,
      exerciseEquipment: bench.equipment,
    });
    await db.workoutExercises.add({ ...already, updatedAt: 42 });

    const result = await resnapshotHistory();

    const [untouched] = await db.workoutExercises.toArray();
    expect(untouched!.updatedAt).toBe(42);
    expect(result).toEqual({ repaired: 0, kept: 1 });
  });

  it('reconciles records when a repaired snapshot changes the measurement type', async () => {
    const { bench } = await seedRecordBearingSnapshotMismatch();

    await resnapshotHistory();

    await expectExactRecordProjection(bench.id);
  });

  it.each([
    { label: 'adds', stored: undefined, library: 0.7 },
    { label: 'changes', stored: 0.5, library: 0.7 },
    { label: 'removes', stored: 0.7, library: undefined },
  ])('$label a bodyweight factor and reconciles session tonnage', async ({ stored, library }) => {
    const { bench, historicalRow } = await seedBodyweightFactorMismatch(stored, library);

    await resnapshotHistory();

    expect((await db.workoutExercises.get(historicalRow.id))?.exerciseBodyweightLoadFactor).toBe(
      library,
    );
    await expectExactRecordProjection(bench.id);
  });

  it('rolls back repaired snapshots and records when reconciliation fails', async () => {
    const { bench, historicalRow } = await seedRecordBearingSnapshotMismatch();
    const beforeRow = await db.workoutExercises.get(historicalRow.id);
    const beforeRecords = (await db.personalRecords.toArray()).sort((left, right) =>
      left.id.localeCompare(right.id),
    );
    const failure = vi
      .spyOn(db.personalRecords, 'bulkPut')
      .mockRejectedValueOnce(new Error('injected repair reconciliation failure'));

    try {
      await expect(resnapshotHistory()).rejects.toThrow('injected repair reconciliation failure');
    } finally {
      failure.mockRestore();
    }

    expect(await db.workoutExercises.get(historicalRow.id)).toStrictEqual(beforeRow);
    expect(
      (await db.personalRecords.toArray()).sort((left, right) => left.id.localeCompare(right.id)),
    ).toStrictEqual(beforeRecords);
    await expectExactRecordProjection(bench.id);
  });
});
