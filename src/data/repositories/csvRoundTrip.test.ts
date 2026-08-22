import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import type {
  Routine,
  RoutineExercise,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '@/data/types';
import {
  createExternalExerciseIdentityRegistry,
  type ExternalExerciseDecision,
  type ExternalExerciseObservation,
  type ExternalExerciseResolution,
} from '@/lib/externalExerciseIdentity';
import { parseHevyCsv, type HevyImportData } from '@/lib/hevyCsv';
import { resetDb } from '@/test/resetDb';
import { newEntity } from './base';
import { buildCsvExport } from './csvExport';
import { createCustomExercise } from './exercises';
import { getHomeDashboard } from './home';
import { importHevyWorkouts } from './hevyImport';
import {
  activateProgram,
  createProgramDraft,
  createScheduleRevision,
  replaceProgramWeeks,
} from './programs';
import {
  addExercisesToRoutine,
  createRoutine,
  updateRoutineSet,
} from './routines';
import { setRoutineFolderContext } from './settings';
import { completeSet } from './workoutSets';
import { finishWorkout } from './workoutLifecycle';
import { startWorkoutFromProgram } from './programWorkout';

/**
 * L'aller-retour : ce que l'app écrit, l'app le relit.
 *
 * C'est le test qui donne son sens à l'export — un fichier qu'on ne peut pas
 * réimporter n'est pas une sauvegarde, c'est un tableau. Il suit le scénario
 * réel : on exporte, **on vide la base**, on réimporte le fichier comme une
 * sauvegarde Hevy.
 */

const STARTED = new Date(2026, 6, 24, 15, 5).getTime();
const IMPORTED_AT = new Date(2026, 6, 27, 12).getTime();

/** Toutes les décisions de mappage prises d'office : la base est vide. */
async function restoreFrom(csv: string): Promise<void> {
  const parsed = parseHevyCsv(csv);
  if (!parsed.ok) {
    throw new Error(`CSV refusé: ${JSON.stringify(parsed.issues)}`);
  }
  await importHevyWorkouts(
    parsed.data,
    await resolutionCreatingEverything(parsed.data),
    IMPORTED_AT,
  );
}

async function resolutionCreatingEverything(
  data: HevyImportData,
): Promise<ExternalExerciseResolution> {
  const registry = createExternalExerciseIdentityRegistry(
    await db.exercises.toArray(),
    [],
    new Map(),
  );
  const observations: ExternalExerciseObservation[] = data.sourceExercises.map(
    (source) => ({
      source: 'hevy_csv',
      sourceTitle: source.sourceTitle,
      measurementType: source.measurementType,
      equipmentHint: source.equipment,
      sessionCount: 1,
      setCount: 1,
      examples: [],
    }),
  );
  const entries = registry.review(observations);
  const decisions = entries.map((entry): ExternalExerciseDecision => ({
    identityKey: entry.identityKey,
    kind: 'custom',
    exercise: {
      name: entry.observation.sourceTitle,
      primaryMuscle: 'other',
      secondaryMuscles: [],
      equipment: entry.observation.equipmentHint ?? 'other',
      measurementType: entry.observation.measurementType,
      isUnilateral: 0,
    },
  }));
  return registry.resolve(entries, decisions, IMPORTED_AT);
}

/**
 * Une séance complète et tordue à dessein : superset, échauffement, RPE,
 * unilatéral, repos non standard, notes, et une routine derrière.
 */
async function seedHistory(): Promise<void> {
  const press = await createCustomExercise({
    name: 'Presse à cuisses',
    primaryMuscle: 'quads',
    secondaryMuscles: [],
    equipment: 'machine',
    measurementType: 'weight_reps',
    isUnilateral: 1,
  });
  const curl = await createCustomExercise({
    name: 'Leg curl',
    primaryMuscle: 'hamstrings',
    secondaryMuscles: [],
    equipment: 'machine',
    measurementType: 'weight_reps',
    isUnilateral: 0,
  });

  const routine = newEntity<Routine>({ name: 'LOWER A', folderId: '', order: 0 });
  await db.routines.add(routine);
  await db.routineExercises.bulkAdd([
    newEntity<RoutineExercise>({
      routineId: routine.id,
      exerciseId: press.id,
      order: 0,
      supersetGroup: 1,
      restSeconds: 90,
    }),
    newEntity<RoutineExercise>({
      routineId: routine.id,
      exerciseId: curl.id,
      order: 1,
      supersetGroup: 1,
      restSeconds: 90,
    }),
  ]);

  const workout = newEntity<Workout>({
    routineId: routine.id,
    name: 'LOWER A',
    status: 'completed',
    startedAt: STARTED,
    endedAt: STARTED + 3_600_000,
    durationSeconds: 3600,
    notes: 'Genou "gauche", à surveiller',
    // Séance enregistrée à Paris alors que les tests tournent en UTC : l'export
    // écrit l'heure du fuseau de l'appareil, pas celle-ci, et c'est ce qui rend
    // l'instant identique après relecture (cf. `csvExport`).
    startedTimezoneOffsetMinutes: 120,
  });
  await db.workouts.add(workout);

  const rows = [press, curl].map((exercise, order) =>
    newEntity<WorkoutExercise>({
      workoutId: workout.id,
      exerciseId: exercise.id,
      order,
      supersetGroup: 1,
      restSeconds: 90,
      ...(order === 0 ? { notes: 'Siège en 4' } : {}),
      exerciseName: exercise.name,
      exerciseMeasurementType: exercise.measurementType,
      exercisePrimaryMuscle: exercise.primaryMuscle,
      exerciseEquipment: exercise.equipment,
    }),
  );
  await db.workoutExercises.bulkAdd(rows);

  await db.workoutSets.bulkAdd([
    newEntity<WorkoutSet>({
      workoutExerciseId: rows[0]!.id,
      exerciseId: press.id,
      workoutId: workout.id,
      order: 0,
      setType: 'warmup',
      side: 'both',
      weight: 40,
      reps: 10,
      isCompleted: 1,
      performedAt: STARTED + 60_000,
    }),
    newEntity<WorkoutSet>({
      workoutExerciseId: rows[0]!.id,
      exerciseId: press.id,
      workoutId: workout.id,
      order: 1,
      setType: 'normal',
      side: 'left',
      weight: 47.5,
      reps: 12,
      rpe: 8.5,
      isCompleted: 1,
      performedAt: STARTED + 120_000,
    }),
    // Jamais validée : elle n'a pas été soulevée, elle ne s'exporte pas.
    newEntity<WorkoutSet>({
      workoutExerciseId: rows[1]!.id,
      exerciseId: curl.id,
      workoutId: workout.id,
      order: 0,
      setType: 'normal',
      side: 'both',
      isCompleted: 0,
      performedAt: 0,
    }),
    newEntity<WorkoutSet>({
      workoutExerciseId: rows[1]!.id,
      exerciseId: curl.id,
      workoutId: workout.id,
      order: 1,
      setType: 'normal',
      side: 'both',
      weight: 25,
      reps: 12,
      isCompleted: 1,
      performedAt: STARTED + 300_000,
    }),
  ]);
}

describe('aller-retour export CSV → import', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('rend la séance, ses séries et sa routine après un vidage complet', async () => {
    await seedHistory();
    const csv = await buildCsvExport();

    await resetDb();
    await restoreFrom(csv);

    const workouts = await db.workouts.toArray();
    expect(workouts).toHaveLength(1);
    const restored = workouts[0]!;
    expect(restored).toMatchObject({
      name: 'LOWER A',
      status: 'completed',
      startedAt: STARTED,
      notes: 'Genou "gauche", à surveiller',
      durationSeconds: 3600,
    });

    const rows = await db.workoutExercises
      .where('workoutId')
      .equals(restored.id)
      .sortBy('order');
    expect(rows.map((row) => row.exerciseName ?? '')).toEqual([
      'Presse à cuisses',
      'Leg curl',
    ]);
    // Le repos et le superset traversent le fichier : ni l'un ni l'autre n'a de
    // colonne chez Hevy, les colonnes `fittrack_*` les portent.
    expect(rows.map((row) => row.restSeconds)).toEqual([90, 90]);
    expect(rows.map((row) => row.supersetGroup)).toEqual([1, 1]);
    expect(rows[0]?.notes).toBe('Siège en 4');

    const sets = await db.workoutSets
      .where('workoutExerciseId')
      .equals(rows[0]!.id)
      .sortBy('order');
    expect(
      sets.map((set) => ({
        setType: set.setType,
        side: set.side,
        weight: set.weight,
        reps: set.reps,
        rpe: set.rpe,
      })),
    ).toEqual([
      { setType: 'warmup', side: 'both', weight: 40, reps: 10, rpe: undefined },
      { setType: 'normal', side: 'left', weight: 47.5, reps: 12, rpe: 8.5 },
    ]);

    // La série jamais validée n'est pas revenue : elle n'a jamais eu lieu.
    const curlSets = await db.workoutSets
      .where('workoutExerciseId')
      .equals(rows[1]!.id)
      .toArray();
    expect(curlSets).toHaveLength(1);
    expect(curlSets[0]).toMatchObject({ weight: 25, reps: 12 });
  });

  it('reconstruit la routine avec son nom, son repos et son superset', async () => {
    await seedHistory();
    const csv = await buildCsvExport();

    await resetDb();
    await restoreFrom(csv);

    const routines = await db.routines.toArray();
    expect(routines).toHaveLength(1);
    expect(routines[0]?.name).toBe('LOWER A');

    const rows = await db.routineExercises
      .where('routineId')
      .equals(routines[0]!.id)
      .sortBy('order');
    expect(rows.map((row) => row.restSeconds)).toEqual([90, 90]);
    expect(rows.map((row) => row.supersetGroup)).toEqual([1, 1]);

    const sets = await db.routineSets
      .where('routineExerciseId')
      .equals(rows[0]!.id)
      .sortBy('order');
    expect(sets.map((set) => set.targetWeight)).toEqual([40, 47.5]);
  });

  it('rattache l’historique restauré à sa routine sur l’accueil', async () => {
    await seedHistory();
    const csv = await buildCsvExport();

    await resetDb();
    await restoreFrom(csv);

    const [restoredRoutine] = await db.routines.toArray();
    expect(restoredRoutine?.folderId).toBeTruthy();
    await setRoutineFolderContext({
      kind: 'folder',
      folderId: restoredRoutine!.folderId,
    });

    const dashboard = await getHomeDashboard();
    expect(dashboard.suggestedRoutine).toMatchObject({
      name: 'LOWER A',
      lastPerformedAt: STARTED,
    });
  });

  it('n’écrit pas la même séance deux fois si le fichier est importé deux fois', async () => {
    await seedHistory();
    const csv = await buildCsvExport();

    await resetDb();
    await restoreFrom(csv);
    await restoreFrom(csv);

    expect(await db.workouts.count()).toBe(1);
  });

  it('exporte un fichier lisible quand l’historique est vide', async () => {
    const csv = await buildCsvExport();

    const parsed = parseHevyCsv(csv);
    expect(parsed.ok).toBe(true);
    expect(parsed.ok && parsed.data.workoutCount).toBe(0);
  });

  it('exporte une séance née d’un programme du lot 17 et la relit', async () => {
    const press = await createCustomExercise({
      name: 'Développé couché',
      primaryMuscle: 'chest',
      secondaryMuscles: [],
      equipment: 'barbell',
      measurementType: 'weight_reps',
      isUnilateral: 0,
    });
    const routine = await createRoutine('Force');
    await addExercisesToRoutine(routine.id, [press.id]);
    const row = (await db.routineExercises.where('routineId').equals(routine.id).toArray())[0]!;
    const planned = (await db.routineSets.where('routineExerciseId').equals(row.id).toArray())[0]!;
    await updateRoutineSet(planned.id, { targetWeight: 80, targetReps: 5, targetRepsMax: 8 });

    const monday = new Date(2026, 7, 10, 12).getTime();
    const program = await createProgramDraft({
      name: 'Bloc force',
      startsAt: monday,
      durationWeeks: 4,
    });
    await replaceProgramWeeks(
      program.id,
      Array.from({ length: 4 }, (_, weekIndex) => ({
        weekIndex,
        loadIndex: 100,
        phase: 'construction' as const,
      })),
    );
    const revision = await createScheduleRevision(program.id, 0, [
      { routineId: routine.id, dayOfWeek: 1, order: 0 },
    ]);
    const entry = (
      await db.programScheduleEntries.where('revisionId').equals(revision.id).toArray()
    )[0]!;
    await activateProgram(program.id);

    const started = await startWorkoutFromProgram({
      programId: program.id,
      programScheduleEntryId: entry.id,
      at: monday,
    });
    const set = (await db.workoutSets.where('workoutId').equals(started.workout.id).toArray())[0]!;
    await completeSet(set.id, { weight: 80, reps: 5 });
    await finishWorkout(started.workout.id);

    const csv = await buildCsvExport();
    const parsed = parseHevyCsv(csv);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.workoutCount).toBe(1);
    expect(parsed.data.workouts[0]).toMatchObject({
      title: 'Force',
      routineName: 'Force',
    });
    expect(parsed.data.workouts[0]?.exercises[0]?.sets).toHaveLength(1);
  });
});
