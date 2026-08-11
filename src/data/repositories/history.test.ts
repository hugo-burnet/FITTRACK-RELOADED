
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/data/db';
import { createCustomExercise, updateExercise } from '@/data/repositories/exercises';
import { saveBodyWeight } from '@/data/repositories/bodyMeasurements';
import type { MuscleGroup, PersonalRecord, WorkoutExercise } from '@/data/types';
import { projectRecordTimeline, type RecordEventDraft } from '@/lib/records';
import {
  addWorkoutExercise,
  addSet,
  deleteWorkout,
  startWorkout,
} from '@/data/repositories/workouts';
import {
  getLastPerformance,
} from '@/data/repositories/workoutHistory';
import { day, seedWorkout } from '@/test/factories';
import { resetDb } from '@/test/resetDb';
import {
  type ArchivedWorkoutDraft,
  deleteArchivedWorkout,
  getArchivedWorkoutDetail,
  listCompletedWorkoutTimestamps,
  listHistoryDay,
  listHistoryExerciseOptions,
  listHistoryPage,
  saveArchivedWorkout,
} from './history';

import { reconcileRecordsForExercises } from './recordReconciliation';
import { listRecordSourcesForExercises } from './recordSources';

function recordContent(record: PersonalRecord): RecordEventDraft {
  return {
    exerciseId: record.exerciseId,
    type: record.type,
    value: record.value,
    achievedAt: record.achievedAt,
    workoutId: record.workoutId,
    ...(record.workoutSetId === undefined ? {} : { workoutSetId: record.workoutSetId }),
    ...(record.weight === undefined ? {} : { weight: record.weight }),
    ...(record.reps === undefined ? {} : { reps: record.reps }),
    ...(record.durationSeconds === undefined ? {} : { durationSeconds: record.durationSeconds }),
    ...(record.distanceMeters === undefined ? {} : { distanceMeters: record.distanceMeters }),
    ...(record.formula === undefined ? {} : { formula: record.formula }),
  };
}

async function expectExactRecordProjection(exerciseIds: readonly string[]): Promise<void> {
  const expected = projectRecordTimeline(
    await listRecordSourcesForExercises(exerciseIds),
    'epley',
  );
  const active = (await db.personalRecords.toArray()).filter(
    (record) => record.deletedAt === 0 && exerciseIds.includes(record.exerciseId),
  );
  const key = (
    record: Pick<PersonalRecord, 'exerciseId' | 'type' | 'workoutId' | 'workoutSetId'>,
  ) => [record.exerciseId, record.type, record.workoutId, record.workoutSetId ?? ''].join('|');
  const byKey = new Map(active.map((record) => [key(record), record]));

  expect(byKey.size).toBe(active.length);
  expect([...byKey.keys()].sort()).toEqual(expected.map(key).sort());
  expect(expected.map((draft) => recordContent(byKey.get(key(draft))!))).toStrictEqual(expected);
}

describe('history repository', () => {
  beforeEach(resetDb);

  it('résout le poids du corps au début de la séance archivée', async () => {
    const pushUp = await createCustomExercise({
      name: 'Pompes',
      primaryMuscle: 'chest',
      secondaryMuscles: ['triceps'],
      equipment: 'bodyweight',
      measurementType: 'reps_only',
      isUnilateral: 0,
      bodyweightLoadFactor: 0.7,
    });
    const workout = await seedWorkout({
      exerciseId: pushUp.id,
      performedAt: day(5),
      sets: [[0, 8]],
    });
    await saveBodyWeight(80, day(4));
    await saveBodyWeight(95, day(6));

    const detail = await getArchivedWorkoutDetail(workout.id);

    expect(detail?.bodyWeightKg).toBe(80);
    expect(detail?.exercises[0]?.identity?.bodyweightLoadFactor).toBe(0.7);
  });

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
describe('archived workout mutations', () => {
  beforeEach(resetDb);

  function draftFor(workoutId: string): ArchivedWorkoutDraft {
    return {
      workoutId,
      name: 'Séance corrigée',
      startedAt: day(3),
      durationSeconds: 3600,
      exercises: [],
    };
  }

  it('ne lit comme archive qu’une séance terminée vivante', async () => {
    const completed = await seedWorkout({
      exerciseId: 'bench',
      performedAt: day(1),
      sets: [[100, 5]],
    });
    const active = await startWorkout('', 'En cours');

    expect((await getArchivedWorkoutDetail(completed.id))?.workout.id).toBe(completed.id);
    expect(await getArchivedWorkoutDetail(active.id)).toBeNull();
    expect(await getArchivedWorkoutDetail('missing')).toBeNull();
  });

  it('refuse de modifier une séance qui n’est pas archivée', async () => {
    const active = await startWorkout('', 'En cours');

    await expect(saveArchivedWorkout(draftFor(active.id))).rejects.toThrow(
      'Archived workout not found',
    );
  });

  it('exige un nom non vide', async () => {
    const workout = await seedWorkout({
      exerciseId: 'bench',
      performedAt: day(1),
      sets: [[100, 5]],
    });

    await expect(
      saveArchivedWorkout({ ...draftFor(workout.id), name: '   ' }),
    ).rejects.toThrow('Workout name is required');
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1])(
    'refuse le timestamp de début invalide %s',
    async (startedAt) => {
      const workout = await seedWorkout({
        exerciseId: 'bench',
        performedAt: day(1),
        sets: [[100, 5]],
      });

      await expect(
        saveArchivedWorkout({ ...draftFor(workout.id), startedAt }),
      ).rejects.toThrow('Workout start must be a valid timestamp');
    },
  );

  it.each([-1, 1.5])('refuse la durée invalide %s', async (durationSeconds) => {
    const workout = await seedWorkout({
      exerciseId: 'bench',
      performedAt: day(1),
      sets: [[100, 5]],
    });

    await expect(
      saveArchivedWorkout({ ...draftFor(workout.id), durationSeconds }),
    ).rejects.toThrow('Workout duration must be a non-negative integer');
  });

  it('refuse un identifiant de ligne d’exercice répété', async () => {
    const workout = await seedWorkout({
      exerciseId: 'bench',
      performedAt: day(1),
      sets: [[100, 5]],
    });
    const row = await db.workoutExercises.where('workoutId').equals(workout.id).first();
    expect(row).toBeDefined();

    await expect(
      saveArchivedWorkout({
        ...draftFor(workout.id),
        exercises: [
          {
            id: row!.id,
            exerciseId: 'bench',
            supersetGroup: 0,
            restSeconds: 120,
            sets: [],
          },
          {
            id: row!.id,
            exerciseId: 'squat',
            supersetGroup: 0,
            restSeconds: 120,
            sets: [],
          },
        ],
      }),
    ).rejects.toThrow('Workout exercise ids must be unique');
  });

  it('refuse un identifiant de série répété', async () => {
    const workout = await seedWorkout({
      exerciseId: 'bench',
      performedAt: day(1),
      sets: [[100, 5]],
    });
    const row = await db.workoutExercises.where('workoutId').equals(workout.id).first();
    const set = await db.workoutSets.where('workoutId').equals(workout.id).first();
    expect(row).toBeDefined();
    expect(set).toBeDefined();

    await expect(
      saveArchivedWorkout({
        ...draftFor(workout.id),
        exercises: [{
          id: row!.id,
          exerciseId: 'bench',
          supersetGroup: 0,
          restSeconds: 120,
          sets: [
            { id: set!.id, setType: 'normal', side: 'both', weight: 100, reps: 5 },
            { id: set!.id, setType: 'normal', side: 'both', weight: 90, reps: 8 },
          ],
        }],
      }),
    ).rejects.toThrow('Workout set ids must be unique');
  });

  it('refuse une ligne d’exercice appartenant à une autre séance', async () => {
    const target = await seedWorkout({
      exerciseId: 'bench',
      performedAt: day(1),
      sets: [[100, 5]],
    });
    const other = await seedWorkout({
      exerciseId: 'squat',
      performedAt: day(2),
      sets: [[140, 5]],
    });
    const foreignRow = await db.workoutExercises.where('workoutId').equals(other.id).first();
    expect(foreignRow).toBeDefined();

    await expect(
      saveArchivedWorkout({
        ...draftFor(target.id),
        exercises: [{
          id: foreignRow!.id,
          exerciseId: foreignRow!.exerciseId,
          supersetGroup: 0,
          restSeconds: foreignRow!.restSeconds,
          sets: [],
        }],
      }),
    ).rejects.toThrow('Workout exercise does not belong to archived workout');
  });

  it('refuse une série appartenant à une autre séance', async () => {
    const target = await seedWorkout({
      exerciseId: 'bench',
      performedAt: day(1),
      sets: [[100, 5]],
    });
    const other = await seedWorkout({
      exerciseId: 'squat',
      performedAt: day(2),
      sets: [[140, 5]],
    });
    const targetRow = await db.workoutExercises.where('workoutId').equals(target.id).first();
    const foreignSet = await db.workoutSets.where('workoutId').equals(other.id).first();
    expect(targetRow).toBeDefined();
    expect(foreignSet).toBeDefined();

    await expect(
      saveArchivedWorkout({
        ...draftFor(target.id),
        exercises: [{
          id: targetRow!.id,
          exerciseId: targetRow!.exerciseId,
          supersetGroup: 0,
          restSeconds: targetRow!.restSeconds,
          sets: [{
            id: foreignSet!.id,
            setType: 'normal',
            side: 'both',
            weight: 100,
            reps: 5,
          }],
        }],
      }),
    ).rejects.toThrow('Workout set does not belong to archived workout');
  });

  it('remplace atomiquement les métadonnées, exercices et séries', async () => {
    const workout = await seedWorkout({
      exerciseId: 'bench',
      performedAt: day(1),
      sets: [[100, 5], [90, 8]],
    });
    const detail = await getArchivedWorkoutDetail(workout.id);
    expect(detail).not.toBeNull();

    const row = detail!.exercises[0]!;
    await saveArchivedWorkout({
      workoutId: workout.id,
      name: 'Poussée corrigée',
      notes: 'Bonne séance',
      startedAt: day(8),
      durationSeconds: 2700,
      exercises: [{
        id: row.row.id,
        exerciseId: row.row.exerciseId,
        supersetGroup: 0,
        restSeconds: row.row.restSeconds,
        notes: 'Tempo contrôlé',
        sets: [{
          id: row.sets[0]!.id,
          setType: 'warmup',
          side: 'both',
          weight: 60,
          reps: 10,
        }, {
          setType: 'normal',
          side: 'both',
          weight: 102.5,
          reps: 5,
          rpe: 8.5,
        }],
      }],
    });

    const saved = await getArchivedWorkoutDetail(workout.id);
    expect(saved?.workout).toMatchObject({
      name: 'Poussée corrigée',
      notes: 'Bonne séance',
      startedAt: day(8),
      endedAt: day(8) + 2_700_000,
      durationSeconds: 2700,
    });
    expect(saved?.exercises[0]?.row).toMatchObject({
      order: 0,
      notes: 'Tempo contrôlé',
    });
    expect(saved?.exercises[0]?.sets).toHaveLength(2);
    expect(saved?.exercises[0]?.sets[0]?.performedAt).toBe(day(8));
    expect(saved?.exercises[0]?.sets[1]).toMatchObject({
      exerciseId: row.row.exerciseId,
      workoutId: workout.id,
      setType: 'normal',
      weight: 102.5,
      reps: 5,
      rpe: 8.5,
      isCompleted: 1,
      performedAt: day(8) + 2,
    });
  });

  it('préserve les métadonnées de provenance, deload et fuseau pendant une édition', async () => {
    const workout = await seedWorkout({
      exerciseId: 'bench',
      performedAt: day(1),
      sets: [[100, 5]],
    });
    await db.workouts.update(workout.id, {
      deloadPercent: 80,
      importSource: 'hevy_csv',
      importKey: 'hevy:upper-a',
      startedTimezoneOffsetMinutes: 120,
    });

    await saveArchivedWorkout({
      ...draftFor(workout.id),
      name: 'Séance renommée',
    });

    expect(await db.workouts.get(workout.id)).toMatchObject({
      name: 'Séance renommée',
      deloadPercent: 80,
      importSource: 'hevy_csv',
      importKey: 'hevy:upper-a',
      startedTimezoneOffsetMinutes: 120,
    });
  });

  it('retire réellement les résultats optionnels absents du brouillon', async () => {
    const workout = await seedWorkout({
      exerciseId: 'bench',
      performedAt: day(1),
      sets: [[100, 5]],
    });
    const detail = await getArchivedWorkoutDetail(workout.id);
    const row = detail!.exercises[0]!;
    await db.workoutSets.update(row.sets[0]!.id, {
      durationSeconds: 45,
      distanceMeters: 250,
      rpe: 9,
    });

    await saveArchivedWorkout({
      ...draftFor(workout.id),
      exercises: [{
        id: row.row.id,
        exerciseId: row.row.exerciseId,
        supersetGroup: 0,
        restSeconds: row.row.restSeconds,
        sets: [{
          id: row.sets[0]!.id,
          setType: 'normal',
          side: 'both',
          weight: 95,
          reps: 6,
        }],
      }],
    });

    const saved = await db.workoutSets.get(row.sets[0]!.id);
    expect(saved).not.toHaveProperty('durationSeconds');
    expect(saved).not.toHaveProperty('distanceMeters');
    expect(saved).not.toHaveProperty('rpe');
  });

  it('supprime logiquement les exercices et séries omis du brouillon', async () => {
    const workout = await seedWorkout({
      exerciseId: 'bench',
      performedAt: day(1),
      sets: [[100, 5], [90, 8]],
    });
    const originalRow = await db.workoutExercises.where('workoutId').equals(workout.id).first();
    const originalSets = await db.workoutSets.where('workoutId').equals(workout.id).toArray();

    await saveArchivedWorkout(draftFor(workout.id));

    expect((await db.workoutExercises.get(originalRow!.id))?.deletedAt).toBeGreaterThan(0);
    for (const set of originalSets) {
      expect((await db.workoutSets.get(set.id))?.deletedAt).toBeGreaterThan(0);
    }
  });

  it('crée des UUID, rangs continus et identifiants dénormalisés cohérents', async () => {
    const workout = await seedWorkout({
      exerciseId: 'bench',
      performedAt: day(1),
      sets: [[100, 5]],
    });

    await saveArchivedWorkout({
      ...draftFor(workout.id),
      startedAt: 0,
      exercises: [{
        exerciseId: 'squat',
        supersetGroup: 1,
        restSeconds: 180,
        sets: [
          { setType: 'normal', side: 'both', weight: 140, reps: 5 },
          { setType: 'normal', side: 'both', weight: 130, reps: 8 },
        ],
      }, {
        exerciseId: 'bench',
        supersetGroup: 1,
        restSeconds: 120,
        sets: [
          { setType: 'warmup', side: 'both', weight: 60, reps: 10 },
        ],
      }],
    });

    const detail = await getArchivedWorkoutDetail(workout.id);
    expect(detail?.exercises.map(({ row }) => row.order)).toEqual([0, 1]);
    expect(detail?.exercises.map(({ row }) => row.id)).toEqual([
      expect.stringMatching(/^[0-9a-f-]{36}$/),
      expect.stringMatching(/^[0-9a-f-]{36}$/),
    ]);
    expect(detail?.exercises[0]?.sets.map((set) => set.order)).toEqual([0, 1]);
    expect(detail?.exercises[1]?.sets.map((set) => set.order)).toEqual([0]);
    expect(detail?.exercises.flatMap(({ sets }) => sets.map((set) => set.performedAt)))
      .toEqual([1, 2, 3]);

    for (const { row, sets } of detail!.exercises) {
      for (const set of sets) {
        expect(set.id).toMatch(/^[0-9a-f-]{36}$/);
        expect(set).toMatchObject({
          workoutId: workout.id,
          workoutExerciseId: row.id,
          exerciseId: row.exerciseId,
          isCompleted: 1,
        });
      }
    }
  });

  it('conserve le décalage relatif des séries existantes et garantit performedAt > 0', async () => {
    const workout = await seedWorkout({
      exerciseId: 'bench',
      performedAt: day(1),
      sets: [[100, 5], [90, 8]],
    });
    const detail = await getArchivedWorkoutDetail(workout.id);
    const row = detail!.exercises[0]!;
    await db.workoutSets.update(row.sets[0]!.id, { performedAt: workout.startedAt + 5_000 });
    await db.workoutSets.update(row.sets[1]!.id, { performedAt: workout.startedAt - 5_000 });

    await saveArchivedWorkout({
      ...draftFor(workout.id),
      startedAt: 0,
      exercises: [{
        id: row.row.id,
        exerciseId: row.row.exerciseId,
        supersetGroup: 0,
        restSeconds: row.row.restSeconds,
        sets: row.sets.map((set) => ({
          id: set.id,
          setType: set.setType,
          side: set.side,
          weight: set.weight,
          reps: set.reps,
        })),
      }],
    });

    const saved = await getArchivedWorkoutDetail(workout.id);
    expect(saved?.exercises[0]?.sets.map((set) => set.performedAt)).toEqual([5_000, 1]);
  });

  it('annule tout le remplacement si le dernier bulkPut échoue', async () => {
    const workout = await seedWorkout({
      exerciseId: 'bench',
      performedAt: day(1),
      sets: [[100, 5], [90, 8]],
    });
    const detail = await getArchivedWorkoutDetail(workout.id);
    const row = detail!.exercises[0]!;
    const snapshot = async () => ({
      workout: await db.workouts.get(workout.id),
      rows: (await db.workoutExercises.where('workoutId').equals(workout.id).toArray())
        .sort((left, right) => left.id.localeCompare(right.id)),
      sets: (await db.workoutSets.where('workoutId').equals(workout.id).toArray())
        .sort((left, right) => left.id.localeCompare(right.id)),
    });
    const before = await snapshot();
    const fail = vi
      .spyOn(db.workoutSets, 'bulkPut')
      .mockRejectedValueOnce(new Error('échec injecté'));

    try {
      await expect(
        saveArchivedWorkout({
          ...draftFor(workout.id),
          name: 'Ne doit pas rester',
          exercises: [{
            id: row.row.id,
            exerciseId: row.row.exerciseId,
            supersetGroup: 0,
            restSeconds: row.row.restSeconds,
            sets: [{
              id: row.sets[0]!.id,
              setType: 'normal',
              side: 'both',
              weight: 110,
              reps: 3,
            }],
          }],
        }),
      ).rejects.toThrow('échec injecté');
    } finally {
      fail.mockRestore();
    }

    expect(await snapshot()).toStrictEqual(before);
  });

  it('supprime logiquement toute l’archive avec un timestamp unique', async () => {
    const workout = await seedWorkout({
      exerciseId: 'bench',
      performedAt: day(1),
      sets: [[100, 5]],
    });

    await deleteArchivedWorkout(workout.id);

    const savedWorkout = await db.workouts.get(workout.id);
    const savedRow = await db.workoutExercises.where('workoutId').equals(workout.id).first();
    const savedSet = await db.workoutSets.where('workoutId').equals(workout.id).first();
    const timestamps = [
      savedWorkout!.deletedAt,
      savedWorkout!.updatedAt,
      savedRow!.deletedAt,
      savedRow!.updatedAt,
      savedSet!.deletedAt,
      savedSet!.updatedAt,
    ];
    expect(timestamps[0]).toBeGreaterThan(0);
    expect(new Set(timestamps)).toEqual(new Set([timestamps[0]]));
  });

  it('refuse une séance active sans modifier ses lignes', async () => {
    const workout = await startWorkout('', 'En cours');
    const row = await addWorkoutExercise(workout.id, 'bench');
    await addSet(row.id, { weight: 100, reps: 5 });
    const snapshot = async () => ({
      workout: await db.workouts.get(workout.id),
      rows: await db.workoutExercises.where('workoutId').equals(workout.id).toArray(),
      sets: await db.workoutSets.where('workoutId').equals(workout.id).toArray(),
    });
    const before = await snapshot();

    await expect(deleteArchivedWorkout(workout.id)).rejects.toThrow(
      'Archived workout not found',
    );

    expect(await snapshot()).toStrictEqual(before);
  });

  it('refuse une archive déjà supprimée', async () => {
    const workout = await seedWorkout({
      exerciseId: 'bench',
      performedAt: day(1),
      sets: [[100, 5]],
    });
    await deleteWorkout(workout.id);

    await expect(deleteArchivedWorkout(workout.id)).rejects.toThrow(
      'Archived workout not found',
    );
  });

  it('annule toute la suppression si une écriture enfant échoue', async () => {
    const workout = await seedWorkout({
      exerciseId: 'bench',
      performedAt: day(1),
      sets: [[100, 5]],
    });
    const snapshot = async () => ({
      workout: await db.workouts.get(workout.id),
      rows: await db.workoutExercises.where('workoutId').equals(workout.id).toArray(),
      sets: await db.workoutSets.where('workoutId').equals(workout.id).toArray(),
    });
    const before = await snapshot();
    const fail = vi
      .spyOn(db.workoutSets, 'bulkPut')
      .mockRejectedValueOnce(new Error('échec enfant injecté'));

    try {
      await expect(deleteArchivedWorkout(workout.id)).rejects.toThrow(
        'échec enfant injecté',
      );
    } finally {
      fail.mockRestore();
    }

    expect(await snapshot()).toStrictEqual(before);
  });

  it.each([
    { label: 'une charge abaissée', setType: 'normal' as const, weight: 90 },
    { label: 'une série requalifiée en échauffement', setType: 'warmup' as const, weight: 110 },
  ])('recalcule le record après $label', async ({ setType, weight }) => {
    await seedWorkout({
      exerciseId: 'bench',
      performedAt: day(1),
      sets: [[100, 5]],
    });
    const corrected = await seedWorkout({
      exerciseId: 'bench',
      performedAt: day(2),
      sets: [[110, 5]],
    });
    const detail = await getArchivedWorkoutDetail(corrected.id);
    const row = detail!.exercises[0]!;
    await reconcileRecordsForExercises(['bench'], 'epley');

    await saveArchivedWorkout({
      workoutId: corrected.id,
      name: corrected.name,
      startedAt: corrected.startedAt,
      durationSeconds: corrected.durationSeconds,
      exercises: [{
        id: row.row.id,
        exerciseId: row.row.exerciseId,
        supersetGroup: row.row.supersetGroup,
        restSeconds: row.row.restSeconds,
        sets: [{
          id: row.sets[0]!.id,
          setType,
          side: 'both',
          weight,
          reps: 5,
        }],
      }],
    });

    await expectExactRecordProjection(['bench']);
  });

  it('retire une archive supprimée de la dernière performance et des records', async () => {
    const previous = await seedWorkout({
      exerciseId: 'bench',
      performedAt: day(1),
      sets: [[100, 5]],
    });
    const removed = await seedWorkout({
      exerciseId: 'bench',
      performedAt: day(2),
      sets: [[110, 5]],
    });
    const previousSet = await db.workoutSets.where('workoutId').equals(previous.id).first();
    await reconcileRecordsForExercises(['bench'], 'epley');

    await deleteArchivedWorkout(removed.id);

    expect((await getLastPerformance('bench')).map((set) => set.id)).toEqual([
      previousSet!.id,
    ]);
    await expectExactRecordProjection(['bench']);
  });
});

// ---------------------------------------------------------------------------
// L'instantané des métadonnées dans l'éditeur d'archive (jalon 08A)
// ---------------------------------------------------------------------------

describe("instantané de l'exercice dans une archive", () => {
  beforeEach(resetDb);

  const anExercise = (name: string, primaryMuscle: MuscleGroup) =>
    createCustomExercise({
      name,
      primaryMuscle,
      secondaryMuscles: [],
      equipment: 'barbell',
      measurementType: 'weight_reps',
      isUnilateral: 0,
    });

  async function rowOf(workoutId: string): Promise<WorkoutExercise> {
    const rows = (await db.workoutExercises.where('workoutId').equals(workoutId).toArray()).filter(
      (row) => row.deletedAt === 0,
    );
    const row = rows[0];
    if (row === undefined) throw new Error('aucune ligne vivante');
    return row;
  }

  it('fige les métadonnées sur une ligne créée dans l’éditeur', async () => {
    const workout = await seedWorkout({
      exerciseId: 'bench',
      performedAt: day(1),
      sets: [[100, 5]],
    });
    const squat = await anExercise('Squat', 'quads');

    await saveArchivedWorkout({
      workoutId: workout.id,
      name: 'Séance corrigée',
      startedAt: day(1),
      durationSeconds: 3600,
      exercises: [{
        exerciseId: squat.id,
        supersetGroup: 0,
        restSeconds: 120,
        sets: [{ setType: 'normal', side: 'both', weight: 140, reps: 5 }],
      }],
    });

    const row = await rowOf(workout.id);
    expect(row.exerciseName).toBe('Squat');
    expect(row.exercisePrimaryMuscle).toBe('quads');
  });

  /**
   * Corriger l'exercice d'une série, c'est affirmer ce qui a réellement été
   * fait : la ligne mérite les métadonnées d'aujourd'hui de son nouvel
   * exercice, pas celles de l'ancien.
   */
  it('réécrit l’instantané quand l’exercice de la ligne change', async () => {
    const bench = await anExercise('Développé couché', 'chest');
    const squat = await anExercise('Squat', 'quads');
    const workout = await seedWorkout({
      exerciseId: bench.id,
      performedAt: day(1),
      sets: [[100, 5]],
    });
    const before = await rowOf(workout.id);

    await saveArchivedWorkout({
      workoutId: workout.id,
      name: 'Séance corrigée',
      startedAt: day(1),
      durationSeconds: 3600,
      exercises: [{
        id: before.id,
        exerciseId: squat.id,
        supersetGroup: 0,
        restSeconds: before.restSeconds,
        sets: [{ setType: 'normal', side: 'both', weight: 140, reps: 5 }],
      }],
    });

    const after = await rowOf(workout.id);
    expect(after.exerciseName).toBe('Squat');
    expect(after.exercisePrimaryMuscle).toBe('quads');
  });

  it('conserve l’instantané d’une ligne dont l’exercice ne change pas', async () => {
    const bench = await anExercise('Développé couché', 'chest');
    const workout = await seedWorkout({
      exerciseId: bench.id,
      performedAt: day(1),
      sets: [[100, 5]],
    });
    const before = await rowOf(workout.id);
    await db.workoutExercises.put({
      ...before,
      exerciseName: 'Développé couché',
      exerciseMeasurementType: 'weight_reps',
      exercisePrimaryMuscle: 'chest',
      exerciseEquipment: 'barbell',
    });

    await updateExercise(bench.id, { name: 'Développé incliné', primaryMuscle: 'shoulders' });

    await saveArchivedWorkout({
      workoutId: workout.id,
      name: 'Séance corrigée',
      startedAt: day(1),
      durationSeconds: 3600,
      exercises: [{
        id: before.id,
        exerciseId: bench.id,
        supersetGroup: 0,
        restSeconds: before.restSeconds,
        notes: 'Tempo contrôlé',
        sets: [{ setType: 'normal', side: 'both', weight: 100, reps: 5 }],
      }],
    });

    const after = await rowOf(workout.id);
    expect(after.notes).toBe('Tempo contrôlé');
    expect(after.exerciseName).toBe('Développé couché');
    expect(after.exercisePrimaryMuscle).toBe('chest');
  });
});
