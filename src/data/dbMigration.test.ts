import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import type { Exercise, Workout, WorkoutExercise } from './types';

/**
 * The version 2 upgrade, run against a real version 1 database.
 *
 * `resetDb` deletes and recreates, so every other test opens straight into the
 * current schema and the upgrade path is never executed. This file is the only
 * place it is — and it is the code that runs, once, on a phone holding months
 * of real sessions.
 *
 * `@/data/db` is imported lazily, inside the test, so the singleton is only
 * constructed after the version 1 database exists on disk.
 */

/** Version 1's schema, verbatim. Dexie drops any store a version omits. */
const V1_STORES = {
  exercises: 'id, name, primaryMuscle, equipment, isCustom, updatedAt, deletedAt',
  routineFolders: 'id, order, updatedAt, deletedAt',
  routines: 'id, folderId, order, updatedAt, deletedAt',
  routineExercises: 'id, routineId, [routineId+order], deletedAt',
  routineSets: 'id, routineExerciseId, [routineExerciseId+order], deletedAt',
  workouts: 'id, status, startedAt, routineId, updatedAt, deletedAt',
  workoutExercises: 'id, workoutId, [workoutId+order], exerciseId, deletedAt',
  workoutSets:
    'id, workoutExerciseId, [workoutExerciseId+order], workoutId, [exerciseId+performedAt], deletedAt',
  personalRecords: 'id, exerciseId, [exerciseId+type], achievedAt, deletedAt',
  bodyMeasurements: 'id, type, [type+measuredAt], deletedAt',
  progressPhotos: 'id, takenAt, deletedAt',
  photoBlobs: 'key',
  settings: 'key',
};

const stamps = { createdAt: 0, updatedAt: 0, deletedAt: 0 };

const JANUARY = Date.UTC(2026, 0, 15, 18, 0, 0);
const JULY = Date.UTC(2026, 6, 15, 18, 0, 0);

async function seedVersion1(): Promise<void> {
  const legacy = new Dexie('fittrack');
  legacy.version(1).stores(V1_STORES);
  await legacy.open();

  await legacy.table<Exercise>('exercises').bulkAdd([
    {
      ...stamps,
      id: 'bench',
      name: 'Développé couché',
      primaryMuscle: 'chest',
      secondaryMuscles: ['triceps'],
      equipment: 'barbell',
      measurementType: 'weight_reps',
      isCustom: 0,
      isUnilateral: 0,
    },
    {
      ...stamps,
      id: 'retired',
      name: 'Machine retirée',
      primaryMuscle: 'lats',
      secondaryMuscles: [],
      equipment: 'machine',
      measurementType: 'weight_reps',
      isCustom: 1,
      isUnilateral: 0,
      deletedAt: 1,
    },
  ]);

  await legacy.table<Workout>('workouts').bulkAdd([
    {
      ...stamps,
      id: 'winter',
      routineId: '',
      name: 'Séance de janvier',
      status: 'completed',
      startedAt: JANUARY,
      endedAt: JANUARY + 3_600_000,
      durationSeconds: 3600,
    },
    {
      ...stamps,
      id: 'summer',
      routineId: '',
      name: 'Séance de juillet',
      status: 'completed',
      startedAt: JULY,
      endedAt: JULY + 3_600_000,
      durationSeconds: 3600,
    },
  ]);

  await legacy.table<WorkoutExercise>('workoutExercises').bulkAdd([
    { ...stamps, id: 'row-bench', workoutId: 'winter', exerciseId: 'bench', order: 0, supersetGroup: 0, restSeconds: 120 },
    { ...stamps, id: 'row-retired', workoutId: 'winter', exerciseId: 'retired', order: 1, supersetGroup: 0, restSeconds: 90 },
    { ...stamps, id: 'row-orphan', workoutId: 'summer', exerciseId: 'disparu', order: 0, supersetGroup: 0, restSeconds: 90 },
  ]);

  legacy.close();
}

describe('migration vers la version 2', () => {
  afterEach(async () => {
    const { db } = await import('./db');
    await db.delete();
  });

  it('rattrape les instantanés et les fuseaux des données existantes', async () => {
    await seedVersion1();

    const { db } = await import('./db');
    await db.open();

    expect(db.verno).toBe(2);

    const bench = await db.workoutExercises.get('row-bench');
    expect(bench).toMatchObject({
      exerciseName: 'Développé couché',
      exerciseMeasurementType: 'weight_reps',
      exercisePrimaryMuscle: 'chest',
      exerciseEquipment: 'barbell',
      // Le rattrapage ne touche à rien d'autre.
      restSeconds: 120,
      order: 0,
    });

    // Un exercice supprimé n'est supprimé qu'en douceur : sa ligne est toujours
    // là, donc son nom l'est aussi.
    expect((await db.workoutExercises.get('row-retired'))?.exerciseName).toBe('Machine retirée');

    // Un exercice réellement absent n'invente rien : l'absence est le signal.
    const orphan = await db.workoutExercises.get('row-orphan');
    expect(orphan?.exerciseName).toBeUndefined();
    expect(orphan?.exerciseEquipment).toBeUndefined();

    // Chaque séance reçoit l'offset de SA date, pas celui du jour de la
    // migration : en zone à heure d'été les deux diffèrent, ailleurs ils
    // coïncident, et les deux cas sont justes.
    expect((await db.workouts.get('winter'))?.startedTimezoneOffsetMinutes).toBe(
      -new Date(JANUARY).getTimezoneOffset(),
    );
    expect((await db.workouts.get('summer'))?.startedTimezoneOffsetMinutes).toBe(
      -new Date(JULY).getTimezoneOffset(),
    );
  });
});
