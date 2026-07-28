import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import type { Exercise, Workout, WorkoutExercise, WorkoutSet } from '@/data/types';
import { day } from '@/test/factories';
import { resetDb } from '@/test/resetDb';
import { newEntity } from './base';
import { listExportSources } from './exportQueries';

async function seedExercise(overrides: Partial<Exercise> = {}): Promise<Exercise> {
  const exercise = newEntity<Exercise>({
    name: 'Développé couché',
    primaryMuscle: 'chest',
    secondaryMuscles: [],
    equipment: 'barbell',
    measurementType: 'weight_reps',
    isCustom: 0,
    isUnilateral: 0,
    ...overrides,
  });
  await db.exercises.add(exercise);
  return exercise;
}

/** A session written straight to the tables, so each test states its own edges. */
async function seed(input: {
  startedAt: number;
  status?: Workout['status'];
  deletedAt?: number;
  exercises: Array<{
    exerciseId: string;
    order?: number;
    deletedAt?: number;
    sets: Array<{ order: number; isCompleted?: 0 | 1; deletedAt?: number }>;
  }>;
}): Promise<Workout> {
  const workout: Workout = {
    ...newEntity<Workout>({
      routineId: '',
      name: 'Upper A',
      status: input.status ?? 'completed',
      startedAt: input.startedAt,
      endedAt: input.startedAt + 3_600_000,
      durationSeconds: 3600,
      startedTimezoneOffsetMinutes: 120,
    }),
    deletedAt: input.deletedAt ?? 0,
  };

  const rows: WorkoutExercise[] = [];
  const sets: WorkoutSet[] = [];

  for (const [index, entry] of input.exercises.entries()) {
    const row: WorkoutExercise = {
      ...newEntity<WorkoutExercise>({
        workoutId: workout.id,
        exerciseId: entry.exerciseId,
        order: entry.order ?? index,
        supersetGroup: 0,
        restSeconds: 120,
        exerciseName: 'Développé couché',
        exerciseMeasurementType: 'weight_reps',
        exercisePrimaryMuscle: 'chest',
        exerciseEquipment: 'barbell',
      }),
      deletedAt: entry.deletedAt ?? 0,
    };
    rows.push(row);

    for (const setInput of entry.sets) {
      sets.push({
        ...newEntity<WorkoutSet>({
          workoutExerciseId: row.id,
          exerciseId: entry.exerciseId,
          workoutId: workout.id,
          order: setInput.order,
          setType: 'normal',
          side: 'both',
          weight: 80,
          reps: 10,
          isCompleted: setInput.isCompleted ?? 1,
          performedAt: input.startedAt + 60_000,
        }),
        deletedAt: setInput.deletedAt ?? 0,
      });
    }
  }

  await db.transaction('rw', db.workouts, db.workoutExercises, db.workoutSets, async () => {
    await db.workouts.add(workout);
    await db.workoutExercises.bulkAdd(rows);
    await db.workoutSets.bulkAdd(sets);
  });

  return workout;
}

describe('listExportSources', () => {
  beforeEach(resetDb);

  it('reads one session by id', async () => {
    const bench = await seedExercise();
    const workout = await seed({
      startedAt: day(3),
      exercises: [{ exerciseId: bench.id, sets: [{ order: 0 }, { order: 1 }] }],
    });
    await seed({ startedAt: day(4), exercises: [{ exerciseId: bench.id, sets: [{ order: 0 }] }] });

    const sources = await listExportSources({ kind: 'workout', workoutId: workout.id });

    expect(sources).toHaveLength(1);
    expect(sources[0]?.workout.id).toBe(workout.id);
    expect(sources[0]?.exercises[0]?.sets).toHaveLength(2);
    expect(sources[0]?.exercises[0]?.exercise?.id).toBe(bench.id);
  });

  it('rend une liste vide pour une séance inconnue', async () => {
    expect(await listExportSources({ kind: 'workout', workoutId: 'nope' })).toEqual([]);
  });

  it('écarte une séance active, abandonnée ou supprimée', async () => {
    const bench = await seedExercise();
    const active = await seed({
      startedAt: day(1),
      status: 'active',
      exercises: [{ exerciseId: bench.id, sets: [{ order: 0 }] }],
    });
    const discarded = await seed({
      startedAt: day(2),
      status: 'discarded',
      exercises: [{ exerciseId: bench.id, sets: [{ order: 0 }] }],
    });
    const deleted = await seed({
      startedAt: day(3),
      deletedAt: day(9),
      exercises: [{ exerciseId: bench.id, sets: [{ order: 0 }] }],
    });

    expect(await listExportSources({ kind: 'workout', workoutId: active.id })).toEqual([]);
    expect(await listExportSources({ kind: 'workout', workoutId: discarded.id })).toEqual([]);
    expect(await listExportSources({ kind: 'workout', workoutId: deleted.id })).toEqual([]);
    expect(await listExportSources({ kind: 'all-history' })).toEqual([]);
  });

  it('écarte les lignes et les séries supprimées, et les séries non validées', async () => {
    const bench = await seedExercise();
    const squat = await seedExercise({ name: 'Squat' });
    const workout = await seed({
      startedAt: day(3),
      exercises: [
        {
          exerciseId: bench.id,
          sets: [
            { order: 0 },
            { order: 1, deletedAt: day(4) },
            { order: 2, isCompleted: 0 },
          ],
        },
        { exerciseId: squat.id, deletedAt: day(4), sets: [{ order: 0 }] },
      ],
    });

    const [source] = await listExportSources({ kind: 'workout', workoutId: workout.id });

    expect(source?.exercises).toHaveLength(1);
    expect(source?.exercises[0]?.sets.map((set) => set.order)).toEqual([0]);
  });

  it('conserve un exercice supprimé de la bibliothèque', async () => {
    const bench = await seedExercise();
    await db.exercises.update(bench.id, { deletedAt: day(9) });
    const workout = await seed({
      startedAt: day(3),
      exercises: [{ exerciseId: bench.id, sets: [{ order: 0 }] }],
    });

    const [source] = await listExportSources({ kind: 'workout', workoutId: workout.id });
    expect(source?.exercises[0]?.exercise?.name).toBe('Développé couché');
  });

  it('rend `undefined` pour un exercice absent de la base', async () => {
    const workout = await seed({
      startedAt: day(3),
      exercises: [{ exerciseId: 'jamais-vu', sets: [{ order: 0 }] }],
    });

    const [source] = await listExportSources({ kind: 'workout', workoutId: workout.id });
    expect(source?.exercises[0]?.exercise).toBeUndefined();
  });

  it('borne une période, `from` inclus et `to` exclu', async () => {
    const bench = await seedExercise();
    for (const at of [day(1), day(3), day(5), day(7)]) {
      await seed({ startedAt: at, exercises: [{ exerciseId: bench.id, sets: [{ order: 0 }] }] });
    }

    const sources = await listExportSources({ kind: 'period', from: day(3), to: day(7) });

    expect(sources.map((source) => source.workout.startedAt)).toEqual([day(3), day(5)]);
  });

  it('rend les séances de la plus ancienne à la plus récente', async () => {
    const bench = await seedExercise();
    for (const at of [day(5), day(1), day(3)]) {
      await seed({ startedAt: at, exercises: [{ exerciseId: bench.id, sets: [{ order: 0 }] }] });
    }

    const sources = await listExportSources({ kind: 'all-history' });
    expect(sources.map((source) => source.workout.startedAt)).toEqual([day(1), day(3), day(5)]);
  });

  it('trie les exercices et les séries par leur rang', async () => {
    const bench = await seedExercise();
    const squat = await seedExercise({ name: 'Squat' });
    const workout = await seed({
      startedAt: day(3),
      exercises: [
        { exerciseId: squat.id, order: 1, sets: [{ order: 1 }, { order: 0 }] },
        { exerciseId: bench.id, order: 0, sets: [{ order: 0 }] },
      ],
    });

    const [source] = await listExportSources({ kind: 'workout', workoutId: workout.id });

    expect(source?.exercises.map((entry) => entry.row.order)).toEqual([0, 1]);
    expect(source?.exercises[1]?.sets.map((set) => set.order)).toEqual([0, 1]);
  });

  it('ne garde, pour un exercice, que ses lignes et que les séances qui le contiennent', async () => {
    const bench = await seedExercise();
    const squat = await seedExercise({ name: 'Squat' });
    await seed({
      startedAt: day(1),
      exercises: [
        { exerciseId: bench.id, sets: [{ order: 0 }] },
        { exerciseId: squat.id, sets: [{ order: 0 }] },
      ],
    });
    await seed({ startedAt: day(2), exercises: [{ exerciseId: squat.id, sets: [{ order: 0 }] }] });

    const sources = await listExportSources({ kind: 'exercise', exerciseId: bench.id });

    expect(sources).toHaveLength(1);
    expect(sources[0]?.workout.startedAt).toBe(day(1));
    expect(sources[0]?.exercises).toHaveLength(1);
    expect(sources[0]?.exercises[0]?.row.exerciseId).toBe(bench.id);
  });

  it('borne aussi l’historique d’un exercice', async () => {
    const bench = await seedExercise();
    for (const at of [day(1), day(3), day(5)]) {
      await seed({ startedAt: at, exercises: [{ exerciseId: bench.id, sets: [{ order: 0 }] }] });
    }

    const sources = await listExportSources({
      kind: 'exercise',
      exerciseId: bench.id,
      from: day(3),
      to: day(5),
    });

    expect(sources.map((source) => source.workout.startedAt)).toEqual([day(3)]);
  });

  it('conserve une séance sans exercice, sauf sous un périmètre d’exercice', async () => {
    const workout = await seed({ startedAt: day(3), exercises: [] });

    const all = await listExportSources({ kind: 'all-history' });
    expect(all).toHaveLength(1);
    expect(all[0]?.workout.id).toBe(workout.id);

    expect(await listExportSources({ kind: 'exercise', exerciseId: 'bench' })).toEqual([]);
  });
});
