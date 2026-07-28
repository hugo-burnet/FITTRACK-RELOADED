import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { resetDb } from '@/test/resetDb';
import type { Exercise, Syncable } from '@/data/types';
import { newEntity } from './base';
import { loadExerciseSnapshots } from './exerciseSnapshot';

const exercise = (over: Partial<Omit<Exercise, keyof Syncable>> = {}): Exercise =>
  newEntity<Exercise>({
    name: 'Développé couché',
    primaryMuscle: 'chest',
    secondaryMuscles: ['triceps'],
    equipment: 'barbell',
    measurementType: 'weight_reps',
    isCustom: 0,
    isUnilateral: 0,
    ...over,
  });

describe('loadExerciseSnapshots', () => {
  beforeEach(resetDb);

  it('associe chaque identifiant à son instantané', async () => {
    const bench = exercise();
    const squat = exercise({ name: 'Squat', primaryMuscle: 'quads' });
    await db.exercises.bulkAdd([bench, squat]);

    const snapshots = await loadExerciseSnapshots([bench.id, squat.id]);

    expect(snapshots.get(bench.id)?.exerciseName).toBe('Développé couché');
    expect(snapshots.get(squat.id)?.exercisePrimaryMuscle).toBe('quads');
  });

  it('conserve un exercice supprimé : la ligne existe toujours', async () => {
    const removed = exercise({ name: 'Machine retirée' });
    await db.exercises.add({ ...removed, deletedAt: Date.now() });

    const snapshots = await loadExerciseSnapshots([removed.id]);

    expect(snapshots.get(removed.id)?.exerciseName).toBe('Machine retirée');
  });

  it('rend un instantané vide pour un identifiant inconnu', async () => {
    const snapshots = await loadExerciseSnapshots(['inconnu']);

    expect(snapshots.get('inconnu')).toEqual({});
  });

  it('dédoublonne les identifiants répétés', async () => {
    const bench = exercise();
    await db.exercises.add(bench);

    const snapshots = await loadExerciseSnapshots([bench.id, bench.id, bench.id]);

    expect(snapshots.size).toBe(1);
    expect(snapshots.get(bench.id)?.exerciseName).toBe('Développé couché');
  });
});
