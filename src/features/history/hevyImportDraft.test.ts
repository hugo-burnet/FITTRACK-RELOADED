import { describe, expect, it, vi } from 'vitest';
import type {
  Exercise,
  ExternalExerciseBinding,
} from '@/data/types';
import type {
  HevyImportData,
  HevySourceExercise,
} from '@/lib/hevyCsv';
import type { HevyImportPreparation } from '@/data/repositories/hevyImport';
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

function preparation(
  overrides: Partial<HevyImportPreparation> = {},
): HevyImportPreparation {
  return {
    exercises: [bench],
    existingImportKeys: [],
    confirmedBindings: [],
    aliveRoutineFolderNames: [],
    ...overrides,
  } as HevyImportPreparation;
}

function binding(
  exerciseId: string,
  overrides: Partial<ExternalExerciseBinding> = {},
): ExternalExerciseBinding {
  return {
    id: 'binding',
    createdAt: 1,
    updatedAt: 1,
    deletedAt: 0,
    source: 'hevy_csv',
    identityKey: 'developpe couche barre',
    sourceTitle: source.sourceTitle,
    exerciseId,
    measurementType: 'weight_reps',
    equipmentHint: 'barbell',
    verification: 'user',
    confirmedAt: 1,
    ...overrides,
  };
}

function dataFor(
  sourceExercise: HevySourceExercise,
  workouts: HevyImportData['workouts'] = data.workouts,
): HevyImportData {
  return {
    ...data,
    workouts: workouts.map((workout) => ({
      ...workout,
      exercises: workout.exercises.map((exercise) => ({
        ...exercise,
        sourceTitle: sourceExercise.sourceTitle,
      })),
    })),
    sourceExercises: [sourceExercise],
  };
}

describe('Hevy import mapping draft', () => {
  it('keeps a catalogue alias as an unconfirmed suggestion', () => {
    const deadHangSource: HevySourceExercise = {
      sourceTitle: 'Dead Hang',
      measurementType: 'time_only',
      equipment: 'bodyweight',
    };
    const deadHang: Exercise = {
      ...bench,
      id: 'dead-hang',
      name: 'Suspension à la barre',
      slug: 'dead-hang',
      equipment: 'bodyweight',
      measurementType: 'time_only',
    };

    const draft = createHevyImportDraft(
      dataFor(deadHangSource),
      preparation({ exercises: [deadHang] }),
    );

    expect(draft.rows[0]!.review.status).toBe('needs_confirmation');
    expect(draft.rows[0]!.resolution).toBeUndefined();
    expect(unresolvedHevySources(draft)).toHaveLength(1);
    expect(
      draft.rows[0]!.review.status === 'needs_confirmation'
        ? draft.rows[0]!.review.suggestions[0]?.exercise.id
        : undefined,
    ).toBe(deadHang.id);
  });

  it('pre-resolves only a valid user-confirmed binding', () => {
    const draft = createHevyImportDraft(
      data,
      preparation({ confirmedBindings: [binding(bench.id)] }),
    );

    expect(draft.rows[0]).toMatchObject({
      review: {
        status: 'confirmed',
        exercise: { id: bench.id },
      },
      resolution: { kind: 'existing', exerciseId: bench.id },
      resolutionSource: 'binding',
    });
    expect(unresolvedHevySources(draft)).toEqual([]);
  });

  it('never pre-resolves a legacy mapping-shaped suggestion', () => {
    const legacyPreparation = {
      ...preparation(),
      savedMappings: {
        'developpe couche|barbell': bench.id,
      },
    } as HevyImportPreparation;

    const draft = createHevyImportDraft(data, legacyPreparation);

    expect(draft.rows[0]!.review.status).toBe('needs_confirmation');
    expect(draft.rows[0]!.resolution).toBeUndefined();
  });

  it.each([
    {
      name: 'deleted',
      exercise: { ...bench, deletedAt: 2 },
      expectedReason: 'target_deleted',
    },
    {
      name: 'measurement-incompatible',
      exercise: { ...bench, measurementType: 'time_only' as const },
      expectedReason: 'measurement_changed',
    },
  ])(
    'keeps a $name bound target as a conflict',
    ({ exercise, expectedReason }) => {
      const draft = createHevyImportDraft(
        data,
        preparation({
          exercises: [exercise],
          confirmedBindings: [binding(exercise.id)],
        }),
      );

      expect(draft.rows[0]!.review).toMatchObject({
        status: 'conflict',
        reason: expectedReason,
      });
      expect(draft.rows[0]!.resolution).toBeUndefined();
      expect(unresolvedHevySources(draft)).toEqual([source]);
    },
  );

  it.each(['needs_confirmation', 'conflict'] as const)(
    'lets a user resolve a %s row',
    (initialStatus) => {
      const initial =
        initialStatus === 'conflict'
          ? createHevyImportDraft(
              data,
              preparation({
                exercises: [bench],
                confirmedBindings: [binding('missing')],
              }),
            )
          : createHevyImportDraft(data, preparation());

      expect(initial.rows[0]!.review.status).toBe(initialStatus);

      const next = setHevyImportResolution(
        initial,
        source.sourceTitle,
        { kind: 'existing', exerciseId: bench.id },
      );

      expect(next.rows[0]).toMatchObject({
        resolution: { kind: 'existing', exerciseId: bench.id },
        resolutionSource: 'user',
      });
      expect(unresolvedHevySources(next)).toEqual([]);
    },
  );

  it('does not treat a conflict as resolved by a stale binding source', () => {
    const conflict = createHevyImportDraft(
      data,
      preparation({
        exercises: [bench],
        confirmedBindings: [binding('missing')],
      }),
    );
    const stale = {
      ...conflict,
      rows: conflict.rows.map((row) => ({
        ...row,
        resolution: {
          kind: 'existing' as const,
          exerciseId: bench.id,
        },
        resolutionSource: 'binding' as const,
      })),
    };

    expect(unresolvedHevySources(stale)).toEqual([source]);
  });

  it('aggregates sessions and sets with the three newest examples', () => {
    const workouts = [1, 4, 2, 3].map((startedAt) => ({
      ...data.workouts[0]!,
      title: `Séance ${startedAt}`,
      importKey: `hevy:${startedAt}`,
      startedAt,
      exercises: [
        {
          ...data.workouts[0]!.exercises[0]!,
          sets: [
            {
              sourceLine: startedAt,
              order: 0,
              setType: 'normal' as const,
              weight: startedAt,
              reps: 10,
            },
            {
              sourceLine: startedAt + 10,
              order: 1,
              setType: 'normal' as const,
              weight: startedAt,
              reps: 8,
            },
          ],
        },
      ],
    }));

    const draft = createHevyImportDraft(
      dataFor(source, workouts),
      preparation(),
    );

    expect(draft.rows[0]!.review.observation).toMatchObject({
      sessionCount: 4,
      setCount: 8,
    });
    expect(
      draft.rows[0]!.review.observation.examples.map(
        (example) => example.workoutName,
      ),
    ).toEqual(['Séance 4', 'Séance 3', 'Séance 2']);
  });

  it('removes sources used only by duplicate workouts', () => {
    const draft = createHevyImportDraft(
      data,
      preparation({ existingImportKeys: ['hevy:a'] }),
    );

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
      preparation(),
      importedAt,
    );

    expect(draft).toMatchObject({
      importedAt,
      routineFolderName: 'Import Hevy — 27/07/2026',
      routineNames: ['Séance A'],
    });
  });

  it('uses the identity registry to materialize authoritative import entities', () => {
    const initial = createHevyImportDraft(data, preparation());
    const next = setHevyImportResolution(
      initial,
      source.sourceTitle,
      { kind: 'existing', exerciseId: bench.id },
    );
    const authoritative = {
      exercisesByIdentityKey: new Map([
        ['developpe couche barre', bench],
      ]),
      exercisesToCreate: [],
      bindingsToWrite: [binding(bench.id)],
    };
    const resolve = vi.fn().mockReturnValue(authoritative);
    const draft = {
      ...next,
      identityRegistry: {
        ...next.identityRegistry!,
        resolve,
      },
    };

    expect(resolutionsFromHevyDraft(draft)).toBe(authoritative);
    expect(resolve).toHaveBeenCalledWith(
      next.rows.map((row) => row.review),
      [
        {
          identityKey: 'developpe couche barre',
          kind: 'existing',
          exerciseId: bench.id,
        },
      ],
      next.importedAt,
    );
  });

  it('materializes an explicit user choice through the real identity registry', () => {
    const importedAt = 7_500;
    const initial = createHevyImportDraft(
      data,
      preparation(),
      importedAt,
    );
    const draft = setHevyImportResolution(
      initial,
      source.sourceTitle,
      { kind: 'existing', exerciseId: bench.id },
    );

    const resolution = resolutionsFromHevyDraft(draft);
    const identityKey = draft.rows[0]!.review.identityKey;

    expect(resolution.exercisesByIdentityKey.get(identityKey)).toBe(
      bench,
    );
    expect(resolution.exercisesToCreate).toEqual([]);
    expect(resolution.bindingsToWrite).toEqual([
      expect.objectContaining({
        source: 'hevy_csv',
        identityKey,
        sourceTitle: source.sourceTitle,
        exerciseId: bench.id,
        verification: 'user',
        confirmedAt: importedAt,
      }),
    ]);
  });

  it('reuses a valid user binding without materializing a new confirmation', () => {
    const draft = createHevyImportDraft(
      data,
      preparation({ confirmedBindings: [binding(bench.id)] }),
      8_500,
    );

    const resolution = resolutionsFromHevyDraft(draft);
    const identityKey = draft.rows[0]!.review.identityKey;

    expect(resolution.exercisesByIdentityKey.get(identityKey)).toBe(
      bench,
    );
    expect(resolution.exercisesToCreate).toEqual([]);
    expect(resolution.bindingsToWrite).toEqual([]);
  });

  it('does not pass an unconfirmed suggestion as a user decision', () => {
    const draft = createHevyImportDraft(data, preparation());
    const resolve = vi.fn();
    const forged = {
      ...draft,
      identityRegistry: {
        ...draft.identityRegistry!,
        resolve,
      },
      rows: draft.rows.map((row) => ({
        ...row,
        resolution: {
          kind: 'existing' as const,
          exerciseId: bench.id,
        },
        resolutionSource: undefined,
      })),
    };

    expect(() => resolutionsFromHevyDraft(forged)).toThrow(
      'Unresolved Hevy exercise',
    );
    expect(resolve).not.toHaveBeenCalled();
  });

  it('refuses to export an unresolved draft', () => {
    const draft = createHevyImportDraft(data, preparation());

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
