import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import type { ExternalExerciseBinding } from '@/data/types';
import { resetDb } from '@/test/resetDb';
import { listExternalExerciseBindings } from './externalExerciseBindings';

const stamps = { createdAt: 1, updatedAt: 1, deletedAt: 0 };

const binding = (
  identityKey: string,
  deletedAt = 0,
): ExternalExerciseBinding => ({
  ...stamps,
  id: crypto.randomUUID(),
  deletedAt,
  source: 'hevy_csv',
  identityKey,
  sourceTitle: 'D\u00e9velopp\u00e9 debout poulie centr\u00e9e',
  exerciseId: 'pallof',
  measurementType: 'weight_reps',
  verification: 'user',
  confirmedAt: 1,
});

describe('listExternalExerciseBindings', () => {
  beforeEach(resetDb);

  it('retourne les liaisons vivantes de la source tri\u00e9es par cl\u00e9', async () => {
    await db.externalExerciseBindings.bulkAdd([
      binding('tirage vertical'),
      binding('developpe debout poulie centree'),
      binding('developpe couche', 2),
    ]);

    expect(await listExternalExerciseBindings('hevy_csv')).toEqual([
      expect.objectContaining({
        source: 'hevy_csv',
        identityKey: 'developpe debout poulie centree',
        exerciseId: 'pallof',
        verification: 'user',
      }),
      expect.objectContaining({ identityKey: 'tirage vertical' }),
    ]);
  });
});
