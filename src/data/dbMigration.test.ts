import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import type { Exercise, Routine, Workout, WorkoutExercise } from './types';

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

const V3_STORES = {
  ...V1_STORES,
  externalExerciseBindings: 'id, [source+identityKey], exerciseId, updatedAt, deletedAt',
};

const stamps = { createdAt: 0, updatedAt: 0, deletedAt: 0 };
type LegacyRoutine = Omit<Routine, 'versionState'>;

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
    {
      ...stamps,
      id: 'row-bench',
      workoutId: 'winter',
      exerciseId: 'bench',
      order: 0,
      supersetGroup: 0,
      restSeconds: 120,
    },
    {
      ...stamps,
      id: 'row-retired',
      workoutId: 'winter',
      exerciseId: 'retired',
      order: 1,
      supersetGroup: 0,
      restSeconds: 90,
    },
    {
      ...stamps,
      id: 'row-orphan',
      workoutId: 'summer',
      exerciseId: 'disparu',
      order: 0,
      supersetGroup: 0,
      restSeconds: 90,
    },
  ]);

  await legacy.table<LegacyRoutine>('routines').add({
    ...stamps,
    id: 'legacy-routine',
    name: 'Routine historique',
    folderId: '',
    order: 0,
    version: 1,
  });

  legacy.close();
}

/**
 * Opens a real version-6 database (pre-loadIndex) with three legacy week shapes
 * so version(7) can rewrite them in place.
 */
async function seedVersion6WithLegacyWeeks(): Promise<void> {
  const legacy = new Dexie('fittrack');
  legacy.version(1).stores(V1_STORES);
  legacy.version(2).upgrade(() => {
    /* match FitTrackDB: no store change */
  });
  legacy.version(3).stores(V3_STORES);
  legacy.version(4).upgrade(() => {
    /* match FitTrackDB: no store change */
  });
  legacy.version(5).stores({
    coachRecommendations:
      'id, exerciseId, status, [exerciseId+status], recommendedAt, deletedAt',
  });
  legacy.version(6).stores({
    programs: 'id, status, startsAt, updatedAt, deletedAt',
    programWeeks: 'id, programId, [programId+weekIndex], deletedAt',
    programScheduleRevisions: 'id, programId, [programId+effectiveFromWeekIndex], deletedAt',
    programScheduleEntries: 'id, revisionId, [revisionId+order], routineId, deletedAt',
  });
  await legacy.open();

  await legacy.table('programWeeks').bulkAdd([
    {
      ...stamps,
      id: 'legacy-week',
      programId: 'prog',
      weekIndex: 0,
      prescriptionKind: 'percent_1rm',
      prescriptionValue: 75,
      isDeload: 0,
    },
    {
      ...stamps,
      id: 'legacy-rpe-week',
      programId: 'prog',
      weekIndex: 1,
      prescriptionKind: 'target_rpe',
      prescriptionValue: 8,
      isDeload: 0,
    },
    {
      ...stamps,
      id: 'legacy-deload-week',
      programId: 'prog',
      weekIndex: 2,
      prescriptionKind: 'percent_1rm',
      prescriptionValue: 60,
      isDeload: 1,
    },
  ]);

  legacy.close();
}

describe('migration depuis la version 1', () => {
  afterEach(async () => {
    const { db } = await import('./db');
    await db.delete();
  });

  it('rattrape les instantanés et les fuseaux des données existantes', async () => {
    await seedVersion1();

    const { db } = await import('./db');
    await db.open();

    expect(db.verno).toBe(7);
    expect(db.tables.map((table) => table.name)).toEqual(
      expect.arrayContaining([
        'programs',
        'programWeeks',
        'programScheduleRevisions',
        'programScheduleEntries',
      ]),
    );
    expect(await db.routines.get('legacy-routine')).toMatchObject({
      versionState: 'published',
    });
    expect(db.tables.map((table) => table.name)).toContain('externalExerciseBindings');
    expect(await db.exercises.get('bench')).toBeDefined();
    expect(await db.workouts.get('winter')).toBeDefined();

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
    // La version 4 ne rattrape pas non plus une ligne sans instantané : elle
    // retombe sur la bibliothèque en bloc, ce qui reste le comportement voulu.
    expect(orphan?.exerciseSecondaryMuscles).toBeUndefined();

    // Version 4 — les secondaires arrivent sur les lignes déjà instantanées par
    // la version 2, dans la même ouverture de base.
    expect(bench?.exerciseSecondaryMuscles).toEqual(['triceps']);
    // « Machine retirée » n'a aucun secondaire : la clé reste absente plutôt
    // que d'être écrite à vide.
    expect(await db.workoutExercises.get('row-retired')).not.toHaveProperty(
      'exerciseSecondaryMuscles',
    );

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

describe('migration version 6 → 7 (intention de semaine)', () => {
  afterEach(async () => {
    const { db } = await import('./db');
    await db.delete();
  });

  it('rewrites prescriptionKind/value/isDeload into loadIndex + phase', async () => {
    await seedVersion6WithLegacyWeeks();

    const { db } = await import('./db');
    await db.open();

    expect(db.verno).toBe(7);

    const week = await db.programWeeks.get('legacy-week');
    expect(week).toMatchObject({ loadIndex: 75, phase: 'construction' });
    expect(week).not.toHaveProperty('prescriptionKind');
    expect(week).not.toHaveProperty('prescriptionValue');
    expect(week).not.toHaveProperty('isDeload');

    const rpeWeek = await db.programWeeks.get('legacy-rpe-week');
    expect(rpeWeek).toMatchObject({ loadIndex: 100, phase: 'construction' });
    expect(rpeWeek).not.toHaveProperty('prescriptionKind');

    const deloadWeek = await db.programWeeks.get('legacy-deload-week');
    expect(deloadWeek).toMatchObject({ loadIndex: 60, phase: 'deload' });
    expect(deloadWeek).not.toHaveProperty('isDeload');
  });
});
