import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import type {
  Exercise,
  Routine,
  RoutineExercise,
  RoutineSet,
  SetType,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '@/data/types';
import { resetDb } from '@/test/resetDb';
import { newEntity } from './base';
import { applyRoutineTargetProposals, loadRoutineTargetReview } from './routineTargetReview';

const day = (n: number): number => Date.UTC(2026, 0, 1) + n * 86_400_000;

async function seedExercise(partial: Partial<Exercise> & Pick<Exercise, 'name'>): Promise<Exercise> {
  const exercise = newEntity<Exercise>({
    primaryMuscle: 'lats',
    secondaryMuscles: [],
    equipment: 'cable',
    measurementType: 'weight_reps',
    isCustom: 0,
    isUnilateral: 0,
    ...partial,
  });
  await db.exercises.add(exercise);
  return exercise;
}

async function seedRoutine(
  name: string,
  lines: { exerciseId: string; sets: { targetWeight?: number; targetRepsMax?: number }[] }[],
): Promise<Routine> {
  const routine = newEntity<Routine>({ name, folderId: '', order: 0 });
  await db.routines.add(routine);

  for (const [index, line] of lines.entries()) {
    const row = newEntity<RoutineExercise>({
      routineId: routine.id,
      exerciseId: line.exerciseId,
      order: index,
      supersetGroup: 0,
      restSeconds: 0,
      notes: '',
    });
    await db.routineExercises.add(row);
    await db.routineSets.bulkAdd(
      line.sets.map((set, order) =>
        newEntity<RoutineSet>({
          routineExerciseId: row.id,
          order,
          setType: 'normal',
          targetReps: 8,
          targetRepsMax: set.targetRepsMax ?? 12,
          targetWeight: set.targetWeight,
        }),
      ),
    );
  }

  return routine;
}

interface SeedSetInput {
  weight?: number;
  reps?: number;
  rpe?: number;
  setType?: SetType;
}

async function seedSession(input: {
  routineId?: string;
  performedAt: number;
  blocks: { exerciseId: string; exerciseName: string; sets: SeedSetInput[] }[];
}): Promise<Workout> {
  const workout = newEntity<Workout>({
    routineId: input.routineId ?? '',
    name: 'Séance',
    status: 'completed',
    startedAt: input.performedAt,
    endedAt: input.performedAt + 3_600_000,
    durationSeconds: 3600,
  });
  await db.workouts.add(workout);

  for (const [index, block] of input.blocks.entries()) {
    const row = newEntity<WorkoutExercise>({
      workoutId: workout.id,
      exerciseId: block.exerciseId,
      order: index,
      supersetGroup: 0,
      restSeconds: 120,
      exerciseName: block.exerciseName,
      exerciseMeasurementType: 'weight_reps',
    });
    await db.workoutExercises.add(row);
    await db.workoutSets.bulkAdd(
      block.sets.map((set, order) =>
        newEntity<WorkoutSet>({
          workoutExerciseId: row.id,
          exerciseId: block.exerciseId,
          workoutId: workout.id,
          order,
          setType: set.setType ?? 'normal',
          side: 'both',
          weight: set.weight,
          reps: set.reps,
          rpe: set.rpe,
          isCompleted: 1,
          performedAt: input.performedAt,
        }),
      ),
    );
  }

  return workout;
}

const working = (weight: number, reps = 12): SeedSetInput[] =>
  [0, 1, 2].map(() => ({ weight, reps }));

describe('loadRoutineTargetReview', () => {
  beforeEach(resetDb);

  it('rend null pour une routine qui n’existe plus', async () => {
    expect(await loadRoutineTargetReview('inconnue')).toBeNull();
  });

  it('propose d’aligner une cible que l’historique a dépassée', async () => {
    const row = await seedExercise({ name: 'Rowing à la poulie' });
    const routine = await seedRoutine('Tirage', [
      { exerciseId: row.id, sets: [{ targetWeight: 57.5 }, { targetWeight: 57.5 }, { targetWeight: 57.5 }] },
    ]);
    await seedSession({
      routineId: routine.id,
      performedAt: day(10),
      blocks: [{ exerciseId: row.id, exerciseName: row.name, sets: working(70) }],
    });

    const review = await loadRoutineTargetReview(routine.id);

    expect(review?.proposals).toHaveLength(1);
    expect(review?.proposals[0]).toMatchObject({
      kind: 'align_weight',
      exerciseName: 'Rowing à la poulie',
      currentWeight: 57.5,
      performedWeight: 70,
      proposedWeight: 70,
    });
  });

  it('ne compte pas deux fois un bloc lu par les deux fenêtres', async () => {
    const row = await seedExercise({ name: 'Rowing à la poulie' });
    const routine = await seedRoutine('Tirage', [
      { exerciseId: row.id, sets: [{ targetWeight: 60 }, { targetWeight: 60 }, { targetWeight: 60 }] },
    ]);
    // La séance est à la fois l'historique de l'exercice et une séance de la
    // routine : comptée deux fois, ses six séries de travail feraient passer
    // pour tenue une prescription de trois qui ne l'était pas.
    await seedSession({
      routineId: routine.id,
      performedAt: day(10),
      blocks: [
        {
          exerciseId: row.id,
          exerciseName: row.name,
          sets: [
            { weight: 60, reps: 12 },
            { weight: 60, reps: 12 },
            { weight: 60, reps: 9 },
          ],
        },
      ],
    });

    const review = await loadRoutineTargetReview(routine.id);

    expect(review?.proposals).toEqual([]);
    expect(review?.unchanged[0]?.reason).toBe('range_not_completed');
  });

  it('signale à part un exercice fait dans les séances de la routine', async () => {
    const row = await seedExercise({ name: 'Rowing à la poulie' });
    const extra = await seedExercise({ name: 'Face pull' });
    const routine = await seedRoutine('Tirage', [
      { exerciseId: row.id, sets: [{ targetWeight: 57.5 }] },
    ]);
    await seedSession({
      routineId: routine.id,
      performedAt: day(10),
      blocks: [
        { exerciseId: row.id, exerciseName: row.name, sets: [{ weight: 57.5, reps: 12 }] },
        { exerciseId: extra.id, exerciseName: extra.name, sets: [{ weight: 25, reps: 15 }] },
      ],
    });

    const review = await loadRoutineTargetReview(routine.id);

    expect(review?.missingExercises).toHaveLength(1);
    expect(review?.missingExercises[0]).toMatchObject({
      exerciseId: extra.id,
      exerciseName: 'Face pull',
      bestWeight: 25,
    });
  });

  it('ignore une séance abandonnée', async () => {
    const row = await seedExercise({ name: 'Rowing à la poulie' });
    const routine = await seedRoutine('Tirage', [
      { exerciseId: row.id, sets: [{ targetWeight: 57.5 }] },
    ]);
    const workout = await seedSession({
      routineId: routine.id,
      performedAt: day(10),
      blocks: [{ exerciseId: row.id, exerciseName: row.name, sets: [{ weight: 70, reps: 12 }] }],
    });
    await db.workouts.update(workout.id, { status: 'discarded' });

    const review = await loadRoutineTargetReview(routine.id);

    expect(review?.proposals).toEqual([]);
    expect(review?.unchanged[0]?.reason).toBe('no_history');
  });

  it('lit l’exercice fait ailleurs que dans cette routine', async () => {
    const row = await seedExercise({ name: 'Rowing à la poulie' });
    const routine = await seedRoutine('Tirage', [
      { exerciseId: row.id, sets: [{ targetWeight: 57.5 }] },
    ]);
    // Séance libre : la règle 2 parle des séances contenant l'exercice.
    await seedSession({
      performedAt: day(10),
      blocks: [{ exerciseId: row.id, exerciseName: row.name, sets: [{ weight: 65, reps: 12 }] }],
    });

    const review = await loadRoutineTargetReview(routine.id);

    expect(review?.proposals[0]).toMatchObject({ kind: 'align_weight', proposedWeight: 65 });
    // Mais elle n'est pas une séance de la routine : rien à signaler côté règle 6.
    expect(review?.missingExercises).toEqual([]);
  });
});

describe('applyRoutineTargetProposals', () => {
  beforeEach(resetDb);

  it('n’écrit rien tant qu’elle n’est pas appelée, puis écrit exactement la proposition', async () => {
    const row = await seedExercise({ name: 'Rowing à la poulie' });
    const routine = await seedRoutine('Tirage', [
      { exerciseId: row.id, sets: [{ targetWeight: 57.5 }, { targetWeight: 57.5 }] },
    ]);
    await seedSession({
      routineId: routine.id,
      performedAt: day(10),
      blocks: [
        {
          exerciseId: row.id,
          exerciseName: row.name,
          sets: [
            { weight: 70, reps: 12 },
            { weight: 70, reps: 12 },
          ],
        },
      ],
    });

    const review = await loadRoutineTargetReview(routine.id);
    // La revue seule ne touche à rien.
    expect((await db.routineSets.toArray()).map((set) => set.targetWeight)).toEqual([57.5, 57.5]);

    const written = await applyRoutineTargetProposals(review?.proposals ?? []);

    expect(written).toBe(2);
    expect((await db.routineSets.toArray()).map((set) => set.targetWeight)).toEqual([70, 70]);
  });

  it('décale une pyramide sans l’aplatir', async () => {
    const row = await seedExercise({ name: 'Développé couché', equipment: 'barbell' });
    const routine = await seedRoutine('Push', [
      { exerciseId: row.id, sets: [{ targetWeight: 50 }, { targetWeight: 55 }, { targetWeight: 60 }] },
    ]);
    await seedSession({
      routineId: routine.id,
      performedAt: day(10),
      blocks: [
        {
          exerciseId: row.id,
          exerciseName: row.name,
          sets: [
            { weight: 50, reps: 12 },
            { weight: 55, reps: 12 },
            { weight: 60, reps: 12 },
          ],
        },
      ],
    });

    const review = await loadRoutineTargetReview(routine.id);
    expect(review?.proposals[0]).toMatchObject({ kind: 'increase_weight', deltaKg: 2.5 });

    await applyRoutineTargetProposals(review?.proposals ?? []);

    const sets = (await db.routineSets.toArray()).sort((a, b) => a.order - b.order);
    expect(sets.map((set) => set.targetWeight)).toEqual([52.5, 57.5, 62.5]);
  });

  it('ignore une série supprimée pendant que la revue était ouverte', async () => {
    const row = await seedExercise({ name: 'Rowing à la poulie' });
    const routine = await seedRoutine('Tirage', [
      { exerciseId: row.id, sets: [{ targetWeight: 57.5 }, { targetWeight: 57.5 }] },
    ]);
    await seedSession({
      routineId: routine.id,
      performedAt: day(10),
      blocks: [
        {
          exerciseId: row.id,
          exerciseName: row.name,
          sets: [
            { weight: 70, reps: 12 },
            { weight: 70, reps: 12 },
          ],
        },
      ],
    });

    const review = await loadRoutineTargetReview(routine.id);
    const sets = (await db.routineSets.toArray()).sort((a, b) => a.order - b.order);
    await db.routineSets.update(sets[1]?.id ?? '', { deletedAt: Date.now() });

    const written = await applyRoutineTargetProposals(review?.proposals ?? []);

    expect(written).toBe(1);
    expect((await db.routineSets.get(sets[0]?.id ?? ''))?.targetWeight).toBe(70);
  });
});
