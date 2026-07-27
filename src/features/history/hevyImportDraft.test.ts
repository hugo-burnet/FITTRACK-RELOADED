import { describe, expect, it } from 'vitest';
import type { Exercise } from '@/data/types';
import type {
  HevyImportData,
  HevySourceExercise,
} from '@/lib/hevyCsv';
import {
  createHevyImportDraft,
  customResolutionFor,
  resolutionsFromHevyDraft,
  setHevyImportResolution,
  unresolvedHevySources,
} from './hevyImportDraft';

const source: HevySourceExercise = {
  sourceTitle: 'Développé couché (barre)',
  measurementType: 'weight_reps',
  equipment: 'barbell',
};

const data: HevyImportData = {
  workouts: [
    {
      title: 'Séance A',
      startedAt: 1_000,
      endedAt: 5_000,
      durationSeconds: 4,
      importKey: 'hevy:a',
      exercises: [
        {
          sourceTitle: source.sourceTitle,
          order: 0,
          supersetGroup: 0,
          sets: [
            {
              sourceLine: 2,
              order: 0,
              setType: 'normal',
              weight: 80,
              reps: 8,
            },
          ],
        },
      ],
    },
  ],
  sourceExercises: [source],
  workoutCount: 1,
  exerciseCount: 1,
  setCount: 1,
};

const bench: Exercise = {
  id: 'bench',
  createdAt: 1,
  updatedAt: 1,
  deletedAt: 0,
  name: 'Développé couché à la barre',
  primaryMuscle: 'chest',
  secondaryMuscles: [],
  equipment: 'barbell',
  measurementType: 'weight_reps',
  isCustom: 0,
  isUnilateral: 0,
};

const incompatibleBench: Exercise = {
  ...bench,
  id: 'timed-bench',
  measurementType: 'time_only',
};

function dataFor(sourceExercise: HevySourceExercise): HevyImportData {
  const timed = sourceExercise.measurementType === 'time_only';
  return {
    ...data,
    workouts: [
      {
        ...data.workouts[0]!,
        exercises: [
          {
            ...data.workouts[0]!.exercises[0]!,
            sourceTitle: sourceExercise.sourceTitle,
            sets: [
              {
                sourceLine: 2,
                order: 0,
                setType: 'normal',
                ...(timed ? { durationSeconds: 60 } : { weight: 20, reps: 8 }),
              },
            ],
          },
        ],
      },
    ],
    sourceExercises: [sourceExercise],
  };
}

describe('Hevy import mapping draft', () => {
  it('reuses a saved mapping to an alive exercise', () => {
    const draft = createHevyImportDraft(data, {
      exercises: [bench],
      existingImportKeys: [],
      savedMappings: { 'developpe couche': bench.id },
    });

    expect(draft.rows[0]).toMatchObject({
      resolution: { kind: 'existing', exerciseId: bench.id },
      resolutionSource: 'saved',
    });
    expect(unresolvedHevySources(draft)).toEqual([]);
  });

  it('ignores a saved mapping whose target disappeared', () => {
    const draft = createHevyImportDraft(data, {
      exercises: [],
      existingImportKeys: [],
      savedMappings: { 'developpe couche': 'missing' },
    });

    expect(draft.rows[0]!.resolution).toBeUndefined();
    expect(unresolvedHevySources(draft)).toEqual([source]);
  });

  it('ignores saved mappings and suggestions with incompatible measures', () => {
    const draft = createHevyImportDraft(data, {
      exercises: [incompatibleBench],
      existingImportKeys: [],
      savedMappings: {
        'developpe couche': incompatibleBench.id,
      },
    });

    expect(draft.rows[0]!.resolution).toBeUndefined();
    expect(draft.rows[0]!.suggestion).toBeUndefined();
  });

  it('keeps a suggestion separate from explicit resolution', () => {
    const draft = createHevyImportDraft(data, {
      exercises: [bench],
      existingImportKeys: [],
      savedMappings: {},
    });

    expect(draft.rows[0]!.suggestion?.id).toBe(bench.id);
    expect(draft.rows[0]!.resolution).toBeUndefined();
  });

  it('preconfirms an alive compatible canonical alias', () => {
    const deadHangSource: HevySourceExercise = {
      sourceTitle: 'Dead Hang',
      measurementType: 'time_only',
      equipment: 'other',
    };
    const deadHang: Exercise = {
      ...bench,
      id: 'dead-hang',
      name: 'Suspension à la barre',
      slug: 'dead-hang',
      equipment: 'bodyweight',
      measurementType: 'time_only',
    };

    const draft = createHevyImportDraft(dataFor(deadHangSource), {
      exercises: [deadHang],
      existingImportKeys: [],
      savedMappings: {},
    });

    expect(draft.rows[0]).toMatchObject({
      resolution: { kind: 'existing', exerciseId: deadHang.id },
      resolutionSource: 'canonical',
    });
  });

  it('keeps an approximate match unresolved', () => {
    const unknown: HevySourceExercise = {
      sourceTitle: 'Rotation Externe Poulie',
      measurementType: 'weight_reps',
      equipment: 'cable',
    };
    const draft = createHevyImportDraft(dataFor(unknown), {
      exercises: [bench],
      existingImportKeys: [],
      savedMappings: {},
    });

    expect(draft.rows[0]!.suggestion).toBeDefined();
    expect(draft.rows[0]!.resolution).toBeUndefined();
  });

  it('keeps a saved mapping ahead of a canonical alias', () => {
    const dumbbellSource: HevySourceExercise = {
      sourceTitle: 'Développé Couché (Haltère)',
      measurementType: 'weight_reps',
      equipment: 'dumbbell',
    };
    const canonical: Exercise = {
      ...bench,
      id: 'dumbbell-bench',
      name: 'Développé couché (haltères)',
      slug: 'dumbbell-bench-press',
      equipment: 'dumbbell',
    };
    const saved: Exercise = {
      ...canonical,
      id: 'saved-bench',
      slug: undefined,
      isCustom: 1,
    };

    const draft = createHevyImportDraft(dataFor(dumbbellSource), {
      exercises: [canonical, saved],
      existingImportKeys: [],
      savedMappings: { 'developpe couche': saved.id },
    });

    expect(draft.rows[0]).toMatchObject({
      resolution: { kind: 'existing', exerciseId: saved.id },
      resolutionSource: 'saved',
    });
  });

  it('removes sources used only by duplicate workouts', () => {
    const draft = createHevyImportDraft(data, {
      exercises: [bench],
      existingImportKeys: ['hevy:a'],
      savedMappings: {},
    });

    expect(draft).toMatchObject({
      importableWorkouts: 0,
      skippedWorkouts: 1,
      routineNames: [],
      rows: [],
    });
    expect(draft).not.toHaveProperty('routineFolderName');
  });

  it('previews the dated folder and representative routine', () => {
    const importedAt = new Date(2026, 6, 27, 12).getTime();
    const draft = createHevyImportDraft(
      data,
      {
        exercises: [bench],
        existingImportKeys: [],
        savedMappings: {},
        aliveRoutineFolderNames: [],
      },
      importedAt,
    );

    expect(draft).toMatchObject({
      importedAt,
      routineFolderName: 'Import Hevy — 27/07/2026',
      routineNames: ['Séance A'],
    });
  });

  it('previews the first available folder suffix', () => {
    const draft = createHevyImportDraft(
      data,
      {
        exercises: [bench],
        existingImportKeys: [],
        savedMappings: {},
        aliveRoutineFolderNames: [
          'Import Hevy — 27/07/2026',
        ],
      },
      new Date(2026, 6, 27, 12).getTime(),
    );

    expect(draft.routineFolderName).toBe(
      'Import Hevy — 27/07/2026 (2)',
    );
  });

  it('sets one immutable user resolution and exports all choices', () => {
    const initial = createHevyImportDraft(data, {
      exercises: [bench],
      existingImportKeys: [],
      savedMappings: {},
    });

    const next = setHevyImportResolution(initial, source.sourceTitle, {
      kind: 'existing',
      exerciseId: bench.id,
    });

    expect(initial.rows[0]!.resolution).toBeUndefined();
    expect(next.rows[0]).toMatchObject({
      resolution: { kind: 'existing', exerciseId: bench.id },
      resolutionSource: 'user',
    });
    expect(resolutionsFromHevyDraft(next)).toEqual({
      'developpe couche|barbell': {
        kind: 'existing',
        exerciseId: bench.id,
      },
    });
  });

  it('refuses to export an unresolved draft', () => {
    const draft = createHevyImportDraft(data, {
      exercises: [bench],
      existingImportKeys: [],
      savedMappings: {},
    });

    expect(() => resolutionsFromHevyDraft(draft)).toThrow(
      'Unresolved Hevy exercise',
    );
  });

  it('prefills custom creation without inventing a muscle', () => {
    expect(customResolutionFor(source)).toEqual({
      kind: 'custom',
      exercise: {
        name: source.sourceTitle,
        primaryMuscle: 'other',
        secondaryMuscles: [],
        equipment: source.equipment,
        measurementType: source.measurementType,
        isUnilateral: 0,
      },
    });
  });
});
