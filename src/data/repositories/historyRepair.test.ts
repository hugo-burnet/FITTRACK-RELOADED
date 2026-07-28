import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import type { Exercise, Syncable, Workout, WorkoutExercise } from '@/data/types';
import { resetDb } from '@/test/resetDb';
import { newEntity } from './base';
import { resnapshotHistory } from './historyRepair';

const exercise = (over: Partial<Omit<Exercise, keyof Syncable>> = {}): Exercise =>
  newEntity<Exercise>({
    name: 'Développé couché',
    primaryMuscle: 'chest',
    secondaryMuscles: [],
    equipment: 'barbell',
    measurementType: 'weight_reps',
    isCustom: 0,
    isUnilateral: 0,
    ...over,
  });

const workout = (): Workout =>
  newEntity<Workout>({
    routineId: '',
    name: 'Séance',
    status: 'completed',
    startedAt: 1_000,
    endedAt: 2_000,
    durationSeconds: 1_000,
  });

const row = (
  workoutId: string,
  exerciseId: string,
  over: Partial<Omit<WorkoutExercise, keyof Syncable>> = {},
): WorkoutExercise =>
  newEntity<WorkoutExercise>({
    workoutId,
    exerciseId,
    order: 0,
    supersetGroup: 0,
    restSeconds: 120,
    ...over,
  });

describe('resnapshotHistory', () => {
  beforeEach(resetDb);

  it('réécrit l’instantané avec la bibliothèque d’aujourd’hui', async () => {
    const bench = exercise({ primaryMuscle: 'chest' });
    const session = workout();
    await db.exercises.add(bench);
    await db.workouts.add(session);
    // L’instantané gelé se contredit EXPRÈS avec la bibliothèque : deux valeurs
    // concordantes ne pourraient pas dire laquelle a gagné.
    await db.workoutExercises.add(
      row(session.id, bench.id, {
        exerciseName: 'Ancien nom',
        exercisePrimaryMuscle: 'abs',
        exerciseMeasurementType: 'time_only',
      }),
    );

    const result = await resnapshotHistory();

    const [updated] = await db.workoutExercises.toArray();
    expect(updated!.exercisePrimaryMuscle).toBe('chest');
    expect(updated!.exerciseName).toBe('Développé couché');
    expect(updated!.exerciseMeasurementType).toBe('weight_reps');
    expect(result).toEqual({ repaired: 1, kept: 0 });
  });

  it('n’efface jamais un instantané quand l’exercice a disparu', async () => {
    // `snapshotOf(undefined)` rend `{}`. Écrit tel quel, il détruirait la seule
    // trace de ce que la ligne était — une réparation qui perd des données.
    const session = workout();
    await db.workouts.add(session);
    await db.workoutExercises.add(
      row(session.id, 'exercice-fantome', {
        exerciseName: 'Machine de la vieille salle',
        exercisePrimaryMuscle: 'quads',
      }),
    );

    const result = await resnapshotHistory();

    const [kept] = await db.workoutExercises.toArray();
    expect(kept!.exerciseName).toBe('Machine de la vieille salle');
    expect(kept!.exercisePrimaryMuscle).toBe('quads');
    expect(result).toEqual({ repaired: 0, kept: 1 });
  });

  it('lit aussi les exercices supprimés, parce que la suppression est douce', async () => {
    // `deleteExercise` est un soft delete : un exercice supprimé est encore
    // l’exercice qui a été pratiqué, et il porte encore ses métadonnées.
    const removed = exercise({ name: 'Exercice supprimé', primaryMuscle: 'calves' });
    const session = workout();
    await db.exercises.add({ ...removed, deletedAt: 5_000 });
    await db.workouts.add(session);
    await db.workoutExercises.add(row(session.id, removed.id, { exercisePrimaryMuscle: 'abs' }));

    await resnapshotHistory();

    const [updated] = await db.workoutExercises.toArray();
    expect(updated!.exercisePrimaryMuscle).toBe('calves');
  });

  it('marque la ligne comme modifiée, parce qu’elle l’est vraiment', async () => {
    // ADR-002 : la synchronisation future diffe sur `updatedAt`. Une ligne
    // réécrite qui garde son ancien horodatage ne partirait jamais.
    const bench = exercise();
    const session = workout();
    await db.exercises.add(bench);
    await db.workouts.add(session);
    const before = row(session.id, bench.id, { exercisePrimaryMuscle: 'abs' });
    await db.workoutExercises.add({ ...before, updatedAt: 1 });

    await resnapshotHistory();

    const [updated] = await db.workoutExercises.toArray();
    expect(updated!.updatedAt).toBeGreaterThan(1);
  });

  it('ne touche pas une ligne déjà juste', async () => {
    const bench = exercise();
    const session = workout();
    await db.exercises.add(bench);
    await db.workouts.add(session);
    const already = row(session.id, bench.id, {
      exerciseName: bench.name,
      exercisePrimaryMuscle: bench.primaryMuscle,
      exerciseMeasurementType: bench.measurementType,
      exerciseEquipment: bench.equipment,
    });
    await db.workoutExercises.add({ ...already, updatedAt: 42 });

    const result = await resnapshotHistory();

    const [untouched] = await db.workoutExercises.toArray();
    expect(untouched!.updatedAt).toBe(42);
    expect(result).toEqual({ repaired: 0, kept: 1 });
  });
});
