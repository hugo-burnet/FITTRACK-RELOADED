import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import type {
  CoachRecommendation,
  Exercise,
  Routine,
  RoutineExercise,
  RoutineSet,
  SetType,
} from '@/data/types';
import { resetDb } from '@/test/resetDb';
import { alive, newEntity } from './base';
import {
  applyBenchmarkProposals,
  loadBenchmarkReport,
  startBenchmarkFromRoutine,
} from './benchmark';
import { getWorkoutDetail } from './workoutDetail';
import {
  ProgramWorkoutError,
  finishWorkout,
  getActiveWorkout,
  startWorkout,
  startWorkoutFromRoutine,
} from './workoutLifecycle';
import { completeSet } from './workoutSets';

interface SetSpec {
  setType?: SetType;
  targetWeight?: number;
  targetReps?: number;
  targetRepsMax?: number;
  targetRpe?: number;
  targetDurationSeconds?: number;
}

async function seedExercise(partial: Partial<Exercise> & Pick<Exercise, 'name'>): Promise<Exercise> {
  const exercise = newEntity<Exercise>({
    primaryMuscle: 'chest',
    secondaryMuscles: [],
    equipment: 'barbell',
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
  lines: { exercise: Exercise; sets: SetSpec[] }[],
): Promise<{ routine: Routine; rows: RoutineExercise[]; sets: RoutineSet[][] }> {
  const routine = newEntity<Routine>({ name, folderId: '', order: 0 });
  await db.routines.add(routine);

  const rows: RoutineExercise[] = [];
  const sets: RoutineSet[][] = [];
  for (const [index, line] of lines.entries()) {
    const row = newEntity<RoutineExercise>({
      routineId: routine.id,
      exerciseId: line.exercise.id,
      order: index,
      supersetGroup: 0,
      restSeconds: 0,
      notes: '',
    });
    await db.routineExercises.add(row);
    const planned = line.sets.map((set, order) =>
      newEntity<RoutineSet>({
        routineExerciseId: row.id,
        order,
        setType: set.setType ?? 'normal',
        ...(set.targetReps === undefined ? {} : { targetReps: set.targetReps }),
        ...(set.targetRepsMax === undefined ? {} : { targetRepsMax: set.targetRepsMax }),
        ...(set.targetWeight === undefined ? {} : { targetWeight: set.targetWeight }),
        ...(set.targetRpe === undefined ? {} : { targetRpe: set.targetRpe }),
        ...(set.targetDurationSeconds === undefined
          ? {}
          : { targetDurationSeconds: set.targetDurationSeconds }),
      }),
    );
    if (planned.length > 0) await db.routineSets.bulkAdd(planned);
    rows.push(row);
    sets.push(planned);
  }
  return { routine, rows, sets };
}

const PRESS: SetSpec[] = [
  { setType: 'warmup', targetReps: 10, targetWeight: 40 },
  { targetReps: 8, targetRepsMax: 12, targetWeight: 70, targetRpe: 8 },
  { targetReps: 8, targetRepsMax: 12, targetWeight: 70 },
];

describe('startBenchmarkFromRoutine', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('lays out one set to failure per exercise, with nothing to aim at but the load', async () => {
    const press = await seedExercise({ name: 'Développé couché' });
    const squat = await seedExercise({ name: 'Squat', primaryMuscle: 'quads' });
    const { routine } = await seedRoutine('Push', [
      { exercise: press, sets: PRESS },
      { exercise: squat, sets: [{ targetReps: 5, targetRepsMax: 5, targetWeight: 100, targetRpe: 9 }] },
    ]);

    const workout = await startBenchmarkFromRoutine(routine.id, 'Benchmark · Push');

    expect(workout).toMatchObject({
      kind: 'benchmark',
      name: 'Benchmark · Push',
      status: 'active',
      routineId: routine.id,
    });
    const detail = (await getWorkoutDetail(workout.id))!;
    expect(detail.exercises.map((line) => line.row.exerciseId)).toEqual([press.id, squat.id]);
    expect(detail.exercises.map((line) => line.sets.length)).toEqual([1, 1]);

    const pressSet = detail.exercises[0]!.sets[0]!;
    // The first *working* set — not the warm-up — stands in for the whole block.
    expect(pressSet).toMatchObject({ setType: 'failure', order: 0, targetWeight: 70, isCompleted: 0 });
    expect(pressSet.targetReps).toBeUndefined();
    expect(pressSet.targetRepsMax).toBeUndefined();
    expect(pressSet.targetRpe).toBeUndefined();

    const squatSet = detail.exercises[1]!.sets[0]!;
    expect(squatSet).toMatchObject({ setType: 'failure', targetWeight: 100 });
    expect(squatSet.targetRpe).toBeUndefined();
  });

  it('gives an exercise that has no planned set one blank set to failure', async () => {
    const press = await seedExercise({ name: 'Développé couché' });
    const { routine } = await seedRoutine('Vide', [{ exercise: press, sets: [] }]);

    const workout = await startBenchmarkFromRoutine(routine.id, 'Benchmark');

    const sets = (await getWorkoutDetail(workout.id))!.exercises[0]!.sets;
    expect(sets).toHaveLength(1);
    expect(sets[0]).toMatchObject({ setType: 'failure', order: 0, isCompleted: 0 });
    expect(sets[0]!.targetWeight).toBeUndefined();
  });

  it('keeps an exercise that has only a warm-up, with no load borrowed from it', async () => {
    const press = await seedExercise({ name: 'Développé couché' });
    const { routine } = await seedRoutine('Échauffement seul', [
      { exercise: press, sets: [{ setType: 'warmup', targetReps: 10, targetWeight: 40 }] },
    ]);

    const workout = await startBenchmarkFromRoutine(routine.id, 'Benchmark');

    const sets = (await getWorkoutDetail(workout.id))!.exercises[0]!.sets;
    expect(sets).toHaveLength(1);
    expect(sets[0]).toMatchObject({ setType: 'failure' });
    expect(sets[0]!.targetWeight).toBeUndefined();
  });

  it('is resumed like any session: it is the active one', async () => {
    const press = await seedExercise({ name: 'Développé couché' });
    const { routine } = await seedRoutine('Push', [{ exercise: press, sets: PRESS }]);

    const workout = await startBenchmarkFromRoutine(routine.id, 'Benchmark');

    expect(await getActiveWorkout()).toMatchObject({ id: workout.id, kind: 'benchmark' });
  });

  it('refuses to start while another session is open', async () => {
    const press = await seedExercise({ name: 'Développé couché' });
    const { routine } = await seedRoutine('Push', [{ exercise: press, sets: PRESS }]);
    await startWorkout('', 'En cours');

    await expect(startBenchmarkFromRoutine(routine.id, 'Benchmark')).rejects.toBeInstanceOf(
      ProgramWorkoutError,
    );
  });

  it('refuses a routine that is gone, and a routine with nothing in it', async () => {
    await expect(startBenchmarkFromRoutine('missing', 'Benchmark')).rejects.toThrow();

    const { routine } = await seedRoutine('Rien', []);
    await expect(startBenchmarkFromRoutine(routine.id, 'Benchmark')).rejects.toThrow();
    expect(await getActiveWorkout()).toBeUndefined();
  });
});

describe('loadBenchmarkReport', () => {
  beforeEach(async () => {
    await resetDb();
  });

  async function benchmarkOf(routineId: string, results: [weight: number, reps: number][]) {
    const workout = await startBenchmarkFromRoutine(routineId, 'Benchmark · Push');
    const detail = (await getWorkoutDetail(workout.id))!;
    for (const [index, [weight, reps]] of results.entries()) {
      await completeSet(detail.exercises[index]!.sets[0]!.id, { weight, reps });
    }
    await finishWorkout(workout.id);
    return workout;
  }

  it('reads the max of each exercise and proposes the load of the routine', async () => {
    const press = await seedExercise({ name: 'Développé couché' });
    const { routine, sets } = await seedRoutine('Push', [{ exercise: press, sets: PRESS }]);
    const workout = await benchmarkOf(routine.id, [[80, 9]]);

    const report = (await loadBenchmarkReport(workout.id))!;

    expect(report.routineName).toBe('Push');
    expect(report.lines).toHaveLength(1);
    const line = report.lines[0]!;
    expect(line).toMatchObject({
      exerciseName: 'Développé couché',
      verdict: 'calibrated',
      tested: { weight: 80, reps: 9 },
      suggestedKg: 77.5,
      currentKg: 70,
    });
    // The two working sets, never the warm-up.
    expect(line.proposal?.targetSetIds).toEqual([sets[0]![1]!.id, sets[0]![2]!.id]);
    expect(line.proposal?.deltaKg).toBe(7.5);
  });

  it('is not a report for a session that is not a benchmark, nor for one that is gone', async () => {
    const press = await seedExercise({ name: 'Développé couché' });
    const { routine } = await seedRoutine('Push', [{ exercise: press, sets: PRESS }]);
    const ordinary = await startWorkoutFromRoutine(routine.id);

    expect(await loadBenchmarkReport(ordinary.id)).toBeNull();
    expect(await loadBenchmarkReport('missing')).toBeNull();
  });

  it('proposes nothing when the routine no longer has the exercise', async () => {
    const press = await seedExercise({ name: 'Développé couché' });
    const { routine, rows } = await seedRoutine('Push', [{ exercise: press, sets: PRESS }]);
    const workout = await benchmarkOf(routine.id, [[80, 9]]);
    await db.routineExercises.update(rows[0]!.id, { deletedAt: Date.now() });

    const line = (await loadBenchmarkReport(workout.id))!.lines[0]!;

    expect(line.verdict).toBe('calibrated');
    expect(line.suggestedKg).toBe(77.5);
    expect(line.proposal).toBeUndefined();
  });

  it('matches the exercise to its line by position, so the same exercise twice is not confused', async () => {
    const press = await seedExercise({ name: 'Développé couché' });
    const { routine, sets } = await seedRoutine('Push', [
      { exercise: press, sets: [{ targetReps: 8, targetWeight: 60 }] },
      { exercise: press, sets: [{ targetReps: 8, targetWeight: 50 }] },
    ]);
    const workout = await benchmarkOf(routine.id, [
      [80, 9],
      [60, 9],
    ]);

    const lines = (await loadBenchmarkReport(workout.id))!.lines;

    expect(lines[0]!.proposal?.targetSetIds).toEqual([sets[0]![0]!.id]);
    expect(lines[1]!.proposal?.targetSetIds).toEqual([sets[1]![0]!.id]);
  });

  it('still reads a benchmark whose routine was deleted', async () => {
    const press = await seedExercise({ name: 'Développé couché' });
    const { routine } = await seedRoutine('Push', [{ exercise: press, sets: PRESS }]);
    const workout = await benchmarkOf(routine.id, [[80, 9]]);
    await db.routines.update(routine.id, { deletedAt: Date.now() });

    const report = (await loadBenchmarkReport(workout.id))!;

    expect(report.routineName).toBeUndefined();
    expect(report.lines[0]!.verdict).toBe('calibrated');
    expect(report.lines[0]!.proposal).toBeUndefined();
  });

  it('lit la fourchette de la routine : un 15 – 20 se dimensionne sur 17 répétitions, pas sur 12', async () => {
    const curl = await seedExercise({ name: 'Curl poulie', equipment: 'cable' });
    const { routine } = await seedRoutine('Bras', [
      {
        exercise: curl,
        sets: [
          { targetReps: 15, targetRepsMax: 20, targetWeight: 35 },
          { targetReps: 15, targetRepsMax: 20, targetWeight: 35 },
        ],
      },
    ]);
    const workout = await benchmarkOf(routine.id, [[40, 22]]);

    const line = (await loadBenchmarkReport(workout.id))!.lines[0]!;

    expect(line.zone).toEqual({ low: 15, high: 20 });
    expect(line.referenceReps).toBe(17);
    expect(line.suggestedKg).toBe(42.5);
    expect(line.proposal?.deltaKg).toBe(7.5);
  });

  it('ne dépend pas de la formule d’affichage des réglages', async () => {
    const press = await seedExercise({ name: 'Développé couché' });
    const { routine } = await seedRoutine('Push', [{ exercise: press, sets: PRESS }]);
    const workout = await benchmarkOf(routine.id, [[80, 9]]);
    await db.settings.put({ key: 'oneRepMaxFormula', value: 'brzycki', updatedAt: Date.now() });

    const line = (await loadBenchmarkReport(workout.id))!.lines[0]!;

    // Epley, toujours : 80 × (1 + 9/30). Brzycki dirait 80 × 36 / 28 = 102,9.
    expect(line.oneRepMax).toBeCloseTo(104, 6);
  });
});

describe('applyBenchmarkProposals', () => {
  beforeEach(async () => {
    await resetDb();
  });

  async function calibratedPress() {
    const press = await seedExercise({ name: 'Développé couché' });
    const { routine, sets } = await seedRoutine('Push', [{ exercise: press, sets: PRESS }]);
    const workout = await startBenchmarkFromRoutine(routine.id, 'Benchmark');
    const detail = (await getWorkoutDetail(workout.id))!;
    await completeSet(detail.exercises[0]!.sets[0]!.id, { weight: 80, reps: 9 });
    await finishWorkout(workout.id);
    return { workout, sets: sets[0]!, exerciseId: press.id };
  }

  it('writes the calibrated load into the working sets and leaves the warm-up alone', async () => {
    const { workout, sets } = await calibratedPress();
    const proposal = (await loadBenchmarkReport(workout.id))!.lines[0]!.proposal!;

    // Un exercice réécrit — pas les deux séries qui le portent.
    expect(await applyBenchmarkProposals([proposal])).toBe(1);

    const stored = await db.routineSets.bulkGet(sets.map((set) => set.id));
    expect(stored.map((set) => set?.targetWeight)).toEqual([40, 77.5, 77.5]);
  });

  it('leaves the report saying so, and a second acceptance writes nothing', async () => {
    const { workout } = await calibratedPress();
    const proposal = (await loadBenchmarkReport(workout.id))!.lines[0]!.proposal!;
    await applyBenchmarkProposals([proposal]);

    const line = (await loadBenchmarkReport(workout.id))!.lines[0]!;

    expect(line.aligned).toBe(true);
    expect(line.proposal).toBeUndefined();
    expect(await applyBenchmarkProposals([proposal])).toBe(0);
  });

  it('does not move twice when the same acceptance arrives twice before the screen refreshes', async () => {
    const { workout, sets } = await calibratedPress();
    const proposal = (await loadBenchmarkReport(workout.id))!.lines[0]!.proposal!;

    await Promise.all([applyBenchmarkProposals([proposal]), applyBenchmarkProposals([proposal])]);

    const stored = await db.routineSets.bulkGet(sets.map((set) => set.id));
    expect(stored.map((set) => set?.targetWeight)).toEqual([40, 77.5, 77.5]);
  });

  it('does not write over a routine that was edited since the report was read', async () => {
    const { workout, sets } = await calibratedPress();
    const proposal = (await loadBenchmarkReport(workout.id))!.lines[0]!.proposal!;
    await db.routineSets.update(sets[1]!.id, { targetWeight: 72.5 });

    expect(await applyBenchmarkProposals([proposal])).toBe(0);

    const stored = await db.routineSets.bulkGet(sets.map((set) => set.id));
    expect(stored.map((set) => set?.targetWeight)).toEqual([40, 72.5, 70]);
  });

  describe('et l’objectif de charge que le coach avait posé', () => {
    const recommendation = (
      exerciseId: string,
      changes: Partial<CoachRecommendation> = {},
    ): CoachRecommendation =>
      newEntity<CoachRecommendation>({
        exerciseId,
        code: 'range_ceiling_reached',
        recommendedAt: 1,
        nextLoadKg: 72.5,
        evidence: [],
        status: 'pending',
        ...changes,
      });

    it('le remplace, sur cet exercice et sur lui seul', async () => {
      const { workout, exerciseId } = await calibratedPress();
      // Deux sources pour la même charge : la cible de la routine (77,5 kg) et « 72,5 kg » du coach,
      // affiché sur la carte de la séance tant qu'aucune séance ne l'a résolu.
      const objective = recommendation(exerciseId);
      const observation = recommendation(exerciseId, {
        code: 'plateau',
        recommendedAt: 0,
        nextLoadKg: undefined,
      });
      const elsewhere = recommendation('autre-exercice', { nextLoadKg: 50 });
      await db.coachRecommendations.bulkAdd([objective, observation, elsewhere]);
      const proposal = (await loadBenchmarkReport(workout.id))!.lines[0]!.proposal!;

      await applyBenchmarkProposals([proposal]);

      const status = async (row: CoachRecommendation) =>
        (await db.coachRecommendations.get(row.id))?.status;
      // « remplacé », pas « refusé » : le coach ne se souvient pas d'un refus qui n'en est pas un.
      expect(await status(objective)).toBe('superseded');
      expect((await db.coachRecommendations.get(objective.id))?.resolvedAt).toBeGreaterThan(0);
      // Une observation (pas de charge) reste vraie : le benchmark ne la contredit pas.
      expect(await status(observation)).toBe('pending');
      expect(await status(elsewhere)).toBe('pending');
    });

    it('le laisse en place quand rien n’a été écrit dans la routine', async () => {
      const { workout, sets, exerciseId } = await calibratedPress();
      const objective = recommendation(exerciseId);
      await db.coachRecommendations.add(objective);
      const proposal = (await loadBenchmarkReport(workout.id))!.lines[0]!.proposal!;
      // La routine a bougé depuis le bilan : la proposition ne s'applique pas.
      await db.routineSets.update(sets[1]!.id, { targetWeight: 72.5 });

      expect(await applyBenchmarkProposals([proposal])).toBe(0);

      expect((await db.coachRecommendations.get(objective.id))?.status).toBe('pending');
    });
  });

  it('writes nothing when the set the report was read from is gone', async () => {
    const { workout, sets } = await calibratedPress();
    const proposal = (await loadBenchmarkReport(workout.id))!.lines[0]!.proposal!;
    await db.routineSets.update(sets[1]!.id, { deletedAt: Date.now() });

    expect(await applyBenchmarkProposals([proposal])).toBe(0);

    expect((await db.routineSets.get(sets[2]!.id))?.targetWeight).toBe(70);
  });

  it('does not resurrect a set deleted while the report was open', async () => {
    const { workout, sets } = await calibratedPress();
    const proposal = (await loadBenchmarkReport(workout.id))!.lines[0]!.proposal!;
    await db.routineSets.update(sets[2]!.id, { deletedAt: Date.now() });

    expect(await applyBenchmarkProposals([proposal])).toBe(1);

    // `toArray` sort dans l'ordre des identifiants, pas des séries : on compare à l'ordre près.
    const weights = alive(await db.routineSets.toArray()).map((set) => set.targetWeight);
    expect(weights.sort()).toEqual([40, 77.5]);
  });
});
