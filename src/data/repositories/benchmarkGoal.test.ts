import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { repeatSet, seedExercise, seedRoutine } from '@/test/routineSeed';
import { resetDb } from '@/test/resetDb';
import {
  applyBenchmarkProposals,
  loadBenchmarkReport,
  recordBenchmarkObjectives,
  startBenchmarkFromRoutine,
} from './benchmark';
import { getWorkoutDetail } from './workoutDetail';
import { finishWorkout } from './workoutLifecycle';
import { completeSet } from './workoutSets';

/**
 * Le style d'un benchmark — léger, classique, lourd — se choisit au lancement : sa fourchette remplace celle
 * de la routine pour dimensionner la charge, et la routine la reçoit avec elle quand on accepte le bilan.
 */

const POWER_SETS = repeatSet(3, { targetReps: 8, targetRepsMax: 12, targetWeight: 35 });

async function chestPress(sets = POWER_SETS) {
  // Une machine dont la personne a réglé le pas à 2,5 kg : c'est ainsi qu'elle charge 52,5.
  const press = await seedExercise({
    name: 'Chest press',
    equipment: 'machine',
    loadIncrementKg: 2.5,
  });
  const seeded = await seedRoutine('Pecs', [{ exercise: press, sets }]);
  return { press, ...seeded };
}

async function benchmarked(
  routineId: string,
  goal: 'light' | 'classic' | 'heavy' | undefined,
  result: [weight: number, reps: number],
) {
  const workout = await startBenchmarkFromRoutine(routineId, 'Benchmark', goal);
  const detail = (await getWorkoutDetail(workout.id))!;
  await completeSet(detail.exercises[0]!.sets[0]!.id, { weight: result[0], reps: result[1] });
  await finishWorkout(workout.id);
  return workout;
}

describe('le style d’un benchmark', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('se range sur la séance, et seulement quand on en a choisi un', async () => {
    const { routine } = await chestPress();

    const styled = await startBenchmarkFromRoutine(routine.id, 'Benchmark', 'light');
    expect((await db.workouts.get(styled.id))?.benchmarkGoal).toBe('light');
    await db.workouts.update(styled.id, { status: 'discarded', deletedAt: Date.now() });

    const plain = await startBenchmarkFromRoutine(routine.id, 'Benchmark');
    expect(await db.workouts.get(plain.id)).not.toHaveProperty('benchmarkGoal');
  });

  it('dimensionne la charge sur la fourchette du style : 40 × 18 en léger, 37,5 kg', async () => {
    const { routine } = await chestPress();
    const workout = await benchmarked(routine.id, 'light', [40, 18]);

    const report = (await loadBenchmarkReport(workout.id))!;

    expect(report.goal).toBe('light');
    expect(report.lines[0]).toMatchObject({
      goal: 'light',
      zone: { low: 15, high: 20 },
      plannedSets: 3,
      suggestedKg: 37.5,
      holdReps: [21, 19, 17],
      currentKg: 35,
    });
  });

  it('lit la fourchette de la routine quand on n’en a pas choisi', async () => {
    const { routine } = await chestPress();
    const workout = await benchmarked(routine.id, undefined, [40, 18]);

    const report = (await loadBenchmarkReport(workout.id))!;

    expect(report.goal).toBeUndefined();
    expect(report.lines[0]!.zone).toEqual({ low: 8, high: 12 });
    expect(report.lines[0]!.goal).toBeUndefined();
  });

  it('classique : 52,5 × 13 tient 52,5 kg sur trois séries de 8 – 12', async () => {
    const { routine } = await chestPress();
    const workout = await benchmarked(routine.id, 'classic', [52.5, 13]);

    const line = (await loadBenchmarkReport(workout.id))!.lines[0]!;

    expect(line).toMatchObject({ suggestedKg: 52.5, holdReps: [13, 11, 10] });
  });

  it('pose au coach la fourchette du style, pas celle de la routine', async () => {
    const { press, routine } = await chestPress();
    const workout = await benchmarked(routine.id, 'light', [40, 18]);

    const signals = await recordBenchmarkObjectives(workout.id);

    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({ exerciseId: press.id, nextLoadKg: 37.5 });
    expect(signals[0]!.evidence).toContainEqual({ label: 'target_reps', value: 15 });
    expect(signals[0]!.evidence).toContainEqual({ label: 'target_reps_max', value: 20 });
  });
});

describe('accepter un benchmark de style : la charge et la fourchette', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('écrit la charge et la fourchette du style sur les séries de travail, et pas sur l’échauffement', async () => {
    const { routine, sets } = await chestPress([
      { setType: 'warmup', targetReps: 10, targetWeight: 20 },
      ...POWER_SETS,
    ]);
    const workout = await benchmarked(routine.id, 'light', [40, 18]);
    const proposal = (await loadBenchmarkReport(workout.id))!.lines[0]!.proposal!;

    expect(await applyBenchmarkProposals([proposal], workout.id)).toBe(1);

    const [warmup, ...working] = (await db.routineSets.bulkGet(sets[0]!.map((set) => set.id))).map(
      (set) => set!,
    );
    expect(warmup).toMatchObject({ targetWeight: 20, targetReps: 10 });
    expect(warmup!.targetRepsMax).toBeUndefined();
    for (const set of working) {
      expect(set).toMatchObject({ targetWeight: 37.5, targetReps: 15, targetRepsMax: 20 });
    }
  });

  it('laisse une dégressive à ses propres répétitions, mais la fait suivre en charge', async () => {
    const { routine, sets } = await chestPress([
      ...POWER_SETS,
      { setType: 'dropset', targetReps: 10, targetWeight: 25 },
    ]);
    const workout = await benchmarked(routine.id, 'light', [40, 18]);
    const proposal = (await loadBenchmarkReport(workout.id))!.lines[0]!.proposal!;

    await applyBenchmarkProposals([proposal], workout.id);

    const drop = (await db.routineSets.get(sets[0]![3]!.id))!;
    expect(drop).toMatchObject({ targetWeight: 27.5, targetReps: 10 });
    expect(drop.targetRepsMax).toBeUndefined();
  });

  it('rend le bilan « déjà à jour » une fois la charge et la fourchette écrites', async () => {
    const { routine } = await chestPress();
    const workout = await benchmarked(routine.id, 'light', [40, 18]);
    const proposal = (await loadBenchmarkReport(workout.id))!.lines[0]!.proposal!;

    await applyBenchmarkProposals([proposal], workout.id);

    const line = (await loadBenchmarkReport(workout.id))!.lines[0]!;
    expect(line.aligned).toBe(true);
    expect(line.proposal).toBeUndefined();
  });

  it('écrit la fourchette seule quand la charge est déjà la bonne', async () => {
    const { routine, sets } = await chestPress(repeatSet(3, { targetReps: 8, targetRepsMax: 12, targetWeight: 37.5 }));
    const workout = await benchmarked(routine.id, 'light', [40, 18]);
    const proposal = (await loadBenchmarkReport(workout.id))!.lines[0]!.proposal!;
    expect(proposal.deltaKg).toBe(0);

    expect(await applyBenchmarkProposals([proposal], workout.id)).toBe(1);

    const set = (await db.routineSets.get(sets[0]![0]!.id))!;
    expect(set).toMatchObject({ targetWeight: 37.5, targetReps: 15, targetRepsMax: 20 });
  });

  it('écrit la fourchette du lourd : 5 – 8, et la charge qui la tient', async () => {
    const { routine, sets } = await chestPress();
    const workout = await benchmarked(routine.id, 'heavy', [100, 5]);
    const line = (await loadBenchmarkReport(workout.id))!.lines[0]!;
    expect(line).toMatchObject({ goal: 'heavy', suggestedKg: 90, holdReps: [8, 8, 7] });

    await applyBenchmarkProposals([line.proposal!], workout.id);

    expect(await db.routineSets.get(sets[0]![0]!.id)).toMatchObject({
      targetWeight: 90,
      targetReps: 5,
      targetRepsMax: 8,
    });
  });

  it('ne touche jamais à la fourchette d’une routine sans style', async () => {
    const { routine, sets } = await chestPress();
    const workout = await benchmarked(routine.id, undefined, [40, 18]);
    const proposal = (await loadBenchmarkReport(workout.id))!.lines[0]!.proposal!;

    await applyBenchmarkProposals([proposal], workout.id);

    expect(await db.routineSets.get(sets[0]![0]!.id)).toMatchObject({
      targetReps: 8,
      targetRepsMax: 12,
    });
  });

  it('n’écrit ni la charge ni la fourchette si la routine a changé depuis le bilan', async () => {
    const { routine, sets } = await chestPress();
    const workout = await benchmarked(routine.id, 'light', [40, 18]);
    const proposal = (await loadBenchmarkReport(workout.id))!.lines[0]!.proposal!;
    await db.routineSets.update(sets[0]![0]!.id, { targetWeight: 50 });

    expect(await applyBenchmarkProposals([proposal], workout.id)).toBe(0);

    expect(await db.routineSets.get(sets[0]![1]!.id)).toMatchObject({
      targetWeight: 35,
      targetReps: 8,
      targetRepsMax: 12,
    });
  });
});
