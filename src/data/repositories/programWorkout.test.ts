import { createElement } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import type { Exercise, PersonalRecord, ProgramWeek, Workout, WorkoutSet } from '@/data/types';
import { WorkoutScreen } from '@/features/workout/WorkoutScreen';
import { resetDb } from '@/test/resetDb';
import { seedWorkout } from '@/test/factories';
import { newEntity } from './base';
import { recordCoachSignals } from './coachRecommendations';
import { createCustomExercise, updateExercise } from './exercises';
import {
  activateProgram,
  createProgramDraft,
  createScheduleRevision,
  replaceProgramWeeks,
} from './programs';
import {
  addExercisesToRoutine,
  addRoutineSet,
  createRoutine,
  updateRoutineSet,
} from './routines';
import { getWorkoutDetail } from './workouts';
import { startWorkoutFromProgram } from './programWorkout';

const MONDAY = new Date(2026, 7, 10, 12).getTime();
const WEEK = 7 * 86_400_000;

function at<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`élément ${index} absent`);
  return item;
}

const programWeeks = (
  overrides: Partial<Pick<ProgramWeek, 'prescriptionKind' | 'prescriptionValue' | 'isDeload'>> = {},
) =>
  Array.from({ length: 4 }, (_, weekIndex) => ({
    weekIndex,
    prescriptionKind: overrides.prescriptionKind ?? ('percent_1rm' as const),
    prescriptionValue: overrides.prescriptionValue ?? 75,
    isDeload: overrides.isDeload ?? (0 as const),
  }));

async function exercise(name: string, overrides: Partial<Exercise> = {}): Promise<Exercise> {
  return createCustomExercise({
    name,
    primaryMuscle: 'chest',
    secondaryMuscles: [],
    equipment: 'barbell',
    measurementType: 'weight_reps',
    isUnilateral: 0,
    ...overrides,
  });
}

async function routineWithExercise(name: string, movement: Exercise) {
  const routine = await createRoutine(name);
  await addExercisesToRoutine(routine.id, [movement.id]);
  const row = at(await db.routineExercises.where('routineId').equals(routine.id).toArray(), 0);
  const set = at(await db.routineSets.where('routineExerciseId').equals(row.id).toArray(), 0);
  return { routine, row, set };
}

async function readyProgram(input: {
  routineId: string;
  weeks?: ReturnType<typeof programWeeks>;
  effectiveFromWeekIndex?: number;
}) {
  const program = await createProgramDraft({ name: 'Force', startsAt: MONDAY, durationWeeks: 4 });
  await replaceProgramWeeks(program.id, input.weeks ?? programWeeks());
  const revision = await createScheduleRevision(
    program.id,
    input.effectiveFromWeekIndex ?? 0,
    [{ routineId: input.routineId, dayOfWeek: 1, order: 0 }],
  );
  const entry = at(
    await db.programScheduleEntries.where('revisionId').equals(revision.id).toArray(),
    0,
  );
  return { program, revision, entry };
}

async function addBestOneRepMax(exerciseId: string, value: number, achievedAt: number) {
  const source = await seedWorkout({ exerciseId, performedAt: achievedAt, sets: [[value, 1]] });
  await db.personalRecords.add(
    newEntity<PersonalRecord>({
      exerciseId,
      type: 'best_1rm',
      value,
      achievedAt,
      workoutId: source.id,
    }),
  );
}

describe('startWorkoutFromProgram', () => {
  beforeEach(resetDb);

  it('recalcule la semaine et utilise uniquement l’entrée de la révision effective', async () => {
    const firstMovement = await exercise('Développé couché');
    const secondMovement = await exercise('Développé incliné');
    const first = await routineWithExercise('Semaine 1', firstMovement);
    const second = await routineWithExercise('Semaine 2', secondMovement);
    const { program, entry: firstEntry } = await readyProgram({ routineId: first.routine.id });
    const secondRevision = await createScheduleRevision(program.id, 1, [
      { routineId: second.routine.id, dayOfWeek: 1, order: 0 },
    ]);
    const secondEntry = at(
      await db.programScheduleEntries.where('revisionId').equals(secondRevision.id).toArray(),
      0,
    );
    await activateProgram(program.id);

    await expect(
      startWorkoutFromProgram({
        programId: program.id,
        programScheduleEntryId: firstEntry.id,
        at: MONDAY + WEEK,
      }),
    ).rejects.toMatchObject({ code: 'program_invalid' });

    const { workout } = await startWorkoutFromProgram({
      programId: program.id,
      programScheduleEntryId: secondEntry.id,
      at: MONDAY + WEEK,
    });
    const detail = await getWorkoutDetail(workout.id);

    expect(workout).toMatchObject({
      routineId: second.routine.id,
      name: 'Semaine 2',
      programId: program.id,
      programWeekIndex: 1,
      programScheduleEntryId: secondEntry.id,
    });
    expect(detail?.exercises[0]?.row.exerciseId).toBe(secondMovement.id);
  });

  it('projette le meilleur 1RM courant, avertit les replis et préserve les échauffements', async () => {
    const bench = await exercise('Développé couché');
    const squat = await exercise('Squat');
    const routine = await createRoutine('Force A');
    await addExercisesToRoutine(routine.id, [bench.id, squat.id]);
    const rows = await db.routineExercises.where('routineId').equals(routine.id).sortBy('order');
    const benchWarmup = at(
      await db.routineSets.where('routineExerciseId').equals(at(rows, 0).id).toArray(),
      0,
    );
    await updateRoutineSet(benchWarmup.id, {
      setType: 'warmup',
      targetWeight: 40,
      targetReps: 8,
    });
    const benchWork = await addRoutineSet(at(rows, 0).id);
    await updateRoutineSet(benchWork.id, {
      setType: 'normal',
      targetWeight: 100,
      targetReps: 5,
    });
    const squatWork = at(
      await db.routineSets.where('routineExerciseId').equals(at(rows, 1).id).toArray(),
      0,
    );
    await updateRoutineSet(squatWork.id, { targetWeight: 60, targetReps: 6 });
    await addBestOneRepMax(bench.id, 100, MONDAY - WEEK * 2);
    await addBestOneRepMax(bench.id, 123, MONDAY - WEEK);
    const { program, entry } = await readyProgram({ routineId: routine.id });
    await activateProgram(program.id);

    const result = await startWorkoutFromProgram({
      programId: program.id,
      programScheduleEntryId: entry.id,
      at: MONDAY,
    });
    const detail = await getWorkoutDetail(result.workout.id);
    const benchSets = at(detail!.exercises, 0).sets;
    const squatSet = at(at(detail!.exercises, 1).sets, 0);

    expect(benchSets.map(({ targetWeight }) => targetWeight)).toEqual([40, 92.5]);
    expect(squatSet.targetWeight).toBe(60);
    expect(result.warnings).toEqual([{ code: 'missing_one_rep_max', exerciseId: squat.id }]);
    expect([...benchSets, squatSet].every((set) => set.weight === undefined)).toBe(true);
  });

  it('fige le RPE cible sans préremplir le RPE réalisé et marque la décharge', async () => {
    const bench = await exercise('Développé couché');
    const { routine, row, set: warmup } = await routineWithExercise('Décharge', bench);
    await updateRoutineSet(warmup.id, { setType: 'warmup', targetRpe: 5, targetWeight: 40 });
    const work = await addRoutineSet(row.id);
    await updateRoutineSet(work.id, { setType: 'normal', targetRpe: 7, targetWeight: 80 });
    const weeks = programWeeks({
      prescriptionKind: 'target_rpe',
      prescriptionValue: 8.5,
      isDeload: 1,
    });
    const { program, entry } = await readyProgram({ routineId: routine.id, weeks });
    await activateProgram(program.id);

    const { workout } = await startWorkoutFromProgram({
      programId: program.id,
      programScheduleEntryId: entry.id,
      at: MONDAY,
    });
    const sets = at((await getWorkoutDetail(workout.id))!.exercises, 0).sets;

    expect(workout.programIsDeload).toBe(1);
    expect(sets.map(({ targetRpe }) => targetRpe)).toEqual([5, 8.5]);
    expect(sets.every((set) => set.rpe === undefined)).toBe(true);
    expect(sets.map(({ targetWeight }) => targetWeight)).toEqual([40, 80]);
  });

  it('refuse atomiquement une collision avec une séance active', async () => {
    const bench = await exercise('Développé couché');
    const { routine } = await routineWithExercise('Force', bench);
    const { program, entry } = await readyProgram({ routineId: routine.id });
    await activateProgram(program.id);
    await db.workouts.add(
      newEntity<Workout>({
        routineId: '',
        name: 'Déjà active',
        status: 'active' as const,
        startedAt: MONDAY - 1,
        endedAt: 0,
        durationSeconds: 0,
      }),
    );
    const countsBefore = await Promise.all([
      db.workouts.count(),
      db.workoutExercises.count(),
      db.workoutSets.count(),
    ]);

    await expect(
      startWorkoutFromProgram({
        programId: program.id,
        programScheduleEntryId: entry.id,
        at: MONDAY,
      }),
    ).rejects.toMatchObject({ code: 'active_workout_exists' });

    expect(
      await Promise.all([db.workouts.count(), db.workoutExercises.count(), db.workoutSets.count()]),
    ).toEqual(countsBefore);
  });

  it('conserve ses snapshots après les modifications de la routine et de l’exercice', async () => {
    const bench = await exercise('Développé couché');
    const { routine, set } = await routineWithExercise('Force', bench);
    await updateRoutineSet(set.id, { targetWeight: 80, targetReps: 8 });
    const { program, entry } = await readyProgram({
      routineId: routine.id,
      weeks: programWeeks({ prescriptionKind: 'target_rpe', prescriptionValue: 8 }),
    });
    await activateProgram(program.id);
    const { workout } = await startWorkoutFromProgram({
      programId: program.id,
      programScheduleEntryId: entry.id,
      at: MONDAY,
    });

    await db.routines.update(routine.id, { name: 'Routine modifiée' });
    await db.routineSets.update(set.id, { targetWeight: 120, targetReps: 3, targetRpe: 10 });
    await updateExercise(bench.id, { name: 'Mouvement modifié', equipment: 'machine' });

    const detail = await getWorkoutDetail(workout.id);
    expect(detail?.workout.name).toBe('Force');
    expect(detail?.exercises[0]?.row).toMatchObject({
      exerciseName: 'Développé couché',
      exerciseEquipment: 'barbell',
    });
    expect(detail?.exercises[0]?.sets[0]).toMatchObject({
      targetWeight: 80,
      targetReps: 8,
      targetRpe: 8,
    } satisfies Partial<WorkoutSet>);
  });
});

describe('séance programmée en direct', () => {
  beforeEach(resetDb);

  it('montre le contexte et la cible RPE sans laisser le Coach proposer une charge', async () => {
    const bench = await exercise('Développé couché');
    const { routine } = await routineWithExercise('Décharge', bench);
    const { program, entry } = await readyProgram({
      routineId: routine.id,
      weeks: programWeeks({ prescriptionKind: 'target_rpe', prescriptionValue: 8, isDeload: 1 }),
    });
    await activateProgram(program.id);
    await startWorkoutFromProgram({
      programId: program.id,
      programScheduleEntryId: entry.id,
      at: MONDAY,
    });
    await recordCoachSignals([
      {
        exerciseId: bench.id,
        code: 'range_completed',
        severity: 1,
        nextLoadKg: 50,
        evidence: [{ label: 'next_load_kg', value: 50 }],
      },
    ]);
    const user = userEvent.setup();
    render(
      createElement(
        MemoryRouter,
        { initialEntries: ['/workout'] },
        createElement(
          Routes,
          null,
          createElement(Route, { path: '/workout', element: createElement(WorkoutScreen) }),
        ),
      ),
    );

    expect(await screen.findByText('Programme · Semaine 1')).toBeVisible();
    expect(screen.getByText('Décharge planifiée')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Appliquer 50 kg aux séries restantes' }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Série 1' }));
    expect(screen.getByText('Cible du programme · 8 / 10')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Effort perçu (RPE)' })).toHaveAccessibleDescription(
      'Non renseigné Cible du programme · 8 / 10',
    );
  });
});
