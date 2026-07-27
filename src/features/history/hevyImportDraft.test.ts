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

  it('removes sources used only by duplicate workouts', () => {
    const draft = createHevyImportDraft(data, {
      exercises: [bench],
      existingImportKeys: ['hevy:a'],
      savedMappings: {},
    });

    expect(draft).toMatchObject({
      importableWorkouts: 0,
      skippedWorkouts: 1,
      rows: [],
    });
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
      'developpe couche': {
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
