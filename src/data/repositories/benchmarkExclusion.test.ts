import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/data/db';
import type {
  CoachRecommendation,
  Exercise,
  Routine,
  RoutineExercise,
  RoutineSet,
  WorkoutExercise,
  WorkoutSet,
} from '@/data/types';
import { coachLinesFromBackup } from '@/lib/coach/backupLines';
import { day, seedWorkout } from '@/test/factories';
import { resetDb } from '@/test/resetDb';
import type { BackupFile } from '@/lib/backup/types';
import { newEntity } from './base';
import { evaluateCoachForWorkout, finalizeCoachForWorkout, loadCoachHistoryLines } from './coachEvaluate';
import { listRecommendationsForExercise } from './coachRecommendations';
import { getHomeDashboard } from './home';
import { loadRoutineTargetReview } from './routineTargetReview';
import { getWorkoutDetail } from './workoutDetail';
import { getLastPerformance } from './workoutHistory';
import { startWorkout } from './workoutLifecycle';
import { addWorkoutExercise } from './workoutExercises';

/**
 * Ce qu'un benchmark ne nourrit pas (spec benchmark, §2).
 *
 * Une série menée à l'échec est une vraie performance — les records, le volume
 * et l'historique la comptent — mais elle n'est pas le modèle d'une série de
 * travail. Tout ce qui *prescrit* l'écarte : sans cela, la séance suivante
 * proposerait « 14 × 80 kg » comme la série d'hier, le coach lirait une seule
 * série à l'échec comme une séance entière, et la revue des cibles la prendrait
 * pour une séance non tenue.
 */

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

beforeEach(async () => {
  await resetDb();
  await db.exercises.add(bench);
});

describe('les valeurs fantômes', () => {
  it('ne proposent pas un benchmark plus récent comme la série d’hier', async () => {
    await seedWorkout({ exerciseId: bench.id, performedAt: day(1), sets: [[60, 10], [60, 10]] });
    await seedWorkout({ exerciseId: bench.id, performedAt: day(5), sets: [[80, 14]], kind: 'benchmark' });

    const previous = await getLastPerformance(bench.id);

    expect(previous.map((set) => [set.weight, set.reps])).toEqual([[60, 10], [60, 10]]);
  });

  it('ne trouvent rien quand l’exercice n’a été fait qu’en benchmark', async () => {
    await seedWorkout({ exerciseId: bench.id, performedAt: day(5), sets: [[80, 14]], kind: 'benchmark' });

    expect(await getLastPerformance(bench.id)).toEqual([]);
  });

  it('remontent plus d’un benchmark d’affilée pour retrouver la dernière vraie séance', async () => {
    await seedWorkout({ exerciseId: bench.id, performedAt: day(1), sets: [[60, 10]] });
    for (const at of [3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
      await seedWorkout({ exerciseId: bench.id, performedAt: day(at), sets: [[80, 14]], kind: 'benchmark' });
    }

    expect((await getLastPerformance(bench.id)).map((set) => set.weight)).toEqual([60]);
  });

  it('restent celles de l’exercice quand la séance en cours en lit la référence', async () => {
    await seedWorkout({ exerciseId: bench.id, performedAt: day(1), sets: [[60, 10]] });
    await seedWorkout({ exerciseId: bench.id, performedAt: day(5), sets: [[80, 14]], kind: 'benchmark' });
    const current = await startWorkout('', 'Libre');
    await addWorkoutExercise(current.id, bench.id);

    const line = (await getWorkoutDetail(current.id))!.exercises[0]!;

    expect(line.previous.map((set) => set.weight)).toEqual([60]);
  });
});

describe('le coach', () => {
  it('ne lit pas un benchmark dans l’historique d’un exercice', async () => {
    await seedWorkout({ exerciseId: bench.id, performedAt: day(1), sets: [[60, 10]] });
    await seedWorkout({ exerciseId: bench.id, performedAt: day(5), sets: [[80, 14]], kind: 'benchmark' });

    const lines = await loadCoachHistoryLines([bench.id]);

    expect(lines).toHaveLength(1);
    expect(lines[0]!.workoutStartedAt).toBe(day(1));
  });

  it('n’évalue pas la séance d’un benchmark, ni ne l’enregistre', async () => {
    // Des séries de 5 à 12 : tenues en haut de fourchette, elles font proposer une hausse.
    const withRange = async (workoutId: string) =>
      db.workoutSets.where('workoutId').equals(workoutId).modify({ targetReps: 5, targetRepsMax: 12 });
    const sets: [number, number][] = [[60, 12], [60, 12], [60, 12]];
    await seedWorkout({ exerciseId: bench.id, performedAt: day(1), sets });
    const ordinary = await seedWorkout({ exerciseId: bench.id, performedAt: day(8), sets });
    await withRange(ordinary.id);
    // Le témoin : la même séance, ordinaire, donne bien un signal — sans cela
    // l'absence de signal du benchmark ne prouverait rien.
    expect((await evaluateCoachForWorkout(ordinary.id)).length).toBeGreaterThan(0);

    const benchmark = await seedWorkout({
      exerciseId: bench.id,
      performedAt: day(15),
      sets,
      kind: 'benchmark',
    });
    await withRange(benchmark.id);

    // Aucune évaluation de séance : pas de « fourchette tenue », pas de plafond, pas de hausse à proposer.
    expect(await evaluateCoachForWorkout(benchmark.id)).toEqual([]);
    // Le coach, lui, le *lit* : la seule chose qu'il en tire est l'objectif du benchmark, rien des règles de séance.
    const finalized = await finalizeCoachForWorkout(benchmark.id);
    expect(finalized.map((signal) => signal.code)).toEqual(['benchmark_calibrated']);
    const recorded = await listRecommendationsForExercise(bench.id);
    expect(
      recorded.filter((row) => row.sourceWorkoutId === benchmark.id).map((row) => row.code),
    ).toEqual(['benchmark_calibrated']);
  });

  it('ne prend pas la charge d’un benchmark pour un objectif suivi : il le remplace', async () => {
    const pending = newEntity<CoachRecommendation>({
      exerciseId: bench.id,
      code: 'range_ceiling_reached',
      recommendedAt: day(1),
      nextLoadKg: 80,
      evidence: [],
      status: 'pending',
    });
    await db.coachRecommendations.add(pending);
    const benchmark = await seedWorkout({
      exerciseId: bench.id,
      performedAt: day(5),
      sets: [[80, 9]],
      kind: 'benchmark',
    });

    await finalizeCoachForWorkout(benchmark.id);

    // Ni suivi — la charge d'un essai à fond n'est pas une réponse à l'objectif — ni laissé en place : le
    // coach vient de lire le benchmark et pose sa propre charge, « un objectif vivant à la fois ».
    expect((await db.coachRecommendations.get(pending.id))?.status).toBe('superseded');
  });

  it('ne rejoue pas un benchmark depuis une sauvegarde', async () => {
    await seedWorkout({ exerciseId: bench.id, performedAt: day(1), sets: [[60, 10]] });
    await seedWorkout({ exerciseId: bench.id, performedAt: day(5), sets: [[80, 14]], kind: 'benchmark' });
    const tables = Object.fromEntries(
      await Promise.all(
        (['workouts', 'workoutExercises', 'workoutSets', 'exercises'] as const).map(
          async (name) => [name, await db.table(name).toArray()] as const,
        ),
      ),
    );

    const lines = coachLinesFromBackup({ tables } as unknown as BackupFile);

    expect(lines).toHaveLength(1);
    expect(lines[0]!.workoutStartedAt).toBe(day(1));
  });
});

async function seedRoutine(): Promise<Routine> {
  const routine = newEntity<Routine>({ name: 'Push', folderId: '', order: 0 });
  await db.routines.add(routine);
  const row = newEntity<RoutineExercise>({
    routineId: routine.id,
    exerciseId: bench.id,
    order: 0,
    supersetGroup: 0,
    restSeconds: 0,
    notes: '',
  });
  await db.routineExercises.add(row);
  await db.routineSets.bulkAdd(
    [0, 1, 2].map((order) =>
      newEntity<RoutineSet>({
        routineExerciseId: row.id,
        order,
        setType: 'normal',
        targetReps: 8,
        targetRepsMax: 12,
        targetWeight: 57.5,
      }),
    ),
  );
  return routine;
}

describe('la revue des cibles', () => {
  it('ne prend pas un benchmark pour une séance de la routine', async () => {
    const routine = await seedRoutine();
    await seedWorkout({
      exerciseId: bench.id,
      routineId: routine.id,
      performedAt: day(5),
      sets: [[100, 14]],
      kind: 'benchmark',
    });

    const review = await loadRoutineTargetReview(routine.id);

    expect(review?.proposals).toEqual([]);
  });

  it('ne laisse pas un benchmark récent prendre la place de la vraie séance de référence', async () => {
    const routine = await seedRoutine();
    // Une séance libre : seule la fenêtre « historique de l'exercice » la connaît.
    await seedWorkout({
      exerciseId: bench.id,
      performedAt: day(5),
      sets: [[70, 12], [70, 12], [70, 12]],
    });
    await seedWorkout({
      exerciseId: bench.id,
      routineId: routine.id,
      performedAt: day(9),
      sets: [[100, 14]],
      kind: 'benchmark',
    });

    // Une seule séance de référence : si le benchmark la prenait, il ne resterait rien.
    const review = await loadRoutineTargetReview(routine.id, { referenceSessionCount: 1 });

    expect(review?.proposals).toHaveLength(1);
    expect(review?.proposals[0]).toMatchObject({ performedWeight: 70, proposedWeight: 70 });
  });

  it('ne laisse pas un benchmark de la routine cacher l’exercice qu’on y fait en plus', async () => {
    const routine = await seedRoutine();
    const curl = newEntity<Exercise>({
      name: 'Curl',
      primaryMuscle: 'biceps',
      secondaryMuscles: [],
      equipment: 'dumbbell',
      measurementType: 'weight_reps',
      isCustom: 0,
      isUnilateral: 0,
    });
    await db.exercises.add(curl);
    // Une vraie séance de la routine, où l'on a ajouté un curl que la routine n'a pas.
    const real = await seedWorkout({
      exerciseId: bench.id,
      routineId: routine.id,
      performedAt: day(5),
      sets: [[60, 10]],
    });
    const extra = newEntity<WorkoutExercise>({
      workoutId: real.id,
      exerciseId: curl.id,
      order: 1,
      supersetGroup: 0,
      restSeconds: 90,
    });
    await db.workoutExercises.add(extra);
    await db.workoutSets.add(
      newEntity<WorkoutSet>({
        workoutExerciseId: extra.id,
        exerciseId: curl.id,
        workoutId: real.id,
        order: 0,
        setType: 'normal',
        side: 'both',
        weight: 12,
        reps: 10,
        isCompleted: 1,
        performedAt: day(5),
      }),
    );
    await seedWorkout({
      exerciseId: bench.id,
      routineId: routine.id,
      performedAt: day(9),
      sets: [[100, 14]],
      kind: 'benchmark',
    });

    const review = await loadRoutineTargetReview(routine.id, { referenceSessionCount: 1 });

    expect(review?.missingExercises.map((line) => line.exerciseName)).toEqual(['Curl']);
  });
});

describe('la routine suggérée sur l’accueil', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(day(20));
  });
  afterEach(() => vi.restoreAllMocks());

  it('ne tourne pas parce qu’un benchmark de la routine a eu lieu', async () => {
    const push = newEntity<Routine>({ name: 'Push', folderId: '', order: 0 });
    const pull = newEntity<Routine>({ name: 'Pull', folderId: '', order: 1 });
    await db.routines.bulkAdd([push, pull]);
    // Push a été faite avant Pull : la suivante, c'est Push.
    await seedWorkout({ exerciseId: bench.id, routineId: push.id, performedAt: day(1), sets: [[60, 10]] });
    await seedWorkout({ exerciseId: bench.id, routineId: pull.id, performedAt: day(3), sets: [[60, 10]] });
    // Un benchmark de Push, plus récent : ce n'est pas une séance de Push.
    await seedWorkout({
      exerciseId: bench.id,
      routineId: push.id,
      performedAt: day(5),
      sets: [[80, 14]],
      kind: 'benchmark',
    });

    const dashboard = await getHomeDashboard();

    expect(dashboard.suggestedRoutine?.routineId).toBe(push.id);
    expect(dashboard.suggestedRoutine?.lastPerformedAt).toBe(day(1));
  });

  it('compte pourtant un benchmark comme un jour d’entraînement', async () => {
    await seedWorkout({ exerciseId: bench.id, performedAt: day(5), sets: [[80, 14]], kind: 'benchmark' });

    const dashboard = await getHomeDashboard();

    expect(dashboard.completedWorkoutTimestamps).toContain(day(5));
  });
});
