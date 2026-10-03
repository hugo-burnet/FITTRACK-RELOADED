import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { newEntity } from '@/data/repositories/base';
import type { Exercise } from '@/data/types';
import { resetDb } from '@/test/resetDb';
import { getFirstUseAt } from './firstUse';

function exerciseCreatedAt(createdAt: number, overrides: Partial<Exercise> = {}): Exercise {
  return {
    ...newEntity<Exercise>({
      name: `Exercice ${createdAt}`,
      primaryMuscle: 'chest',
      secondaryMuscles: [],
      equipment: 'barbell',
      measurementType: 'weight_reps',
      isCustom: 0,
      isUnilateral: 0,
    }),
    createdAt,
    ...overrides,
  };
}

describe('getFirstUseAt', () => {
  beforeEach(resetDb);

  it('is undefined while the catalogue has not been seeded', async () => {
    expect(await getFirstUseAt()).toBeUndefined();
  });

  it('is the oldest creation date, whatever order the rows were written in', async () => {
    await db.exercises.bulkAdd([
      exerciseCreatedAt(300),
      exerciseCreatedAt(100),
      exerciseCreatedAt(200),
    ]);

    expect(await getFirstUseAt()).toBe(100);
  });

  it('still counts an exercise that was deleted: deleting it does not make the app younger', async () => {
    await db.exercises.bulkAdd([
      exerciseCreatedAt(100, { deletedAt: 500 }),
      exerciseCreatedAt(200),
    ]);

    expect(await getFirstUseAt()).toBe(100);
  });

  it('counts the lifter’s own exercises as well as the shipped ones', async () => {
    await db.exercises.bulkAdd([
      exerciseCreatedAt(400, { slug: 'squat' }),
      exerciseCreatedAt(150, { isCustom: 1 }),
    ]);

    expect(await getFirstUseAt()).toBe(150);
  });
});
