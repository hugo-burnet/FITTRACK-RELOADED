import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/data/db';
import type {
  Exercise,
  ExternalExerciseBinding,
  RoutineFolder,
  Workout,
} from '@/data/types';
import {
  parseHevyCsv,
  type HevyImportData,
  type HevyParsedWorkout,
} from '@/lib/hevyCsv';
import {
  createExternalExerciseIdentityRegistry,
  externalExerciseIdentityKey,
  type ExternalExerciseDecision,
  type ExternalExerciseObservation,
  type ExternalExerciseResolution,
} from '@/lib/externalExerciseIdentity';
import { resetDb } from '@/test/resetDb';
import fixture from '@/test/fixtures/hevy-workout-data.csv?raw';
import { newEntity } from './base';
import {
  createCustomExercise,
  type NewExercise,
} from './exercises';
import {
  importHevyWorkouts,
  prepareHevyImport,
  type HevyExerciseResolution,
} from './hevyImport';
import {
  getLastPerformance,
  listRecordSets,
} from './workoutHistory';

type HevyExerciseResolutions = Record<
  string,
  HevyExerciseResolution
>;

const data: HevyImportData = {
  workouts: [
    {
      title: 'Séance A',
      startedAt: 1_000,
      endedAt: 11_000,
      durationSeconds: 10,
      notes: 'Note séance',
      importKey: 'hevy:a',
      exercises: [
        {
          sourceTitle: 'Développé couché (barre)',
          order: 0,
          sourceSupersetId: '7',
          supersetGroup: 1,
          notes: 'Banc 4',
          sets: [
            {
              sourceLine: 2,
              order: 0,
              setType: 'warmup',
              weight: 40,
              reps: 10,
            },
            {
              sourceLine: 3,
              order: 1,
              setType: 'normal',
              weight: 80,
              reps: 8,
              rpe: 7.5,
            },
          ],
        },
        {
          sourceTitle: 'Planche',
          order: 1,
          supersetGroup: 1,
          sets: [
            {
              sourceLine: 4,
              order: 0,
              setType: 'normal',
              durationSeconds: 60,
            },
          ],
        },
      ],
    },
  ],
  sourceExercises: [
    {
      sourceTitle: 'Développé couché (barre)',
      measurementType: 'weight_reps',
      equipment: 'barbell',
    },
    {
      sourceTitle: 'Planche',
      measurementType: 'time_only',
      equipment: 'other',
    },
  ],
  workoutCount: 1,
  exerciseCount: 2,
  setCount: 3,
};

const benchOnlyData: HevyImportData = {
  ...data,
  workouts: data.workouts.map((workout) => ({
    ...workout,
    exercises: workout.exercises.slice(0, 1),
  })),
  sourceExercises: data.sourceExercises.slice(0, 1),
  exerciseCount: 1,
  setCount: 2,
};

const partiallyDuplicatedData: HevyImportData = {
  ...data,
  workouts: [
    {
      ...data.workouts[0]!,
      exercises: data.workouts[0]!.exercises.slice(0, 1),
    },
    {
      ...data.workouts[0]!,
      title: 'Séance B',
      startedAt: 21_000,
      endedAt: 31_000,
      importKey: 'hevy:b',
      exercises: data.workouts[0]!.exercises.slice(1),
    },
  ],
  workoutCount: 2,
};

function customExercise(
  name: string,
  measurementType: Exercise['measurementType'] = 'weight_reps',
): NewExercise {
  return {
    name,
    primaryMuscle: 'other',
    secondaryMuscles: [],
    equipment: 'other',
    measurementType,
    isUnilateral: 0,
  };
}

function resolutions(benchId: string): HevyExerciseResolutions {
  return {
    [externalExerciseIdentityKey('Développé couché (barre)')]: {
      kind: 'existing',
      exerciseId: benchId,
    },
    [externalExerciseIdentityKey('Planche')]: {
      kind: 'custom',
      exercise: customExercise('Planche', 'time_only'),
    },
  };
}

async function authoritativeResolution(
  importData: HevyImportData,
  decisions: HevyExerciseResolutions,
  confirmedAt = Date.now(),
): Promise<ExternalExerciseResolution> {
  const registry = createExternalExerciseIdentityRegistry(
    await db.exercises.toArray(),
    (await db.externalExerciseBindings.toArray()).filter(
      (binding) => binding.deletedAt === 0,
    ),
    new Map(),
  );
  const observations: ExternalExerciseObservation[] =
    importData.sourceExercises.map((sourceExercise) => ({
      source: 'hevy_csv',
      sourceTitle: sourceExercise.sourceTitle,
      measurementType: sourceExercise.measurementType,
      equipmentHint: sourceExercise.equipment,
      sessionCount: 1,
      setCount: 1,
      examples: [],
    }));
  const entries = registry.review(observations);
  const authoritativeDecisions = entries.flatMap(
    (entry): ExternalExerciseDecision[] => {
      const decision = decisions[entry.identityKey];
      return decision === undefined
        ? []
        : [{ identityKey: entry.identityKey, ...decision }];
    },
  );
  return registry.resolve(
    entries,
    authoritativeDecisions,
    confirmedAt,
  );
}

async function importWithDecisions(
  importData: HevyImportData,
  decisions: HevyExerciseResolutions,
  importedAt = Date.now(),
) {
  return importHevyWorkouts(
    importData,
    await authoritativeResolution(
      importData,
      decisions,
      importedAt,
    ),
    importedAt,
  );
}

async function counts() {
  return {
    exercises: await db.exercises.count(),
    bindings: await db.externalExerciseBindings.count(),
    workouts: await db.workouts.count(),
    workoutExercises: await db.workoutExercises.count(),
    workoutSets: await db.workoutSets.count(),
    routineFolders: await db.routineFolders.count(),
    routines: await db.routines.count(),
    routineExercises: await db.routineExercises.count(),
    routineSets: await db.routineSets.count(),
  };
}

const pallofSourceTitle = 'Développé Debout Poulie Centrée';
const additionalSourceTitles = Array.from(
  { length: 24 },
  (_, index) => `Exercice test ${index + 1}`,
);

function twentyFiveIdentityData(): HevyImportData {
  const firstWorkoutExercises: HevyParsedWorkout['exercises'] = [
    {
      sourceTitle: pallofSourceTitle,
      order: 0,
      supersetGroup: 0,
      sets: [
        {
          sourceLine: 2,
          order: 0,
          setType: 'normal',
          weight: 10,
          reps: 15,
        },
        {
          sourceLine: 3,
          order: 1,
          setType: 'normal',
          weight: 15,
          reps: 12,
        },
      ],
    },
    ...additionalSourceTitles.map((sourceTitle, index) => ({
      sourceTitle,
      order: index + 1,
      supersetGroup: 0,
      sets: [
        {
          sourceLine: index + 4,
          order: 0,
          setType: 'normal' as const,
          weight: 20,
          reps: 10,
        },
      ],
    })),
  ];
  const workouts: HevyParsedWorkout[] = [
    {
      title: 'LOWER A',
      startedAt: 1_000,
      endedAt: 11_000,
      durationSeconds: 10,
      importKey: 'hevy:lower-a:1',
      exercises: firstWorkoutExercises,
    },
    {
      title: 'LOWER A',
      startedAt: 21_000,
      endedAt: 31_000,
      durationSeconds: 10,
      importKey: 'hevy:lower-a:2',
      exercises: [
        {
          sourceTitle: pallofSourceTitle,
          order: 0,
          supersetGroup: 0,
          sets: [
            {
              sourceLine: 30,
              order: 0,
              setType: 'normal',
              weight: 10,
              reps: 15,
            },
            {
              sourceLine: 31,
              order: 1,
              setType: 'normal',
              weight: 15,
              reps: 12,
            },
          ],
        },
      ],
    },
  ];
  return {
    workouts,
    sourceExercises: [
      {
        sourceTitle: pallofSourceTitle,
        measurementType: 'weight_reps',
        equipment: 'cable',
      },
      ...additionalSourceTitles.map((sourceTitle) => ({
        sourceTitle,
        measurementType: 'weight_reps' as const,
        equipment: 'other' as const,
      })),
    ],
    workoutCount: workouts.length,
    exerciseCount: 25,
    setCount: 28,
  };
}

function twentyFiveIdentityResolutions(
  pallofId: string,
): HevyExerciseResolutions {
  return Object.fromEntries([
    [
      externalExerciseIdentityKey(pallofSourceTitle),
      { kind: 'existing' as const, exerciseId: pallofId },
    ],
    ...additionalSourceTitles.map((sourceTitle) => [
      externalExerciseIdentityKey(sourceTitle),
      {
        kind: 'custom' as const,
        exercise: customExercise(sourceTitle),
      },
    ]),
  ]);
}

describe('Hevy import repository', () => {
  beforeEach(resetDb);

  it('imports the complete anonymized fixture', async () => {
    const parsed = parseHevyCsv(fixture);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const fixtureResolutions = Object.fromEntries(
      parsed.data.sourceExercises.map((source) => [
        externalExerciseIdentityKey(source.sourceTitle),
        {
          kind: 'custom' as const,
          exercise: customExercise(
            source.sourceTitle,
            source.measurementType,
          ),
        },
      ]),
    );

    const result = await importHevyWorkouts(
      parsed.data,
      await authoritativeResolution(parsed.data, fixtureResolutions),
    );

    expect(result).toMatchObject({
      importedWorkouts: parsed.data.workoutCount,
      skippedWorkouts: 0,
      createdExercises: parsed.data.exerciseCount,
      importedExercises: 7,
      importedSets: parsed.data.setCount,
    });
    expect(await db.workouts.count()).toBe(parsed.data.workoutCount);
    expect(await db.workoutExercises.count()).toBe(7);
    expect(await db.workoutSets.count()).toBe(parsed.data.setCount);
  });

  it('writes 25 exact confirmed bindings and keeps Pallof history out of shoulder press', async () => {
    const importedAt = new Date(2026, 6, 29, 12).getTime();
    const pallof = await createCustomExercise({
      ...customExercise('Pallof press'),
      primaryMuscle: 'abs',
      equipment: 'cable',
    });
    const shoulderPress = await createCustomExercise({
      ...customExercise('Développé épaules (poulie)'),
      primaryMuscle: 'shoulders',
      equipment: 'cable',
    });
    const importData = twentyFiveIdentityData();

    await importWithDecisions(
      importData,
      twentyFiveIdentityResolutions(pallof.id),
      importedAt,
    );

    expect(await db.externalExerciseBindings.count()).toBe(25);
    expect(
      await db.workoutExercises
        .where('exerciseId')
        .equals(pallof.id)
        .count(),
    ).toBe(2);
    expect(
      await db.workoutSets.where('exerciseId').equals(pallof.id).count(),
    ).toBe(4);
    expect(
      await db.workoutExercises
        .where('exerciseId')
        .equals(shoulderPress.id)
        .count(),
    ).toBe(0);
    expect(
      await db.externalExerciseBindings
        .where('[source+identityKey]')
        .equals([
          'hevy_csv',
          externalExerciseIdentityKey(pallofSourceTitle),
        ])
        .first(),
    ).toMatchObject({
      sourceTitle: pallofSourceTitle,
      exerciseId: pallof.id,
      measurementType: 'weight_reps',
      equipmentHint: 'cable',
      verification: 'user',
      confirmedAt: importedAt,
    });
  });

  it('keeps only one active binding for an exact source identity', async () => {
    const bench = await createCustomExercise(
      customExercise('Développé couché'),
    );
    const identityKey = externalExerciseIdentityKey(
      'Développé couché (barre)',
    );
    await db.externalExerciseBindings.bulkAdd([
      newEntity<ExternalExerciseBinding>({
        source: 'hevy_csv',
        identityKey,
        sourceTitle: 'Développé couché (barre)',
        exerciseId: bench.id,
        measurementType: 'weight_reps',
        equipmentHint: 'barbell',
        verification: 'user',
        confirmedAt: 1,
      }),
      newEntity<ExternalExerciseBinding>({
        source: 'hevy_csv',
        identityKey,
        sourceTitle: 'Développé couché (barre)',
        exerciseId: bench.id,
        measurementType: 'weight_reps',
        equipmentHint: 'barbell',
        verification: 'user',
        confirmedAt: 2,
      }),
    ]);

    await importWithDecisions(data, resolutions(bench.id), 3);

    const active = (
      await db.externalExerciseBindings
        .where('[source+identityKey]')
        .equals(['hevy_csv', identityKey])
        .toArray()
    ).filter((binding) => binding.deletedAt === 0);
    expect(active).toHaveLength(1);
    expect(active[0]).toMatchObject({
      exerciseId: bench.id,
      confirmedAt: 2,
    });
  });

  it('rolls back bindings, exercises, workouts, sets and routines after a late failure', async () => {
    const pallof = await createCustomExercise({
      ...customExercise('Pallof press'),
      primaryMuscle: 'abs',
      equipment: 'cable',
    });
    await createCustomExercise({
      ...customExercise('Développé épaules (poulie)'),
      primaryMuscle: 'shoulders',
      equipment: 'cable',
    });
    const before = await counts();
    const fail = vi
      .spyOn(db.routineSets, 'bulkAdd')
      .mockRejectedValueOnce(new Error('disk full'));

    try {
      await expect(
        importWithDecisions(
          twentyFiveIdentityData(),
          twentyFiveIdentityResolutions(pallof.id),
        ),
      ).rejects.toThrow('disk full');
    } finally {
      fail.mockRestore();
    }

    expect(await counts()).toEqual(before);
  });

  it('prepares confirmed bindings and distrusts legacy mappings', async () => {
    const bench = await createCustomExercise(
      customExercise('Développé couché'),
    );
    const pallof = await createCustomExercise({
      ...customExercise('Pallof press'),
      primaryMuscle: 'abs',
      equipment: 'cable',
    });
    const identityKey = externalExerciseIdentityKey(
      'Développé Debout Poulie Centrée',
    );
    await db.settings.put({
      key: 'hevyExerciseMappings',
      value: {
        [identityKey]: 'cable-shoulder-press',
      },
      updatedAt: 1,
    });
    await db.externalExerciseBindings.add(
      newEntity<ExternalExerciseBinding>({
        source: 'hevy_csv',
        identityKey,
        sourceTitle: 'Développé Debout Poulie Centrée',
        exerciseId: pallof.id,
        measurementType: 'weight_reps',
        equipmentHint: 'cable',
        verification: 'user',
        confirmedAt: 2,
      }),
    );
    await db.workouts.add(
      newEntity<Workout>({
        routineId: '',
        name: 'Déjà importée',
        status: 'completed',
        startedAt: 1,
        endedAt: 2,
        durationSeconds: 1,
        importSource: 'hevy_csv',
        importKey: data.workouts[0]!.importKey,
      }),
    );
    await db.routineFolders.add(
      newEntity<RoutineFolder>({
        name: 'Import Hevy — 27/07/2026',
        order: 0,
      }),
    );

    const result = await prepareHevyImport(data);

    expect(result.exercises.map((exercise) => exercise.id)).toContain(
      bench.id,
    );
    expect(result.existingImportKeys).toEqual([
      data.workouts[0]!.importKey,
    ]);
    expect(result.confirmedBindings).toEqual([
      expect.objectContaining({
        identityKey,
        exerciseId: pallof.id,
        verification: 'user',
      }),
    ]);
    expect(result).not.toHaveProperty('savedMappings');
    expect(result.aliveRoutineFolderNames).toEqual([
      'Import Hevy — 27/07/2026',
    ]);
  });

  it('prepares soft-deleted binding targets so review can explain the conflict', async () => {
    const retired = await createCustomExercise(
      customExercise('Ancien développé'),
    );
    const deletedAt = 4_200;
    await db.exercises.update(retired.id, { deletedAt });
    const identityKey = externalExerciseIdentityKey('Ancien développé');
    await db.externalExerciseBindings.add(
      newEntity<ExternalExerciseBinding>({
        source: 'hevy_csv',
        identityKey,
        sourceTitle: 'Ancien développé',
        exerciseId: retired.id,
        measurementType: 'weight_reps',
        equipmentHint: 'other',
        verification: 'user',
        confirmedAt: 1,
      }),
    );

    const result = await prepareHevyImport(data);

    expect(result.exercises).toContainEqual(
      expect.objectContaining({
        id: retired.id,
        deletedAt,
      }),
    );
    expect(result.confirmedBindings).toContainEqual(
      expect.objectContaining({
        identityKey,
        exerciseId: retired.id,
      }),
    );
  });

  it('writes workouts, exercise blocks, sets and bindings coherently', async () => {
    const bench = await createCustomExercise(
      customExercise('Développé couché'),
    );

    const result = await importWithDecisions(
      data,
      resolutions(bench.id),
      new Date(2026, 6, 27, 12).getTime(),
    );

    expect(result).toEqual({
      importedWorkouts: 1,
      skippedWorkouts: 0,
      createdExercises: 1,
      importedExercises: 2,
      importedSets: 3,
      createdRoutines: 1,
      // La séance du jeu d'essai date de 1970 : sa routine dort depuis
      // longtemps, elle est donc rangée à l'archive (`isDormantRoutine`).
      archivedRoutineFolderName: 'Import Hevy — 27/07/2026 — Archivé',
    });

    const workout = (await db.workouts.toArray())[0]!;
    const rows = await db.workoutExercises
      .where('workoutId')
      .equals(workout.id)
      .sortBy('order');
    const sets = await db.workoutSets
      .where('workoutId')
      .equals(workout.id)
      .sortBy('performedAt');
    const plank = (await db.exercises.toArray()).find(
      (exercise) => exercise.name === 'Planche',
    );

    expect(workout).toMatchObject({
      name: 'Séance A',
      status: 'completed',
      startedAt: 1_000,
      endedAt: 11_000,
      durationSeconds: 10,
      notes: 'Note séance',
      importSource: 'hevy_csv',
      importKey: 'hevy:a',
      // Lu à la date de la séance, pas à celle de l'import : le CSV Hevy porte
      // une heure murale sans fuseau, et `hevyCsv` la lit dans celui de
      // l'appareil.
      startedTimezoneOffsetMinutes: -new Date(1_000).getTimezoneOffset(),
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      exerciseId: bench.id,
      order: 0,
      supersetGroup: 1,
      notes: 'Banc 4',
      restSeconds: 120,
      exerciseName: bench.name,
      exerciseMeasurementType: bench.measurementType,
      exercisePrimaryMuscle: bench.primaryMuscle,
      exerciseEquipment: bench.equipment,
    });
    expect(rows[1]).toMatchObject({
      exerciseId: plank?.id,
      order: 1,
      supersetGroup: 1,
      exerciseName: 'Planche',
    });
    expect(sets.map((set) => set.performedAt)).toEqual([
      3_500,
      6_000,
      8_500,
    ]);
    expect(sets[1]).toMatchObject({
      exerciseId: bench.id,
      workoutExerciseId: rows[0]!.id,
      workoutId: workout.id,
      order: 1,
      setType: 'normal',
      side: 'both',
      weight: 80,
      reps: 8,
      rpe: 7.5,
      isCompleted: 1,
    });
    expect(
      (await db.externalExerciseBindings.toArray())
        .map((binding) => ({
          identityKey: binding.identityKey,
          exerciseId: binding.exerciseId,
          verification: binding.verification,
        }))
        .sort((left, right) =>
          left.identityKey.localeCompare(right.identityKey),
        ),
    ).toEqual([
      {
        identityKey: 'developpe couche barre',
        exerciseId: bench.id,
        verification: 'user',
      },
      {
        identityKey: 'planche',
        exerciseId: plank?.id,
        verification: 'user',
      },
    ]);
  });

  it('skips an already imported workout without adding rows', async () => {
    const bench = await createCustomExercise(
      customExercise('Développé couché'),
    );
    await importWithDecisions(data, resolutions(bench.id));
    const before = await counts();

    const second = await importWithDecisions(data, resolutions(bench.id));

    expect(second).toMatchObject({
      importedWorkouts: 0,
      skippedWorkouts: 1,
      createdExercises: 0,
      importedExercises: 0,
      importedSets: 0,
      createdRoutines: 0,
    });
    expect(await counts()).toEqual(before);
  });

  it('rejects a missing resolution before any write', async () => {
    await expect(
      importHevyWorkouts(data, {
        exercisesByIdentityKey: new Map(),
        exercisesToCreate: [],
        bindingsToWrite: [],
      }),
    ).rejects.toThrow(
      'Missing Hevy exercise resolution',
    );
    expect(await counts()).toEqual({
      exercises: 0,
      bindings: 0,
      workouts: 0,
      workoutExercises: 0,
      workoutSets: 0,
      routineFolders: 0,
      routines: 0,
      routineExercises: 0,
      routineSets: 0,
    });
  });

  it('rejects an existing target that was soft-deleted', async () => {
    const bench = await createCustomExercise(
      customExercise('Développé couché'),
    );
    const resolution = await authoritativeResolution(
      data,
      resolutions(bench.id),
    );
    await db.exercises.update(bench.id, { deletedAt: Date.now() });

    await expect(
      importHevyWorkouts(data, resolution),
    ).rejects.toThrow('Hevy exercise target is unavailable');
    expect(await db.workouts.count()).toBe(0);
  });

  it('rejects an existing target with incompatible measures', async () => {
    const timedBench = await createCustomExercise(
      customExercise('Développé couché chronométré', 'time_only'),
    );
    const before = await counts();
    const sourceKey = externalExerciseIdentityKey(
      benchOnlyData.sourceExercises[0]!.sourceTitle,
    );

    await expect(
      importHevyWorkouts(benchOnlyData, {
        exercisesByIdentityKey: new Map([
          [sourceKey, timedBench],
        ]),
        exercisesToCreate: [],
        bindingsToWrite: [],
      }),
    ).rejects.toThrow('Hevy exercise measurement is incompatible');
    expect(await counts()).toEqual(before);
  });

  it('imports the remaining workout when part of the reviewed draft became a duplicate', async () => {
    const bench = await createCustomExercise(
      customExercise('Développé couché'),
    );
    const resolution = await authoritativeResolution(
      partiallyDuplicatedData,
      resolutions(bench.id),
      6_000,
    );
    await db.workouts.add(
      newEntity<Workout>({
        routineId: '',
        name: 'Import concurrent',
        status: 'completed',
        startedAt: 1_000,
        endedAt: 11_000,
        durationSeconds: 10,
        importSource: 'hevy_csv',
        importKey: 'hevy:a',
      }),
    );

    const result = await importHevyWorkouts(
      partiallyDuplicatedData,
      resolution,
      6_000,
    );

    expect(result).toMatchObject({
      importedWorkouts: 1,
      skippedWorkouts: 1,
      createdExercises: 1,
      importedExercises: 1,
      importedSets: 1,
    });
    expect(
      await db.externalExerciseBindings
        .where('[source+identityKey]')
        .equals(['hevy_csv', 'developpe couche barre'])
        .count(),
    ).toBe(0);
    expect(
      await db.externalExerciseBindings
        .where('[source+identityKey]')
        .equals(['hevy_csv', 'planche'])
        .count(),
    ).toBe(1);
  });

  it('rejects a suggested exercise without a registry-materialized user binding', async () => {
    const bench = await createCustomExercise(
      customExercise('Développé couché'),
    );
    const sourceKey = externalExerciseIdentityKey(
      benchOnlyData.sourceExercises[0]!.sourceTitle,
    );
    const before = await counts();

    await expect(
      importHevyWorkouts(benchOnlyData, {
        exercisesByIdentityKey: new Map([[sourceKey, bench]]),
        exercisesToCreate: [],
        bindingsToWrite: [],
      }),
    ).rejects.toThrow(
      'Missing authoritative Hevy exercise binding',
    );
    expect(await counts()).toEqual(before);
  });

  it('upserts the exact binding materialized by the registry in the import transaction', async () => {
    const bench = await createCustomExercise(
      customExercise('Développé couché'),
    );
    const importedAt = 9_000;
    const resolution = await authoritativeResolution(
      benchOnlyData,
      {
        [externalExerciseIdentityKey(
          benchOnlyData.sourceExercises[0]!.sourceTitle,
        )]: {
          kind: 'existing',
          exerciseId: bench.id,
        },
      },
      importedAt,
    );
    const returnedBinding = resolution.bindingsToWrite[0]!;

    await importHevyWorkouts(
      benchOnlyData,
      resolution,
      importedAt,
    );

    expect(
      await db.externalExerciseBindings.get(returnedBinding.id),
    ).toEqual(returnedBinding);
  });

  it('atomically replaces a changed binding with the one materialized by the registry', async () => {
    const previous = await createCustomExercise(
      customExercise('Ancien développé couché'),
    );
    const replacement = await createCustomExercise(
      customExercise('Nouveau développé couché'),
    );
    const identityKey = externalExerciseIdentityKey(
      benchOnlyData.sourceExercises[0]!.sourceTitle,
    );
    const previousBinding = newEntity<ExternalExerciseBinding>({
      source: 'hevy_csv',
      identityKey,
      sourceTitle: benchOnlyData.sourceExercises[0]!.sourceTitle,
      exerciseId: previous.id,
      measurementType: 'weight_reps',
      equipmentHint: 'barbell',
      verification: 'user',
      confirmedAt: 1_000,
    });
    await db.externalExerciseBindings.add(previousBinding);
    const importedAt = 10_000;
    const resolution = await authoritativeResolution(
      benchOnlyData,
      {
        [identityKey]: {
          kind: 'existing',
          exerciseId: replacement.id,
        },
      },
      importedAt,
    );
    const replacementBinding = resolution.bindingsToWrite[0]!;

    await importHevyWorkouts(
      benchOnlyData,
      resolution,
      importedAt,
    );

    expect(
      await db.externalExerciseBindings.get(replacementBinding.id),
    ).toEqual(replacementBinding);
    expect(
      await db.externalExerciseBindings.get(previousBinding.id),
    ).toMatchObject({
      deletedAt: importedAt,
      updatedAt: importedAt,
    });
    const active = (
      await db.externalExerciseBindings
        .where('[source+identityKey]')
        .equals(['hevy_csv', identityKey])
        .toArray()
    ).filter((binding) => binding.deletedAt === 0);
    expect(active).toEqual([replacementBinding]);
  });

  it('rejects a registry binding id already owned by another source identity', async () => {
    const bench = await createCustomExercise(
      customExercise('Développé couché'),
    );
    const collision = newEntity<ExternalExerciseBinding>({
      source: 'hevy_csv',
      identityKey: 'unrelated identity',
      sourceTitle: 'Unrelated identity',
      exerciseId: bench.id,
      measurementType: 'weight_reps',
      equipmentHint: 'barbell',
      verification: 'user',
      confirmedAt: 1,
    });
    await db.externalExerciseBindings.add(collision);
    const resolution = await authoritativeResolution(
      benchOnlyData,
      resolutions(bench.id),
      11_000,
    );
    const collidingResolution: ExternalExerciseResolution = {
      ...resolution,
      bindingsToWrite: resolution.bindingsToWrite.map((binding) => ({
        ...binding,
        id: collision.id,
      })),
    };
    const before = await counts();

    await expect(
      importHevyWorkouts(
        benchOnlyData,
        collidingResolution,
        11_000,
      ),
    ).rejects.toThrow('Hevy exercise binding id is unavailable');

    expect(await counts()).toEqual(before);
    expect(
      await db.externalExerciseBindings.get(collision.id),
    ).toEqual(collision);
  });

  it('rolls back custom exercises, workouts and bindings on failure', async () => {
    const bench = await createCustomExercise(
      customExercise('Développé couché'),
    );
    const before = await counts();
    const fail = vi
      .spyOn(db.workoutSets, 'bulkAdd')
      .mockRejectedValueOnce(new Error('disk full'));

    try {
      await expect(
        importWithDecisions(data, resolutions(bench.id)),
      ).rejects.toThrow('disk full');
    } finally {
      fail.mockRestore();
    }

    expect(await counts()).toEqual(before);
  });

  it('feeds derived history without persisting personal records', async () => {
    const bench = await createCustomExercise(
      customExercise('Développé couché'),
    );
    await importWithDecisions(data, resolutions(bench.id));

    expect(await getLastPerformance(bench.id)).toHaveLength(2);
    expect((await listRecordSets([bench.id])).get(bench.id)).toHaveLength(
      2,
    );
    expect(await db.personalRecords.count()).toBe(0);
  });

  it('creates one dated folder and representative routines atomically', async () => {
    // Séance de 1970 → routine dormante → dossier d'archive. Le partage entre
    // les deux dossiers a son propre test plus bas.
    const importedAt = new Date(2026, 6, 27, 12).getTime();
    const bench = await createCustomExercise(
      customExercise('Développé couché'),
    );

    const result = await importWithDecisions(
      data,
      resolutions(bench.id),
      importedAt,
    );

    expect(result).toMatchObject({
      importedWorkouts: 1,
      createdRoutines: 1,
      archivedRoutineFolderName: 'Import Hevy — 27/07/2026 — Archivé',
    });
    const folders = await db.routineFolders.toArray();
    const routines = await db.routines.toArray();
    const rows = await db.routineExercises.toArray();
    const sets = await db.routineSets.toArray();
    expect(folders).toHaveLength(1);
    expect(routines).toHaveLength(1);
    expect(routines[0]).toMatchObject({
      name: 'Séance A',
      folderId: folders[0]!.id,
    });
    // Les deux exercices du jeu d'essai partagent `superset_id: '7'` : la
    // routine reconstruite garde le superset, elle le perdait avant.
    expect(rows.map((row) => row.supersetGroup)).toEqual([1, 1]);
    expect(sets.find((set) => set.setType === 'warmup')).toMatchObject({
      setType: 'warmup',
      targetReps: 10,
      targetWeight: 40,
    });
    expect(sets.find((set) => set.targetReps === 8)).toMatchObject({
      targetReps: 8,
      targetWeight: 80,
    });
    expect(
      sets.find((set) => set.targetDurationSeconds === 60),
    ).not.toHaveProperty('targetWeight');
    expect(sets.every((set) => !('targetRpe' in set))).toBe(true);
  });

  /**
   * La reconstruction ramène **tout** ce que l'historique contient, y compris la
   * full body de l'hiver dernier. Deux dossiers plutôt qu'un : ce qui tourne
   * encore d'un côté, ce qui dort de l'autre, sinon la liste qu'on ouvre avant
   * une séance se remplit de routines qu'on ne fait plus.
   */
  it('range les routines dormantes dans un dossier d’archive séparé', async () => {
    const importedAt = new Date(2026, 6, 27, 12).getTime();
    const bench = await createCustomExercise(
      customExercise('Développé couché'),
    );
    const recent: HevyImportData = {
      ...data,
      workouts: [
        ...data.workouts,
        {
          ...data.workouts[0]!,
          title: 'Séance récente',
          startedAt: importedAt - 2 * 86_400_000,
          endedAt: importedAt - 2 * 86_400_000 + 3_600_000,
          importKey: 'hevy:recent',
        },
      ],
    };

    const result = await importWithDecisions(
      recent,
      resolutions(bench.id),
      importedAt,
    );

    expect(result).toMatchObject({
      createdRoutines: 2,
      routineFolderName: 'Import Hevy — 27/07/2026',
      archivedRoutineFolderName: 'Import Hevy — 27/07/2026 — Archivé',
    });
    const folders = await db.routineFolders.toArray();
    const routines = await db.routines.toArray();
    const folderOf = (name: string) =>
      folders.find((folder) => folder.id === routines.find((routine) => routine.name === name)?.folderId)?.name;
    expect(folders).toHaveLength(2);
    expect(folderOf('Séance récente')).toBe('Import Hevy — 27/07/2026');
    expect(folderOf('Séance A')).toBe('Import Hevy — 27/07/2026 — Archivé');
    // Les ordres restent distincts : deux dossiers au même rang se rangeraient
    // au hasard dans la liste des routines.
    expect(new Set(folders.map((folder) => folder.order)).size).toBe(2);
    expect(new Set(routines.map((routine) => routine.order)).size).toBe(2);
  });

  /**
   * Le lien qui manquait : l'import fabriquait une routine à partir de séances
   * qui, elles, restaient sans routine. L'accueil annonçait « jamais réalisée »
   * sur une routine née de cet historique-là, et l'export CSV ressortait sans
   * routine ce que l'import venait d'en déduire.
   */
  it('rattache les séances importées à la routine reconstruite à partir d’elles', async () => {
    const importedAt = new Date(2026, 6, 27, 12).getTime();
    const bench = await createCustomExercise(
      customExercise('Développé couché'),
    );

    await importWithDecisions(data, resolutions(bench.id), importedAt);

    const routine = (await db.routines.toArray())[0]!;
    const workouts = await db.workouts.toArray();
    expect(workouts).toHaveLength(1);
    expect(workouts[0]?.routineId).toBe(routine.id);
  });

  it('creates no second folder when every workout is a duplicate', async () => {
    const importedAt = new Date(2026, 6, 27, 12).getTime();
    const bench = await createCustomExercise(
      customExercise('Développé couché'),
    );
    await importWithDecisions(data, resolutions(bench.id), importedAt);

    const result = await importWithDecisions(
      data,
      resolutions(bench.id),
      importedAt,
    );

    expect(result.createdRoutines).toBe(0);
    expect(result).not.toHaveProperty('routineFolderName');
    expect(await db.routineFolders.count()).toBe(1);
    expect(await db.routines.count()).toBe(1);
  });

  it('rolls back routines and workouts together', async () => {
    const bench = await createCustomExercise(
      customExercise('Développé couché'),
    );
    const fail = vi
      .spyOn(db.routineSets, 'bulkAdd')
      .mockRejectedValueOnce(new Error('disk full'));

    try {
      await expect(
        importWithDecisions(
          data,
          resolutions(bench.id),
          new Date(2026, 6, 27, 12).getTime(),
        ),
      ).rejects.toThrow('disk full');
    } finally {
      fail.mockRestore();
    }

    expect(await db.workouts.count()).toBe(0);
    expect(await db.routineFolders.count()).toBe(0);
    expect(await db.routines.count()).toBe(0);
    expect(await db.routineExercises.count()).toBe(0);
    expect(await db.routineSets.count()).toBe(0);
  });
});
