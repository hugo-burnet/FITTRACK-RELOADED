import { describe, expect, it } from 'vitest';
import type { Exercise } from '@/data/types';
import type { HevyParsedWorkout } from '@/lib/hevyCsv';
import { normalizeHevyExerciseTitle } from '@/lib/hevyExerciseMatch';
import { selectHevyRoutineSources } from '@/lib/hevyRoutineSelection';
import {
  buildHevyRoutineEntities,
  nextHevyImportFolderName,
} from './hevyRoutineImport';

const importedAt = new Date(2026, 6, 27, 12).getTime();

function exercise(
  id: string,
  name: string,
  measurementType: Exercise['measurementType'],
): Exercise {
  return {
    id,
    createdAt: 1,
    updatedAt: 1,
    deletedAt: 0,
    name,
    primaryMuscle: 'other',
    secondaryMuscles: [],
    equipment: 'other',
    measurementType,
    isCustom: 1,
    isUnilateral: 0,
  };
}

const bench = exercise('bench', 'Développé couché', 'weight_reps');
const plank = exercise('plank', 'Planche', 'time_only');
const rower = exercise('rower', 'Rameur', 'distance_time');

const resolvedExercises = new Map([
  [normalizeHevyExerciseTitle('Développé couché'), bench],
  [normalizeHevyExerciseTitle('Planche'), plank],
  [normalizeHevyExerciseTitle('Rameur'), rower],
]);

const upperA: HevyParsedWorkout = {
  title: 'UPPER A',
  startedAt: 1_000,
  endedAt: 11_000,
  durationSeconds: 10,
  importKey: 'hevy:upper-a',
  exercises: [
    {
      sourceTitle: 'Développé couché',
      order: 0,
      supersetGroup: 1,
      sets: [
        {
          sourceLine: 2,
          order: 0,
          setType: 'normal',
          weight: 80,
          reps: 8,
          rpe: 8,
        },
      ],
    },
    {
      sourceTitle: 'Planche',
      order: 1,
      supersetGroup: 1,
      sets: [
        {
          sourceLine: 3,
          order: 0,
          setType: 'warmup',
          durationSeconds: 60,
        },
      ],
    },
  ],
};

const cardio: HevyParsedWorkout = {
  title: 'CARDIO',
  startedAt: 20_000,
  endedAt: 40_000,
  durationSeconds: 20,
  importKey: 'hevy:cardio',
  exercises: [
    {
      sourceTitle: 'Rameur',
      order: 0,
      supersetGroup: 0,
      sets: [
        {
          sourceLine: 4,
          order: 0,
          setType: 'normal',
          durationSeconds: 300,
          distanceMeters: 1_000,
        },
      ],
    },
  ],
};

describe('Hevy routine entities', () => {
  it('builds ordered routines without supersets, weights or RPE targets', () => {
    const entities = buildHevyRoutineEntities(
      selectHevyRoutineSources([upperA]),
      resolvedExercises,
      'Import Hevy — 27/07/2026',
      2,
      4,
    );

    expect(entities.folder).toMatchObject({
      name: 'Import Hevy — 27/07/2026',
      order: 2,
    });
    expect(entities.routines[0]).toMatchObject({
      name: 'UPPER A',
      folderId: entities.folder.id,
      order: 4,
      version: 1,
    });
    expect(
      entities.rows.map((row) => ({
        order: row.order,
        supersetGroup: row.supersetGroup,
        restSeconds: row.restSeconds,
      })),
    ).toEqual([
      { order: 0, supersetGroup: 0, restSeconds: 0 },
      { order: 1, supersetGroup: 0, restSeconds: 0 },
    ]);
    expect(entities.sets[0]).toMatchObject({
      order: 0,
      setType: 'normal',
      targetReps: 8,
    });
    expect(entities.sets[0]).not.toHaveProperty('targetWeight');
    expect(entities.sets[0]).not.toHaveProperty('targetRpe');
    expect(entities.sets[1]).toMatchObject({
      setType: 'warmup',
      targetDurationSeconds: 60,
    });
  });

  it('copies duration and distance targets', () => {
    const entities = buildHevyRoutineEntities(
      selectHevyRoutineSources([cardio]),
      resolvedExercises,
      'Import Hevy — 27/07/2026',
      0,
      0,
    );

    expect(entities.sets[0]).toMatchObject({
      targetDurationSeconds: 300,
      targetDistanceMeters: 1_000,
    });
  });

  it.each([
    [[], 'Import Hevy — 27/07/2026'],
    [['Import Hevy — 27/07/2026'], 'Import Hevy — 27/07/2026 (2)'],
    [
      ['Import Hevy — 27/07/2026', 'Import Hevy — 27/07/2026 (2)'],
      'Import Hevy — 27/07/2026 (3)',
    ],
  ])('chooses the first available folder name', (names, expected) => {
    expect(nextHevyImportFolderName(importedAt, names)).toBe(expected);
  });
});
