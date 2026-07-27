import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/data/db';
import type { Exercise, Workout } from '@/data/types';
import {
  parseHevyCsv,
  type HevyImportData,
} from '@/lib/hevyCsv';
import { normalizeHevyExerciseTitle } from '@/lib/hevyExerciseMatch';
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
  type HevyExerciseResolutions,
} from './hevyImport';
import { setHevyExerciseMappings } from './settings';
import {
  getLastPerformance,
  listRecordSets,
} from './workoutHistory';

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
    [normalizeHevyExerciseTitle('Développé couché (barre)')]: {
      kind: 'existing',
      exerciseId: benchId,
    },
    [normalizeHevyExerciseTitle('Planche')]: {
      kind: 'custom',
      exercise: customExercise('Planche', 'time_only'),
    },
  };
}

async function counts() {
  return {
    exercises: await db.exercises.count(),
    workouts: await db.workouts.count(),
    workoutExercises: await db.workoutExercises.count(),
    workoutSets: await db.workoutSets.count(),
    settings: await db.settings.count(),
  };
}

describe('Hevy import repository', () => {
  beforeEach(resetDb);

  it('imports the complete anonymized fixture', async () => {
    const parsed = parseHevyCsv(fixture);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const fixtureResolutions = Object.fromEntries(
      parsed.data.sourceExercises.map((source) => [
        normalizeHevyExerciseTitle(source.sourceTitle),
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
      fixtureResolutions,
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

  it('prepares alive exercises, saved mappings and duplicate keys', async () => {
    const bench = await createCustomExercise(
      customExercise('Développé couché'),
    );
    await setHevyExerciseMappings({
      'Développé couché (barre)': bench.id,
    });
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

    const result = await prepareHevyImport(data);

    expect(result.exercises.map((exercise) => exercise.id)).toContain(
      bench.id,
    );
    expect(result.existingImportKeys).toEqual([
      data.workouts[0]!.importKey,
    ]);
    expect(result.savedMappings).toEqual({
      'developpe couche': bench.id,
    });
  });

  it('writes workouts, exercise blocks, sets and mappings coherently', async () => {
    const bench = await createCustomExercise(
      customExercise('Développé couché'),
    );

    const result = await importHevyWorkouts(data, resolutions(bench.id));

    expect(result).toEqual({
      importedWorkouts: 1,
      skippedWorkouts: 0,
      createdExercises: 1,
      importedExercises: 2,
      importedSets: 3,
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
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      exerciseId: bench.id,
      order: 0,
      supersetGroup: 1,
      notes: 'Banc 4',
      restSeconds: 120,
    });
    expect(rows[1]).toMatchObject({
      exerciseId: plank?.id,
      order: 1,
      supersetGroup: 1,
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
    expect(await db.settings.get('hevyExerciseMappings')).toMatchObject({
      value: {
        'developpe couche': bench.id,
        planche: plank?.id,
      },
    });
  });

  it('skips an already imported workout without adding rows', async () => {
    const bench = await createCustomExercise(
      customExercise('Développé couché'),
    );
    await importHevyWorkouts(data, resolutions(bench.id));
    const before = await counts();

    const second = await importHevyWorkouts(data, resolutions(bench.id));

    expect(second).toMatchObject({
      importedWorkouts: 0,
      skippedWorkouts: 1,
    });
    expect(await counts()).toEqual(before);
  });

  it('rejects a missing resolution before any write', async () => {
    await expect(importHevyWorkouts(data, {})).rejects.toThrow(
      'Missing Hevy exercise resolution',
    );
    expect(await counts()).toEqual({
      exercises: 0,
      workouts: 0,
      workoutExercises: 0,
      workoutSets: 0,
      settings: 0,
    });
  });

  it('rejects an existing target that was soft-deleted', async () => {
    const bench = await createCustomExercise(
      customExercise('Développé couché'),
    );
    await db.exercises.update(bench.id, { deletedAt: Date.now() });

    await expect(
      importHevyWorkouts(data, resolutions(bench.id)),
    ).rejects.toThrow('Hevy exercise target is unavailable');
    expect(await db.workouts.count()).toBe(0);
  });

  it('rejects an existing target with incompatible measures', async () => {
    const timedBench = await createCustomExercise(
      customExercise('Développé couché chronométré', 'time_only'),
    );
    const before = await counts();

    await expect(
      importHevyWorkouts(data, resolutions(timedBench.id)),
    ).rejects.toThrow('Hevy exercise measurement is incompatible');
    expect(await counts()).toEqual(before);
  });

  it('rolls back custom exercises, workouts and settings on failure', async () => {
    const bench = await createCustomExercise(
      customExercise('Développé couché'),
    );
    const before = await counts();
    const fail = vi
      .spyOn(db.workoutSets, 'bulkAdd')
      .mockRejectedValueOnce(new Error('disk full'));

    try {
      await expect(
        importHevyWorkouts(data, resolutions(bench.id)),
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
    await importHevyWorkouts(data, resolutions(bench.id));

    expect(await getLastPerformance(bench.id)).toHaveLength(2);
    expect((await listRecordSets([bench.id])).get(bench.id)).toHaveLength(
      2,
    );
    expect(await db.personalRecords.count()).toBe(0);
  });
});
