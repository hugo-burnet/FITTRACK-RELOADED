import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import type {
  Exercise,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '@/data/types';
import { day } from '@/test/factories';
import { resetDb } from '@/test/resetDb';
import { newEntity } from './base';
import { saveBodyWeight } from './bodyMeasurements';
import { listHistoricalWorkouts } from './historicalWorkouts';

async function seedExercise(
  overrides: Partial<Exercise> = {},
): Promise<Exercise> {
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
  notes?: string;
  status?: Workout['status'];
  deletedAt?: number;
  exercises: Array<{
    exerciseId: string;
    notes?: string;
    order?: number;
    deletedAt?: number;
    sets: Array<{
      order: number;
      weight?: number;
      reps?: number;
      setType?: WorkoutSet['setType'];
      side?: WorkoutSet['side'];
      durationSeconds?: number;
      distanceMeters?: number;
      rpe?: number;
      isCompleted?: 0 | 1;
      deletedAt?: number;
    }>;
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
      ...(input.notes === undefined ? {} : { notes: input.notes }),
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
        ...(entry.notes === undefined ? {} : { notes: entry.notes }),
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
          setType: setInput.setType ?? 'normal',
          side: setInput.side ?? 'both',
          weight: setInput.weight ?? 80,
          reps: setInput.reps ?? 10,
          ...(setInput.durationSeconds === undefined
            ? {}
            : { durationSeconds: setInput.durationSeconds }),
          ...(setInput.distanceMeters === undefined
            ? {}
            : { distanceMeters: setInput.distanceMeters }),
          ...(setInput.rpe === undefined
            ? {}
            : { rpe: setInput.rpe }),
          isCompleted: setInput.isCompleted ?? 1,
          performedAt: input.startedAt + 60_000,
        }),
        deletedAt: setInput.deletedAt ?? 0,
      });
    }
  }

  await db.transaction(
    'rw',
    db.workouts,
    db.workoutExercises,
    db.workoutSets,
    async () => {
      await db.workouts.add(workout);
      await db.workoutExercises.bulkAdd(rows);
      await db.workoutSets.bulkAdd(sets);
    },
  );

  return workout;
}

describe('listHistoricalWorkouts', () => {
  beforeEach(resetDb);

  it('projects the body weight at each session and keeps the snapshotted load factor', async () => {
    const pushUp = await seedExercise({
      measurementType: 'reps_only',
      bodyweightLoadFactor: 0.9,
    });
    const workouts = await Promise.all(
      [day(1), day(5), day(9)].map((startedAt) =>
        seed({
          startedAt,
          exercises: [
            { exerciseId: pushUp.id, sets: [{ order: 0, reps: 8 }] },
          ],
        }),
      ),
    );
    const rows = await db.workoutExercises.toArray();
    await db.workoutExercises.bulkPut(
      rows.map((row) => ({
        ...row,
        exerciseMeasurementType: 'reps_only' as const,
        exerciseBodyweightLoadFactor: 0.7,
      })),
    );
    await db.exercises.update(pushUp.id, { bodyweightLoadFactor: 0.5 });
    await saveBodyWeight(82, day(3));
    await saveBodyWeight(80, day(7));

    const sources = await listHistoricalWorkouts({ kind: 'all-history' });

    expect(sources.map((source) => source.workoutId)).toEqual(
      workouts.map((workout) => workout.id),
    );
    expect(sources.map((source) => source.bodyWeightKg)).toEqual([82, 82, 80]);
    expect(
      sources.map((source) => source.exercises[0]?.bodyweightLoadFactor),
    ).toEqual([0.7, 0.7, 0.7]);
  });

  it('round-trips notes and historical set fields into the canonical projection', async () => {
    const bench = await seedExercise();
    const workout = await seed({
      startedAt: day(3),
      notes: 'Séance de reprise',
      exercises: [
        {
          exerciseId: bench.id,
          notes: 'Tempo contrôlé',
          sets: [
            {
              order: 0,
              setType: 'dropset',
              side: 'left',
              durationSeconds: 45,
              distanceMeters: 120,
              rpe: 8.5,
            },
          ],
        },
      ],
    });

    const [source] = await listHistoricalWorkouts({
      kind: 'workout',
      workoutId: workout.id,
    });

    expect(source).toMatchObject({
      notes: 'Séance de reprise',
      exercises: [
        {
          notes: 'Tempo contrôlé',
          sets: [
            {
              setType: 'dropset',
              side: 'left',
              durationSeconds: 45,
              distanceMeters: 120,
              rpe: 8.5,
            },
          ],
        },
      ],
    });
  });

  it('reads one session by id as a canonical projection', async () => {
    const bench = await seedExercise();
    const workout = await seed({
      startedAt: day(3),
      exercises: [
        {
          exerciseId: bench.id,
          sets: [{ order: 0 }, { order: 1 }],
        },
      ],
    });
    await seed({
      startedAt: day(4),
      exercises: [{ exerciseId: bench.id, sets: [{ order: 0 }] }],
    });

    const sources = await listHistoricalWorkouts({
      kind: 'workout',
      workoutId: workout.id,
    });

    expect(sources).toEqual([
      {
        workoutId: workout.id,
        name: 'Upper A',
        startedAt: day(3),
        timezoneOffsetMinutes: 120,
        durationSeconds: 3600,
        exercises: [
          {
            exerciseId: bench.id,
            name: 'Développé couché',
            measurementType: 'weight_reps',
            primaryMuscle: 'chest',
            equipment: 'barbell',
            // Le drapeau unilatéral est revenu dans la projection avec les
            // paliers, qui doivent distinguer une paire d'haltères d'un rowing
            // à un bras. Il en était sorti faute de lecteur ; il en ressortira
            // le jour où il en reperdra un.
            isUnilateral: 0,
            // La cadence de l'exercice, résolue contre la préférence : le temps
            // de travail d'une séance se compte avec, pas sans.
            repSeconds: 3,
            sets: [
              {
                setType: 'normal',
                side: 'both',
                weight: 80,
                reps: 10,
              },
              {
                setType: 'normal',
                side: 'both',
                weight: 80,
                reps: 10,
              },
            ],
          },
        ],
      },
    ]);
  });

  it('resolves exercise identity from the snapshot before the library', async () => {
    const bench = await seedExercise({
      name: 'Nom actuel',
      measurementType: 'weight_reps',
      primaryMuscle: 'shoulders',
      equipment: 'machine',
    });
    const workout = await seed({
      startedAt: day(3),
      exercises: [{ exerciseId: bench.id, sets: [{ order: 0 }] }],
    });
    const [row] = await db.workoutExercises
      .where('workoutId')
      .equals(workout.id)
      .toArray();
    await db.workoutExercises.update(row!.id, {
      exerciseName: 'Nom historique',
      exerciseMeasurementType: 'time_only',
      exercisePrimaryMuscle: 'chest',
      exerciseEquipment: 'cable',
    });

    const [source] = await listHistoricalWorkouts({
      kind: 'workout',
      workoutId: workout.id,
    });

    expect(source?.exercises[0]).toMatchObject({
      name: 'Nom historique',
      measurementType: 'time_only',
      primaryMuscle: 'chest',
      equipment: 'cable',
    });
  });

  it('returns an empty list for an unknown session', async () => {
    expect(
      await listHistoricalWorkouts({
        kind: 'workout',
        workoutId: 'nope',
      }),
    ).toEqual([]);
  });

  it('excludes active, discarded, and deleted sessions', async () => {
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

    expect(
      await listHistoricalWorkouts({
        kind: 'workout',
        workoutId: active.id,
      }),
    ).toEqual([]);
    expect(
      await listHistoricalWorkouts({
        kind: 'workout',
        workoutId: discarded.id,
      }),
    ).toEqual([]);
    expect(
      await listHistoricalWorkouts({
        kind: 'workout',
        workoutId: deleted.id,
      }),
    ).toEqual([]);
    expect(
      await listHistoricalWorkouts({ kind: 'all-history' }),
    ).toEqual([]);
  });

  it('excludes deleted rows, deleted sets, and incomplete sets', async () => {
    const bench = await seedExercise();
    const squat = await seedExercise({ name: 'Squat' });
    const workout = await seed({
      startedAt: day(3),
      exercises: [
        {
          exerciseId: bench.id,
          sets: [
            { order: 0, weight: 70 },
            { order: 1, weight: 80, deletedAt: day(4) },
            { order: 2, weight: 90, isCompleted: 0 },
          ],
        },
        {
          exerciseId: squat.id,
          deletedAt: day(4),
          sets: [{ order: 0 }],
        },
      ],
    });

    const [source] = await listHistoricalWorkouts({
      kind: 'workout',
      workoutId: workout.id,
    });

    expect(source?.exercises).toHaveLength(1);
    expect(
      source?.exercises[0]?.sets.map(({ weight }) => weight),
    ).toEqual([70]);
  });

  it('falls back to a soft-deleted exercise from the library', async () => {
    const bench = await seedExercise();
    await db.exercises.update(bench.id, { deletedAt: day(9) });
    const workout = await seed({
      startedAt: day(3),
      exercises: [{ exerciseId: bench.id, sets: [{ order: 0 }] }],
    });
    const [row] = await db.workoutExercises
      .where('workoutId')
      .equals(workout.id)
      .toArray();
    await db.workoutExercises.update(row!.id, {
      exerciseName: undefined,
      exerciseMeasurementType: undefined,
      exercisePrimaryMuscle: undefined,
      exerciseEquipment: undefined,
    });

    const [source] = await listHistoricalWorkouts({
      kind: 'workout',
      workoutId: workout.id,
    });

    expect(source?.exercises[0]).toMatchObject({
      name: 'Développé couché',
      measurementType: 'weight_reps',
      primaryMuscle: 'chest',
      equipment: 'barbell',
    });
  });

  it('keeps identity absent when neither snapshot nor library exists', async () => {
    const workout = await seed({
      startedAt: day(3),
      exercises: [
        { exerciseId: 'jamais-vu', sets: [{ order: 0 }] },
      ],
    });
    const [row] = await db.workoutExercises
      .where('workoutId')
      .equals(workout.id)
      .toArray();
    await db.workoutExercises.update(row!.id, {
      exerciseName: undefined,
      exerciseMeasurementType: undefined,
      exercisePrimaryMuscle: undefined,
      exerciseEquipment: undefined,
    });

    const [source] = await listHistoricalWorkouts({
      kind: 'workout',
      workoutId: workout.id,
    });

    expect(source?.exercises[0]).toEqual({
      exerciseId: 'jamais-vu',
      repSeconds: 3,
      sets: [
        {
          setType: 'normal',
          side: 'both',
          weight: 80,
          reps: 10,
        },
      ],
    });
  });

  it('bounds periods with an inclusive from and exclusive to', async () => {
    const bench = await seedExercise();
    for (const at of [day(1), day(3), day(5), day(7)]) {
      await seed({
        startedAt: at,
        exercises: [{ exerciseId: bench.id, sets: [{ order: 0 }] }],
      });
    }

    const sources = await listHistoricalWorkouts({
      kind: 'period',
      from: day(3),
      to: day(7),
    });

    expect(sources.map(({ startedAt }) => startedAt)).toEqual([
      day(3),
      day(5),
    ]);
  });

  it('returns sessions from oldest to newest', async () => {
    const bench = await seedExercise();
    for (const at of [day(5), day(1), day(3)]) {
      await seed({
        startedAt: at,
        exercises: [{ exerciseId: bench.id, sets: [{ order: 0 }] }],
      });
    }

    const sources = await listHistoricalWorkouts({
      kind: 'all-history',
    });

    expect(sources.map(({ startedAt }) => startedAt)).toEqual([
      day(1),
      day(3),
      day(5),
    ]);
  });

  it('sorts exercises and sets by their rank', async () => {
    const bench = await seedExercise();
    const squat = await seedExercise({ name: 'Squat' });
    const workout = await seed({
      startedAt: day(3),
      exercises: [
        {
          exerciseId: squat.id,
          order: 1,
          sets: [
            { order: 1, weight: 90 },
            { order: 0, weight: 80 },
          ],
        },
        {
          exerciseId: bench.id,
          order: 0,
          sets: [{ order: 0, weight: 70 }],
        },
      ],
    });

    const [source] = await listHistoricalWorkouts({
      kind: 'workout',
      workoutId: workout.id,
    });

    expect(
      source?.exercises.map(({ exerciseId }) => exerciseId),
    ).toEqual([bench.id, squat.id]);
    expect(
      source?.exercises[1]?.sets.map(({ weight }) => weight),
    ).toEqual([80, 90]);
  });

  it('keeps only matching rows and sessions for an exercise', async () => {
    const bench = await seedExercise();
    const squat = await seedExercise({ name: 'Squat' });
    await seed({
      startedAt: day(1),
      exercises: [
        { exerciseId: bench.id, sets: [{ order: 0 }] },
        { exerciseId: squat.id, sets: [{ order: 0 }] },
      ],
    });
    await seed({
      startedAt: day(2),
      exercises: [{ exerciseId: squat.id, sets: [{ order: 0 }] }],
    });

    const sources = await listHistoricalWorkouts({
      kind: 'exercise',
      exerciseId: bench.id,
    });

    expect(sources).toHaveLength(1);
    expect(sources[0]?.startedAt).toBe(day(1));
    expect(sources[0]?.exercises).toHaveLength(1);
    expect(sources[0]?.exercises[0]?.exerciseId).toBe(bench.id);
  });

  it('also bounds the history of an exercise', async () => {
    const bench = await seedExercise();
    for (const at of [day(1), day(3), day(5)]) {
      await seed({
        startedAt: at,
        exercises: [{ exerciseId: bench.id, sets: [{ order: 0 }] }],
      });
    }

    const sources = await listHistoricalWorkouts({
      kind: 'exercise',
      exerciseId: bench.id,
      from: day(3),
      to: day(5),
    });

    expect(sources.map(({ startedAt }) => startedAt)).toEqual([
      day(3),
    ]);
  });

  it('keeps a session without exercises except for exercise scope', async () => {
    const workout = await seed({ startedAt: day(3), exercises: [] });

    const all = await listHistoricalWorkouts({ kind: 'all-history' });
    expect(all).toHaveLength(1);
    expect(all[0]?.workoutId).toBe(workout.id);

    expect(
      await listHistoricalWorkouts({
        kind: 'exercise',
        exerciseId: 'bench',
      }),
    ).toEqual([]);
  });
});
