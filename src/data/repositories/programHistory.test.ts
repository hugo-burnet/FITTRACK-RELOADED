import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import type { Workout, WorkoutExercise, WorkoutSet } from '@/data/types';
import { resetDb } from '@/test/resetDb';
import { newEntity } from './base';
import { listProgramWorkouts } from './programHistory';

const T0 = new Date(2026, 10, 2, 18, 0).getTime();
const DAY = 86_400_000;

/** Une séance écrite directement dans les tables : une série de 100 kg × 10 par défaut. */
async function seed(
  overrides: Partial<Workout>,
  sets: Array<{ weight: number; reps: number }> = [{ weight: 100, reps: 10 }],
): Promise<Workout> {
  const workout: Workout = {
    ...newEntity<Workout>({
      routineId: '',
      name: 'Poussée',
      status: 'completed',
      startedAt: T0,
      endedAt: T0 + 3_600_000,
      durationSeconds: 3600,
      startedTimezoneOffsetMinutes: 60,
      ...overrides,
    }),
    // `newEntity` pose `deletedAt: 0` : une suppression se réécrit après lui.
    ...(overrides.deletedAt === undefined ? {} : { deletedAt: overrides.deletedAt }),
  };
  const row = newEntity<WorkoutExercise>({
    workoutId: workout.id,
    exerciseId: 'ex-1',
    order: 0,
    supersetGroup: 0,
    restSeconds: 120,
    exerciseName: 'Développé couché',
    exerciseMeasurementType: 'weight_reps',
    exercisePrimaryMuscle: 'chest',
    exerciseEquipment: 'barbell',
  });
  const rows = sets.map((set, order) =>
    newEntity<WorkoutSet>({
      workoutExerciseId: row.id,
      exerciseId: 'ex-1',
      workoutId: workout.id,
      order,
      setType: 'normal',
      side: 'both',
      weight: set.weight,
      reps: set.reps,
      isCompleted: 1,
      performedAt: workout.startedAt + 60_000,
    }),
  );
  await db.workouts.add(workout);
  await db.workoutExercises.add(row);
  await db.workoutSets.bulkAdd(rows);
  return workout;
}

beforeEach(resetDb);

describe('listProgramWorkouts', () => {
  it('returns the finished sessions of one program, oldest first, with week, slot and tonnage', async () => {
    const later = await seed(
      {
        programId: 'p1',
        programWeekIndex: 1,
        programScheduleEntryId: 'e1',
        startedAt: T0 + 7 * DAY,
      },
      [{ weight: 50, reps: 10 }],
    );
    const first = await seed({
      programId: 'p1',
      programWeekIndex: 0,
      programScheduleEntryId: 'e1',
      startedAt: T0,
    });

    expect(await listProgramWorkouts('p1')).toEqual([
      {
        workoutId: first.id,
        name: 'Poussée',
        startedAt: T0,
        weekIndex: 0,
        entryId: 'e1',
        tonnage: 1000,
      },
      {
        workoutId: later.id,
        name: 'Poussée',
        startedAt: T0 + 7 * DAY,
        weekIndex: 1,
        entryId: 'e1',
        tonnage: 500,
      },
    ]);
  });

  it('leaves out other programs, free sessions, unfinished and deleted ones', async () => {
    await seed({ programId: 'p2', programWeekIndex: 0, programScheduleEntryId: 'e1' });
    await seed({ startedAt: T0 + DAY });
    await seed({
      programId: 'p1',
      programWeekIndex: 0,
      programScheduleEntryId: 'e1',
      status: 'active',
      startedAt: T0 + 2 * DAY,
    });
    await seed({
      programId: 'p1',
      programWeekIndex: 0,
      programScheduleEntryId: 'e1',
      deletedAt: 1,
      startedAt: T0 + 3 * DAY,
    });

    expect(await listProgramWorkouts('p1')).toEqual([]);
  });

  it('is empty for a program without session', async () => {
    expect(await listProgramWorkouts('nope')).toEqual([]);
  });
});
