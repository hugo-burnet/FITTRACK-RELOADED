import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { newEntity } from '@/data/repositories/base';
import type {
  CoachRecommendation,
  Exercise,
  MeasurementType,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '@/data/types';
import { resetDb } from '@/test/resetDb';
import { applyCoachObjective, applyCoachRecommendation } from './coachApply';

const bench: Exercise = {
  ...newEntity<Exercise>({
    name: 'Développé couché',
    primaryMuscle: 'chest',
    secondaryMuscles: [],
    equipment: 'barbell',
    measurementType: 'weight_reps',
    isCustom: 0,
    isUnilateral: 0,
  }),
  id: 'bench',
};

async function seedRow(measurementType: MeasurementType = 'weight_reps'): Promise<string> {
  const workout: Workout = {
    ...newEntity<Workout>({
      routineId: '',
      name: 'Live',
      status: 'active',
      startedAt: Date.UTC(2026, 7, 12, 10),
      endedAt: 0,
      durationSeconds: 0,
    }),
    id: 'live',
  };
  const row: WorkoutExercise = {
    ...newEntity<WorkoutExercise>({
      workoutId: workout.id,
      exerciseId: bench.id,
      order: 0,
      supersetGroup: 0,
      restSeconds: 120,
      exerciseName: bench.name,
      exerciseMeasurementType: measurementType,
      exerciseEquipment: bench.equipment,
    }),
    id: 'live-row',
  };
  await db.workouts.add(workout);
  await db.workoutExercises.add(row);
  return row.id;
}

function set(id: string, order: number, fields: Partial<WorkoutSet>): WorkoutSet {
  return {
    ...newEntity<WorkoutSet>({
      workoutExerciseId: 'live-row',
      exerciseId: bench.id,
      workoutId: 'live',
      order,
      setType: 'normal',
      side: 'both',
      reps: 10,
      isCompleted: 0,
      performedAt: 0,
      ...fields,
    }),
    id,
  };
}

describe('applyCoachObjective', () => {
  beforeEach(async () => {
    await resetDb();
    await db.exercises.add(bench);
  });

  it('writes a target on a set where nothing has been typed', async () => {
    const rowId = await seedRow();
    await db.workoutSets.add(set('s0', 0, {}));

    expect(await applyCoachObjective(rowId, 50)).toBe(1);
    const stored = await db.workoutSets.get('s0');
    expect(stored?.targetWeight).toBe(50);
    // A target, not a value: the grid still shows an empty field to fill in.
    expect(stored?.weight).toBeUndefined();
  });

  it('overwrites a value already typed, because that is what the tap means', async () => {
    const rowId = await seedRow();
    await db.workoutSets.add(set('s0', 0, { weight: 47.5 }));

    expect(await applyCoachObjective(rowId, 50)).toBe(1);
    expect((await db.workoutSets.get('s0'))?.weight).toBe(50);
  });

  it('never rewrites a set already validated', async () => {
    const rowId = await seedRow();
    await db.workoutSets.bulkAdd([
      set('done', 0, { weight: 47.5, isCompleted: 1, performedAt: Date.UTC(2026, 7, 12, 10) }),
      set('todo', 1, { weight: 47.5 }),
    ]);

    expect(await applyCoachObjective(rowId, 50)).toBe(1);
    expect((await db.workoutSets.get('done'))?.weight).toBe(47.5);
    expect((await db.workoutSets.get('todo'))?.weight).toBe(50);
  });

  it('applies to an assistance machine, where progress means less weight', async () => {
    const rowId = await seedRow('assisted_weight_reps');
    await db.workoutSets.add(set('s0', 0, { weight: 50 }));

    expect(await applyCoachObjective(rowId, 45)).toBe(1);
    expect((await db.workoutSets.get('s0'))?.weight).toBe(45);
  });

  it('does nothing on an exercise with no weight field', async () => {
    const rowId = await seedRow('time_only');
    await db.workoutSets.add(set('s0', 0, {}));

    expect(await applyCoachObjective(rowId, 50)).toBe(0);
    expect((await db.workoutSets.get('s0'))?.targetWeight).toBeUndefined();
  });

  it('ignores a load that is not a usable number', async () => {
    const rowId = await seedRow();
    await db.workoutSets.add(set('s0', 0, {}));

    expect(await applyCoachObjective(rowId, Number.NaN)).toBe(0);
    expect((await db.workoutSets.get('s0'))?.targetWeight).toBeUndefined();
  });
});

describe('applyCoachObjective — séries de travail seulement', () => {
  beforeEach(async () => {
    await resetDb();
    await db.exercises.add(bench);
  });

  it('laisse les échauffements et les dégressives, écrit les séries normales', async () => {
    const rowId = await seedRow();
    await db.workoutSets.bulkAdd([
      set('w1', 0, { setType: 'warmup', weight: 20 }),
      set('w2', 1, { setType: 'warmup', weight: 40 }),
      set('n1', 2, { weight: 50 }),
      set('n2', 3, { weight: 50 }),
      set('d1', 4, { setType: 'dropset', weight: 35 }),
    ]);

    expect(await applyCoachObjective(rowId, 52.5)).toBe(2);
    expect((await db.workoutSets.get('w1'))?.weight).toBe(20);
    expect((await db.workoutSets.get('w2'))?.weight).toBe(40);
    expect((await db.workoutSets.get('n1'))?.weight).toBe(52.5);
    expect((await db.workoutSets.get('n2'))?.weight).toBe(52.5);
    expect((await db.workoutSets.get('d1'))?.weight).toBe(35);
  });
});

describe('applyCoachRecommendation', () => {
  beforeEach(async () => {
    await resetDb();
    await db.exercises.add(bench);
  });

  async function seedRecommendation(
    fields: Partial<CoachRecommendation> = {},
  ): Promise<string> {
    const rec: CoachRecommendation = {
      ...newEntity<CoachRecommendation>({
        exerciseId: bench.id,
        code: 'range_ceiling_reached',
        recommendedAt: Date.UTC(2026, 7, 10),
        nextLoadKg: 52.5,
        evidence: [],
        status: 'pending',
        ...fields,
      }),
      id: 'rec',
    };
    await db.coachRecommendations.add(rec);
    return rec.id;
  }

  async function seedSecondRow(): Promise<void> {
    await db.workoutExercises.add({
      ...newEntity<WorkoutExercise>({
        workoutId: 'live',
        exerciseId: bench.id,
        order: 1,
        supersetGroup: 0,
        restSeconds: 120,
        exerciseName: bench.name,
        exerciseMeasurementType: 'weight_reps',
        exerciseEquipment: bench.equipment,
      }),
      id: 'live-row-2',
    });
  }

  it('écrit sur toutes les lignes de l’exercice et passe la recommandation en suivie', async () => {
    await seedRow();
    await seedSecondRow();
    const recId = await seedRecommendation();
    await db.workoutSets.bulkAdd([
      set('a', 0, { weight: 50 }),
      { ...set('b', 0, { weight: 50 }), workoutExerciseId: 'live-row-2' },
    ]);

    expect(await applyCoachRecommendation(recId, 'live')).toBe(2);
    expect((await db.workoutSets.get('a'))?.weight).toBe(52.5);
    expect((await db.workoutSets.get('b'))?.weight).toBe(52.5);
    const rec = await db.coachRecommendations.get(recId);
    expect(rec).toMatchObject({
      status: 'followed',
      outcomeWorkoutId: 'live',
      outcomeLoadKg: 52.5,
    });
    expect(rec?.resolvedAt).toBeGreaterThan(0);
  });

  it('n’écrit rien et laisse la carte en attente si toutes les séries de travail sont validées', async () => {
    await seedRow();
    const recId = await seedRecommendation();
    await db.workoutSets.bulkAdd([
      set('a', 0, { weight: 50, isCompleted: 1, performedAt: 1 }),
      set('b', 1, { weight: 50, isCompleted: 1, performedAt: 2 }),
    ]);

    expect(await applyCoachRecommendation(recId, 'live')).toBe(0);
    expect((await db.workoutSets.get('a'))?.weight).toBe(50);
    expect((await db.coachRecommendations.get(recId))?.status).toBe('pending');
  });

  it('ne suit pas la recommandation quand il ne reste que des échauffements non validés', async () => {
    await seedRow();
    const recId = await seedRecommendation();
    await db.workoutSets.bulkAdd([
      set('w1', 0, { setType: 'warmup', weight: 20 }),
      set('w2', 1, { setType: 'warmup', weight: 40 }),
      set('d1', 2, { setType: 'dropset', weight: 35 }),
    ]);

    expect(await applyCoachRecommendation(recId, 'live')).toBe(0);
    expect((await db.workoutSets.get('w1'))?.weight).toBe(20);
    expect((await db.workoutSets.get('w2'))?.weight).toBe(40);
    expect((await db.coachRecommendations.get(recId))?.status).toBe('pending');
  });

  it('ne fait rien quand la recommandation est déjà refusée', async () => {
    await seedRow();
    const recId = await seedRecommendation({ status: 'dismissed', resolvedAt: 5 });
    await db.workoutSets.add(set('a', 0, { weight: 50 }));

    expect(await applyCoachRecommendation(recId, 'live')).toBe(0);
    expect((await db.workoutSets.get('a'))?.weight).toBe(50);
    expect((await db.coachRecommendations.get(recId))?.status).toBe('dismissed');
  });
});
