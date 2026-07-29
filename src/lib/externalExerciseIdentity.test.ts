import { describe, expect, it } from 'vitest';
import type { Equipment, Exercise, ExternalExerciseBinding, MeasurementType } from '@/data/types';
import type { NewExercise } from '@/data/repositories/exercises';
import {
  createExternalExerciseIdentityRegistry,
  externalExerciseIdentityKey,
  type ExternalExerciseDecision,
  type ExternalExerciseObservation,
} from './externalExerciseIdentity';

function exercise(id: string, overrides: Partial<Exercise> = {}): Exercise {
  return {
    id,
    createdAt: 1,
    updatedAt: 1,
    deletedAt: 0,
    name: id,
    primaryMuscle: 'other',
    secondaryMuscles: [],
    equipment: 'cable',
    measurementType: 'weight_reps',
    isCustom: 0,
    isUnilateral: 0,
    ...overrides,
  };
}

function observation(
  sourceTitle = 'Développé Debout Poulie Centrée',
  measurementType: MeasurementType = 'weight_reps',
  equipmentHint: Equipment = 'cable',
): ExternalExerciseObservation {
  return {
    source: 'hevy_csv',
    sourceTitle,
    measurementType,
    equipmentHint,
    sessionCount: 2,
    setCount: 6,
    examples: [],
  };
}

function binding(
  target: Exercise,
  sourceTitle = 'Développé Debout Poulie Centrée',
): ExternalExerciseBinding {
  return {
    id: `binding-${target.id}`,
    createdAt: 1,
    updatedAt: 1,
    deletedAt: 0,
    source: 'hevy_csv',
    identityKey: externalExerciseIdentityKey(sourceTitle),
    sourceTitle,
    exerciseId: target.id,
    measurementType: target.measurementType,
    equipmentHint: target.equipment,
    verification: 'user',
    confirmedAt: 1,
  };
}

const CUSTOM_EXERCISE: NewExercise = {
  name: 'Pallof press personnel',
  primaryMuscle: 'abs',
  secondaryMuscles: [],
  equipment: 'cable',
  measurementType: 'weight_reps',
  isUnilateral: 0,
};

describe('externalExerciseIdentityKey', () => {
  it('normalizes accents, case, spacing and punctuation', () => {
    expect(externalExerciseIdentityKey(' Développé  Debout, Poulie Centrée ')).toBe(
      'developpe debout poulie centree',
    );
  });

  it('keeps words that distinguish different external exercises', () => {
    expect(externalExerciseIdentityKey('Développé Debout Poulie Centrée')).not.toBe(
      externalExerciseIdentityKey('Développé Debout Centrée'),
    );
  });

  it('retains machine', () => {
    expect(externalExerciseIdentityKey('Presse Machine')).toContain('machine');
  });

  it('retains assis', () => {
    expect(externalExerciseIdentityKey('Développé Assis')).toContain('assis');
  });

  it('retains plural endings', () => {
    expect(externalExerciseIdentityKey('Extensions Jambes')).toBe('extensions jambes');
  });
});

describe('ExternalExerciseIdentityRegistry.review', () => {
  it('keeps a coded suggestion pending explicit confirmation', () => {
    const pallof = exercise('pallof', { slug: 'pallof-press' });
    const identityKey = externalExerciseIdentityKey('Développé Debout Poulie Centrée');
    const registry = createExternalExerciseIdentityRegistry(
      [pallof],
      [],
      new Map([[identityKey, [pallof]]]),
    );

    const review = registry.review([observation()]);

    expect(review[0]?.status).toBe('needs_confirmation');
    if (review[0]?.status !== 'needs_confirmation') {
      throw new Error('Expected a suggestion requiring confirmation');
    }
    expect(review[0].suggestions[0]?.exercise.slug).toBe('pallof-press');
  });

  it('confirms a live compatible user binding', () => {
    const pallof = exercise('pallof');
    const registry = createExternalExerciseIdentityRegistry([pallof], [binding(pallof)], new Map());

    const review = registry.review([observation()]);

    expect(review[0]).toMatchObject({
      status: 'confirmed',
      exercise: pallof,
    });
  });

  it('reports a deleted target as a conflict', () => {
    const deleted = exercise('deleted', { deletedAt: 10 });
    const registry = createExternalExerciseIdentityRegistry(
      [deleted],
      [binding(deleted)],
      new Map(),
    );

    expect(registry.review([observation()])[0]).toMatchObject({
      status: 'conflict',
      reason: 'target_deleted',
    });
  });

  it('reports a missing target as a conflict', () => {
    const target = exercise('missing');
    const registry = createExternalExerciseIdentityRegistry([], [binding(target)], new Map());

    expect(registry.review([observation()])[0]).toMatchObject({
      status: 'conflict',
      reason: 'target_missing',
    });
  });

  it('reports a changed measurement type as a conflict', () => {
    const target = exercise('changed', {
      measurementType: 'time_only',
    });
    const storedBinding = {
      ...binding(target),
      measurementType: 'weight_reps' as const,
    };
    const registry = createExternalExerciseIdentityRegistry([target], [storedBinding], new Map());

    expect(registry.review([observation()])[0]).toMatchObject({
      status: 'conflict',
      reason: 'measurement_changed',
    });
  });

  it('leaves ranked suggestions unconfirmed without a binding', () => {
    const first = exercise('first');
    const second = exercise('second');
    const identityKey = externalExerciseIdentityKey('Mouvement libre');
    const registry = createExternalExerciseIdentityRegistry(
      [first, second],
      [],
      new Map([[identityKey, [first, second]]]),
    );

    const entry = registry.review([observation('Mouvement libre')])[0];

    expect(entry?.status).toBe('needs_confirmation');
    if (entry?.status !== 'needs_confirmation') {
      throw new Error('Expected unconfirmed ranked suggestions');
    }
    expect(entry.suggestions.map(({ exercise: item }) => item.id)).toEqual(['first', 'second']);
  });
});

describe('ExternalExerciseIdentityRegistry.resolve', () => {
  it('requires a decision for every non-confirmed entry', () => {
    const registry = createExternalExerciseIdentityRegistry([], [], new Map());
    const entries = registry.review([observation()]);

    expect(() => registry.resolve(entries, [], 100)).toThrow('Missing external exercise decision');
  });

  it('resolves an existing exercise and writes a user binding', () => {
    const pallof = exercise('pallof');
    const registry = createExternalExerciseIdentityRegistry([pallof], [], new Map());
    const entries = registry.review([observation()]);
    const decision: ExternalExerciseDecision = {
      identityKey: entries[0]!.identityKey,
      kind: 'existing',
      exerciseId: pallof.id,
    };

    const resolved = registry.resolve(entries, [decision], 100);

    expect(resolved.exercisesByIdentityKey.get(decision.identityKey)).toBe(pallof);
    expect(resolved.exercisesToCreate).toEqual([]);
    expect(resolved.bindingsToWrite).toEqual([
      expect.objectContaining({
        source: 'hevy_csv',
        identityKey: decision.identityKey,
        exerciseId: pallof.id,
        verification: 'user',
        confirmedAt: 100,
      }),
    ]);
  });

  it('materializes a custom exercise and its user binding', () => {
    const registry = createExternalExerciseIdentityRegistry([], [], new Map());
    const entries = registry.review([observation()]);
    const decision: ExternalExerciseDecision = {
      identityKey: entries[0]!.identityKey,
      kind: 'custom',
      exercise: CUSTOM_EXERCISE,
    };

    const resolved = registry.resolve(entries, [decision], 200);
    const created = resolved.exercisesToCreate[0];

    expect(created).toMatchObject({
      ...CUSTOM_EXERCISE,
      isCustom: 1,
      createdAt: 200,
      updatedAt: 200,
      deletedAt: 0,
    });
    expect(resolved.bindingsToWrite[0]).toMatchObject({
      exerciseId: created?.id,
      verification: 'user',
      confirmedAt: 200,
    });
  });

  it('keeps a confirmed entry without rewriting its binding', () => {
    const pallof = exercise('pallof');
    const registry = createExternalExerciseIdentityRegistry([pallof], [binding(pallof)], new Map());
    const entries = registry.review([observation()]);

    const resolved = registry.resolve(entries, [], 300);

    expect(resolved.exercisesByIdentityKey.get(entries[0]!.identityKey)).toBe(pallof);
    expect(resolved.bindingsToWrite).toEqual([]);
  });

  it('writes a binding when a confirmed choice changes', () => {
    const pallof = exercise('pallof');
    const alternative = exercise('alternative');
    const registry = createExternalExerciseIdentityRegistry(
      [pallof, alternative],
      [binding(pallof)],
      new Map(),
    );
    const entries = registry.review([observation()]);
    const decision: ExternalExerciseDecision = {
      identityKey: entries[0]!.identityKey,
      kind: 'existing',
      exerciseId: alternative.id,
    };

    const resolved = registry.resolve(entries, [decision], 400);

    expect(resolved.bindingsToWrite[0]).toMatchObject({
      exerciseId: alternative.id,
      confirmedAt: 400,
    });
  });

  it('rejects duplicate decisions for one exact identity', () => {
    const pallof = exercise('pallof');
    const registry = createExternalExerciseIdentityRegistry([pallof], [], new Map());
    const entries = registry.review([observation()]);
    const decision: ExternalExerciseDecision = {
      identityKey: entries[0]!.identityKey,
      kind: 'existing',
      exerciseId: pallof.id,
    };

    expect(() => registry.resolve(entries, [decision, decision], 500)).toThrow(
      'Duplicate external exercise decision',
    );
  });
});
