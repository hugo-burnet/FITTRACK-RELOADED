import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { resetDb } from '@/test/resetDb';
import { alive, newEntity, softDelete, touch } from './base';
import type { Exercise } from '@/data/types';

const sample = () =>
  newEntity<Exercise>({
    name: 'Développé couché',
    primaryMuscle: 'chest',
    secondaryMuscles: ['triceps', 'shoulders'],
    equipment: 'barbell',
    measurementType: 'weight_reps',
    isCustom: 0,
    isUnilateral: 0,
  });

describe('base repository', () => {
  beforeEach(resetDb);

  it('génère un id, des dates de création et un deletedAt à 0', () => {
    const e = sample();
    expect(e.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(e.createdAt).toBeGreaterThan(0);
    expect(e.updatedAt).toBe(e.createdAt);
    expect(e.deletedAt).toBe(0); // 0, PAS null — cf. architecture §3
  });

  it('met à jour updatedAt sans toucher createdAt', () => {
    const e = sample();
    const updated = touch(e, { name: 'Développé incliné' });
    expect(updated.name).toBe('Développé incliné');
    expect(updated.createdAt).toBe(e.createdAt);
    expect(updated.updatedAt).toBeGreaterThanOrEqual(e.createdAt);
  });

  it('supprime logiquement sans effacer la ligne', async () => {
    const e = sample();
    await db.exercises.add(e);
    await softDelete(db.exercises, e.id);

    const row = await db.exercises.get(e.id);
    expect(row).toBeDefined(); // la ligne existe toujours
    expect(row!.deletedAt).toBeGreaterThan(0);
  });

  it('filtre les entités supprimées', () => {
    const kept = { deletedAt: 0 };
    const removed = { deletedAt: Date.now() };
    expect(alive([kept, removed])).toEqual([kept]);
  });
});
