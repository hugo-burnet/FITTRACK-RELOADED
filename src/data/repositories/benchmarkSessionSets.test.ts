import { beforeEach, describe, expect, it } from 'vitest';
import { repeatSet, seedExercise, seedRoutine } from '@/test/routineSeed';
import { resetDb } from '@/test/resetDb';
import { loadBenchmarkReport, recordBenchmarkObjectives, startBenchmarkFromRoutine } from './benchmark';
import { getWorkoutDetail } from './workoutDetail';
import { finishWorkout } from './workoutLifecycle';
import { addSet, completeSet } from './workoutSets';

/**
 * Ce que le bilan lit des séries de la séance. Une séance de benchmark est une séance comme une autre :
 * l'échauffement proposé avant la série à l'échec (« Ton échauffement de la dernière fois ») s'y valide
 * aussi, et n'est pas l'essai.
 */

const PRESS_SETS = repeatSet(3, { targetReps: 8, targetRepsMax: 12, targetWeight: 70 });

async function pressBenchmark() {
  const press = await seedExercise({ name: 'Développé couché' });
  const { routine } = await seedRoutine('Push', [{ exercise: press, sets: PRESS_SETS }]);
  const workout = await startBenchmarkFromRoutine(routine.id, 'Benchmark');
  const detail = (await getWorkoutDetail(workout.id))!;
  const row = detail.exercises[0]!;
  return { workout, rowId: row.row.id, failureSetId: row.sets[0]!.id };
}

describe('le bilan et les séries d’échauffement de la séance', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('ne prend pas un échauffement pour l’essai quand la série à l’échec n’a pas été faite', async () => {
    const { workout, rowId } = await pressBenchmark();
    const warmup = await addSet(rowId, { setType: 'warmup', weight: 60, reps: 8 });
    await completeSet(warmup.id);
    // La séance s'arrête là : la série à l'échec, jamais validée, disparaît à l'enregistrement.
    await finishWorkout(workout.id);

    const report = (await loadBenchmarkReport(workout.id))!;

    // 60 × 8 aurait fait « 52,5 kg à la place de 70 » : −17,5 kg dans la routine, et un objectif du coach.
    expect(report.lines[0]!.verdict).toBe('skipped');
    expect(await recordBenchmarkObjectives(workout.id)).toEqual([]);
  });

  it('garde la série à l’échec même quand un échauffement long a un max estimé plus haut', async () => {
    const { workout, rowId, failureSetId } = await pressBenchmark();
    const warmup = await addSet(rowId, { setType: 'warmup', weight: 60, reps: 20 });
    await completeSet(warmup.id);
    await completeSet(failureSetId, { weight: 80, reps: 7 });
    await finishWorkout(workout.id);

    const line = (await loadBenchmarkReport(workout.id))!.lines[0]!;

    // 60 × 20 fait 100 kg de max estimé, 80 × 7 fait 98,7 : c'est la seconde qui est l'essai.
    expect(line.tested).toEqual({ weight: 80, reps: 7 });
  });
});
