import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { createCustomExercise } from '@/data/repositories/exercises';
import { deleteWorkout, startWorkout } from '@/data/repositories/workouts';
import { day, seedWorkout } from '@/test/factories';
import { resetDb } from '@/test/resetDb';
import {
  listCompletedWorkoutTimestamps,
  listHistoryDay,
  listHistoryExerciseOptions,
  listHistoryPage,
} from './history';

describe('history repository', () => {
  beforeEach(resetDb);

  it('rend uniquement les séances terminées vivantes, récentes en premier', async () => {
    const older = await seedWorkout({
      exerciseId: 'bench',
      performedAt: day(1),
      sets: [[100, 5]],
    });
    const newer = await seedWorkout({
      exerciseId: 'bench',
      performedAt: day(8),
      sets: [[102.5, 5]],
    });
    const deleted = await seedWorkout({
      exerciseId: 'bench',
      performedAt: day(15),
      sets: [[105, 5]],
    });
    await deleteWorkout(deleted.id);
    await startWorkout('', 'En cours');

    const page = await listHistoryPage({}, 0, 20);

    expect(page.items.map((item) => item.workoutId)).toEqual([newer.id, older.id]);
    expect(page.hasMore).toBe(false);
  });

  it('compte les exercices vivants et les séries validées', async () => {
    const saved = await seedWorkout({
      exerciseId: 'bench',
      performedAt: day(1),
      sets: [
        [100, 5],
        [90, 8],
      ],
    });

    const page = await listHistoryPage({}, 0, 20);

    expect(page.items[0]).toMatchObject({
      workoutId: saved.id,
      exerciseCount: 1,
      completedSetCount: 2,
    });
  });

  it('pagine sans tronquer la suite', async () => {
    for (let index = 0; index < 21; index += 1) {
      await seedWorkout({
        exerciseId: 'bench',
        performedAt: day(index + 1),
        sets: [[100, 5]],
      });
    }

    const first = await listHistoryPage({}, 0, 20);
    const second = await listHistoryPage({}, 20, 20);

    expect(first.items).toHaveLength(20);
    expect(first.hasMore).toBe(true);
    expect(second.items).toHaveLength(1);
    expect(second.hasMore).toBe(false);
    expect(new Set([...first.items, ...second.items].map((item) => item.workoutId)).size).toBe(21);
  });

  it('filtre les séances contenant un exercice donné', async () => {
    const bench = await seedWorkout({
      exerciseId: 'bench',
      performedAt: day(1),
      sets: [[100, 5]],
    });
    await seedWorkout({
      exerciseId: 'squat',
      performedAt: day(2),
      sets: [[140, 5]],
    });

    const page = await listHistoryPage({ exerciseId: 'bench' }, 0, 20);

    expect(page.items.map((item) => item.workoutId)).toEqual([bench.id]);
    expect(await listCompletedWorkoutTimestamps({ exerciseId: 'bench' })).toEqual([day(1)]);
  });

  it('rend toutes les séances du jour local sélectionné', async () => {
    const morning = await seedWorkout({
      exerciseId: 'bench',
      performedAt: new Date(2026, 6, 25, 8).getTime(),
      sets: [[100, 5]],
    });
    const evening = await seedWorkout({
      exerciseId: 'squat',
      performedAt: new Date(2026, 6, 25, 19).getTime(),
      sets: [[140, 5]],
    });
    await seedWorkout({
      exerciseId: 'row',
      performedAt: new Date(2026, 6, 26, 8).getTime(),
      sets: [[80, 8]],
    });

    const items = await listHistoryDay({}, new Date(2026, 6, 25, 15).getTime());

    expect(items.map((item) => item.workoutId)).toEqual([evening.id, morning.id]);
  });

  it('propose seulement les exercices présents dans des séances terminées', async () => {
    const bench = await createCustomExercise({
      name: 'Développé couché',
      primaryMuscle: 'chest',
      secondaryMuscles: [],
      equipment: 'barbell',
      measurementType: 'weight_reps',
      isUnilateral: 0,
    });
    const squat = await createCustomExercise({
      name: 'Squat',
      primaryMuscle: 'quads',
      secondaryMuscles: [],
      equipment: 'barbell',
      measurementType: 'weight_reps',
      isUnilateral: 0,
    });
    await createCustomExercise({
      name: 'Jamais fait',
      primaryMuscle: 'lats',
      secondaryMuscles: [],
      equipment: 'barbell',
      measurementType: 'weight_reps',
      isUnilateral: 0,
    });
    await seedWorkout({ exerciseId: squat.id, performedAt: day(1), sets: [[140, 5]] });
    await seedWorkout({ exerciseId: bench.id, performedAt: day(2), sets: [[100, 5]] });

    expect(await listHistoryExerciseOptions()).toEqual([
      { id: bench.id, name: 'Développé couché' },
      { id: squat.id, name: 'Squat' },
    ]);
  });

  it('ne laisse pas les séries supprimées gonfler le résumé', async () => {
    const saved = await seedWorkout({
      exerciseId: 'bench',
      performedAt: day(1),
      sets: [
        [100, 5],
        [90, 8],
      ],
    });
    const sets = await db.workoutSets.where('workoutId').equals(saved.id).toArray();
    await db.workoutSets.update(sets[0]!.id, { deletedAt: Date.now() });

    expect((await listHistoryPage({}, 0, 20)).items[0]?.completedSetCount).toBe(1);
  });
});
