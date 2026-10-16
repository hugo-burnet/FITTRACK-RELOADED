import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import type { Exercise } from '@/data/types';
import { repeatSet, seedExercise, seedRoutine } from '@/test/routineSeed';
import { resetDb } from '@/test/resetDb';
import { loadBenchmarkReport, recordBenchmarkObjectives, startBenchmarkFromRoutine } from './benchmark';
import {
  getArchivedWorkoutDetail,
  saveArchivedWorkout,
  type ArchivedWorkoutDraft,
} from './history';
import { getWorkoutDetail } from './workoutDetail';
import {
  removeWorkoutExercise,
  reorderWorkoutExercises,
  replaceWorkoutExercise,
} from './workoutExercises';
import { finishWorkout } from './workoutLifecycle';
import { completeSet } from './workoutSets';

/**
 * Le bilan rapproche chaque exercice de la séance de sa ligne de routine. Ce rapprochement a tenu au
 * rang de la ligne — que la séance renumérote dès qu'on retire, déplace ou remplace un exercice, et que
 * l'édition de l'historique renumérote aussi. Il tient maintenant à l'identifiant de la ligne de routine,
 * posé au lancement.
 */

const BENCH_SETS = repeatSet(3, { targetReps: 8, targetRepsMax: 12, targetWeight: 70 });
const CURL_SETS = repeatSet(2, { targetReps: 15, targetRepsMax: 20, targetWeight: 30 });

/** Un exercice d'isolation à la poulie : la fatigue d'une isolation et le pas de 2,5 kg d'une poulie. */
const curlOver: Partial<Exercise> = {
  equipment: 'cable',
  primaryMuscle: 'biceps',
  secondaryMuscles: [],
  movementPattern: 'isolation_coude',
};

async function seedUpper() {
  const bench = await seedExercise({ name: 'Développé couché' });
  const curl = await seedExercise({ name: 'Curl poulie', ...curlOver });
  const seeded = await seedRoutine('Haut du corps', [
    { exercise: bench, sets: BENCH_SETS },
    { exercise: curl, sets: CURL_SETS },
  ]);
  return { bench, curl, ...seeded };
}

/** Valide une série par exercice (par identifiant d'exercice, pas par rang : la séance a pu bouger). */
async function perform(workoutId: string, results: Record<string, [weight: number, reps: number]>) {
  const detail = (await getWorkoutDetail(workoutId))!;
  for (const line of detail.exercises) {
    const result = results[line.row.exerciseId];
    if (result !== undefined) await completeSet(line.sets[0]!.id, { weight: result[0], reps: result[1] });
  }
  await finishWorkout(workoutId);
}

const lineOf = (report: NonNullable<Awaited<ReturnType<typeof loadBenchmarkReport>>>, name: string) =>
  report.lines.find((line) => line.exerciseName === name)!;

describe('le bilan quand la séance a bougé depuis le lancement', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('garde la ligne de routine d’un exercice qu’on remonte', async () => {
    const { bench, curl, routine, rows, sets } = await seedUpper();
    const workout = await startBenchmarkFromRoutine(routine.id, 'Benchmark');
    // La machine du développé est prise : le curl passe en premier.
    await reorderWorkoutExercises(workout.id, 1, 0);
    await perform(workout.id, { [curl.id]: [40, 12], [bench.id]: [80, 9] });

    const report = (await loadBenchmarkReport(workout.id))!;

    const curlLine = lineOf(report, 'Curl poulie');
    expect(curlLine.zone).toEqual({ low: 15, high: 20 });
    expect(curlLine.plannedSets).toBe(2);
    expect(curlLine.proposal?.routineExerciseId).toBe(rows[1]!.id);
    expect(curlLine.proposal?.targetSetIds).toEqual(sets[1]!.map((set) => set.id));
    const benchLine = lineOf(report, 'Développé couché');
    expect(benchLine.proposal?.routineExerciseId).toBe(rows[0]!.id);
    expect(benchLine.proposal?.targetSetIds).toEqual(sets[0]!.map((set) => set.id));
  });

  it('ne fait pas dire au coach le contraire de la routine quand on remonte un exercice', async () => {
    const { bench, curl, routine } = await seedUpper();
    const workout = await startBenchmarkFromRoutine(routine.id, 'Benchmark');
    await reorderWorkoutExercises(workout.id, 1, 0);
    await perform(workout.id, { [curl.id]: [40, 12], [bench.id]: [80, 9] });

    const signals = await recordBenchmarkObjectives(workout.id);

    // 40 × 12 est loin des 18 répétitions que ce 15 – 20 exige de la première série : estimation
    // approximative, donc pas d'objectif. Sans sa ligne, le curl se lisait en 8 – 12 et le coach
    // posait « démarre à 40 kg » — la charge d'un échec à 12, pour une fourchette de 15 à 20.
    expect(signals.map((signal) => signal.exerciseId)).toEqual([bench.id]);
  });

  it('garde les lignes des exercices qui suivent un exercice retiré', async () => {
    const squat = await seedExercise({ name: 'Squat', primaryMuscle: 'quads', movementPattern: 'squat' });
    const bench = await seedExercise({ name: 'Développé couché' });
    const curl = await seedExercise({ name: 'Curl poulie', ...curlOver });
    const { routine, rows } = await seedRoutine('Complète', [
      { exercise: squat, sets: repeatSet(3, { targetReps: 5, targetRepsMax: 5, targetWeight: 100 }) },
      { exercise: bench, sets: BENCH_SETS },
      { exercise: curl, sets: CURL_SETS },
    ]);
    const workout = await startBenchmarkFromRoutine(routine.id, 'Benchmark');
    const detail = (await getWorkoutDetail(workout.id))!;
    // « Pas de squat aujourd’hui » : on retire la ligne, les deux suivantes remontent d’un rang.
    await removeWorkoutExercise(detail.exercises[0]!.row.id);
    await perform(workout.id, { [bench.id]: [80, 9], [curl.id]: [40, 12] });

    const report = (await loadBenchmarkReport(workout.id))!;

    expect(lineOf(report, 'Développé couché').proposal?.routineExerciseId).toBe(rows[1]!.id);
    const curlLine = lineOf(report, 'Curl poulie');
    expect(curlLine.proposal?.routineExerciseId).toBe(rows[2]!.id);
    expect(curlLine.zone).toEqual({ low: 15, high: 20 });
  });

  it('ne croise pas les deux lignes d’un même exercice quand la séance les échange', async () => {
    const bench = await seedExercise({ name: 'Développé couché' });
    const { routine, rows } = await seedRoutine('Double', [
      { exercise: bench, sets: BENCH_SETS },
      { exercise: bench, sets: repeatSet(2, { targetReps: 15, targetRepsMax: 20, targetWeight: 50 }) },
    ]);
    const workout = await startBenchmarkFromRoutine(routine.id, 'Benchmark');
    await reorderWorkoutExercises(workout.id, 1, 0);
    const detail = (await getWorkoutDetail(workout.id))!;
    // La première ligne de la séance est maintenant celle du 15 – 20.
    await completeSet(detail.exercises[0]!.sets[0]!.id, { weight: 60, reps: 17 });
    await completeSet(detail.exercises[1]!.sets[0]!.id, { weight: 80, reps: 9 });
    await finishWorkout(workout.id);

    const [first, second] = (await loadBenchmarkReport(workout.id))!.lines;

    expect(first!.zone).toEqual({ low: 15, high: 20 });
    expect(first!.proposal?.routineExerciseId).toBe(rows[1]!.id);
    expect(second!.zone).toEqual({ low: 8, high: 12 });
    expect(second!.proposal?.routineExerciseId).toBe(rows[0]!.id);
  });

  it('garde ses lignes après une correction depuis l’historique, qui renumérote les rangs', async () => {
    const squat = await seedExercise({ name: 'Squat', primaryMuscle: 'quads', movementPattern: 'squat' });
    const bench = await seedExercise({ name: 'Développé couché' });
    const curl = await seedExercise({ name: 'Curl poulie', ...curlOver });
    const { routine, rows } = await seedRoutine('Complète', [
      { exercise: squat, sets: repeatSet(3, { targetReps: 5, targetRepsMax: 5, targetWeight: 100 }) },
      { exercise: bench, sets: BENCH_SETS },
      { exercise: curl, sets: CURL_SETS },
    ]);
    const workout = await startBenchmarkFromRoutine(routine.id, 'Benchmark');
    // Le squat n’est pas fait : sa ligne disparaît à l’enregistrement et laisse un trou dans les rangs.
    await perform(workout.id, { [bench.id]: [80, 9], [curl.id]: [40, 12] });

    const detail = (await getArchivedWorkoutDetail(workout.id))!;
    const draft: ArchivedWorkoutDraft = {
      workoutId: workout.id,
      name: detail.workout.name,
      startedAt: detail.workout.startedAt,
      durationSeconds: detail.workout.durationSeconds,
      exercises: detail.exercises.map((line) => ({
        id: line.row.id,
        exerciseId: line.row.exerciseId,
        supersetGroup: line.row.supersetGroup,
        restSeconds: line.row.restSeconds,
        sets: line.sets.map((set) => ({
          id: set.id,
          setType: set.setType,
          side: set.side,
          ...(set.weight === undefined ? {} : { weight: set.weight }),
          // Une correction de la saisie : le curl s’est arrêté à 13 et non à 12.
          ...(set.reps === undefined ? {} : { reps: set.reps === 12 ? 13 : set.reps }),
        })),
      })),
    };
    await saveArchivedWorkout(draft);

    const report = (await loadBenchmarkReport(workout.id))!;
    expect(lineOf(report, 'Développé couché').proposal?.routineExerciseId).toBe(rows[1]!.id);
    const curlLine = lineOf(report, 'Curl poulie');
    expect(curlLine.proposal?.routineExerciseId).toBe(rows[2]!.id);
    expect(curlLine.tested).toEqual({ weight: 40, reps: 13 });
  });

  it('ne prête pas la ligne de l’exercice d’origine à celui qui le remplace', async () => {
    const { bench, curl, routine } = await seedUpper();
    const pushdown = await seedExercise({ name: 'Extension poulie', ...curlOver, primaryMuscle: 'triceps' });
    const workout = await startBenchmarkFromRoutine(routine.id, 'Benchmark');
    const detail = (await getWorkoutDetail(workout.id))!;
    // Le curl est pris : la ligne devient une extension, sans série validée.
    expect(await replaceWorkoutExercise(detail.exercises[1]!.row.id, pushdown.id)).toBe('replaced');
    await perform(workout.id, { [bench.id]: [80, 9], [pushdown.id]: [30, 12] });

    const report = (await loadBenchmarkReport(workout.id))!;

    expect(lineOf(report, 'Extension poulie').proposal).toBeUndefined();
    expect(report.lines.some((line) => line.exerciseId === curl.id)).toBe(false);
    expect(lineOf(report, 'Développé couché').proposal).toBeDefined();
  });

  it('retombe sur le rang pour un benchmark lancé avant que le lien existe', async () => {
    const { bench, curl, routine, rows } = await seedUpper();
    const workout = await startBenchmarkFromRoutine(routine.id, 'Benchmark');
    await db.workoutExercises.toCollection().modify((row) => {
      delete row.routineExerciseId;
    });
    await perform(workout.id, { [bench.id]: [80, 9], [curl.id]: [40, 12] });

    const report = (await loadBenchmarkReport(workout.id))!;

    expect(lineOf(report, 'Développé couché').proposal?.routineExerciseId).toBe(rows[0]!.id);
    expect(lineOf(report, 'Curl poulie').proposal?.routineExerciseId).toBe(rows[1]!.id);
  });
});

describe('le bilan d’un benchmark que la routine a dépassé', () => {
  beforeEach(async () => {
    await resetDb();
  });

  /** Modifie une série de routine comme le ferait une édition : la date de modification suit. */
  async function editRoutineSet(setId: string, weight: number, after: number) {
    await db.routineSets.update(setId, { targetWeight: weight, updatedAt: after + 1 });
  }

  it('ne se dit pas périmé tant que la routine n’a pas bougé depuis', async () => {
    const { bench, curl, routine } = await seedUpper();
    const workout = await startBenchmarkFromRoutine(routine.id, 'Benchmark');
    await perform(workout.id, { [bench.id]: [80, 9], [curl.id]: [40, 12] });

    const report = (await loadBenchmarkReport(workout.id))!;

    expect(report.lines.some((line) => line.routineChanged === true)).toBe(false);
  });

  it('se dit périmé quand une série de sa ligne de routine a été modifiée après lui', async () => {
    const { bench, curl, routine, sets } = await seedUpper();
    const workout = await startBenchmarkFromRoutine(routine.id, 'Benchmark');
    await perform(workout.id, { [bench.id]: [80, 9], [curl.id]: [40, 12] });
    const { endedAt } = (await db.workouts.get(workout.id))!;
    // Des semaines plus tard, la routine a progressé : 70 → 90 kg.
    await editRoutineSet(sets[0]![1]!.id, 90, endedAt);

    const report = (await loadBenchmarkReport(workout.id))!;

    expect(lineOf(report, 'Développé couché').routineChanged).toBe(true);
    // Le curl, lui, n'a pas bougé : sa proposition date de la veille, pas d'avant-hier.
    expect(lineOf(report, 'Curl poulie').routineChanged).toBeUndefined();
  });

  it('ne se dit pas périmé pour une modification faite pendant la séance : le bilan la lit déjà', async () => {
    const { bench, curl, routine, sets } = await seedUpper();
    const workout = await startBenchmarkFromRoutine(routine.id, 'Benchmark');
    const { startedAt } = (await db.workouts.get(workout.id))!;
    await editRoutineSet(sets[0]![0]!.id, 75, startedAt);
    await perform(workout.id, { [bench.id]: [80, 9], [curl.id]: [40, 12] });

    const report = (await loadBenchmarkReport(workout.id))!;

    expect(lineOf(report, 'Développé couché').routineChanged).toBeUndefined();
  });
});
