import { db } from '@/data/db';
import type {
  ProgramLoadIndex,
  ProgramPhase,
  RoutineSet,
  Workout,
} from '@/data/types';
import {
  programPosition,
  projectProgramPrescription,
  resolveSchedule,
} from '@/lib/programs';
import { alive } from './base';
import { ProgramRepositoryError } from './programLifecycle';
import {
  assertNoActiveWorkout,
  buildWorkoutEntities,
  insertWorkoutEntities,
  ProgramWorkoutError,
  readWorkoutRoutineSource,
  type ProgramWorkoutErrorCode,
  type WorkoutRoutineSource,
  type WorkoutTargetSnapshot,
} from './workoutLifecycle';

export { ProgramWorkoutError };
export type { ProgramWorkoutErrorCode };

export interface StartWorkoutFromProgramInput {
  programId: string;
  programScheduleEntryId: string;
  at?: number;
}

export interface StartWorkoutFromProgramResult {
  workout: Workout;
}

export interface ProgramWorkoutPreflightContext {
  programId: string;
  programWeekIndex: number;
  programScheduleRevisionId: string;
  programScheduleEntryId: string;
  routineId: string;
  routineName: string;
  phase: ProgramPhase;
  loadIndex: ProgramLoadIndex;
  programIsDeload: 0 | 1;
}

export interface ProgramWorkoutPreflight {
  context: ProgramWorkoutPreflightContext;
}

interface ProgramWorkoutPlan {
  source: WorkoutRoutineSource;
  context: ProgramWorkoutPreflightContext;
  week: {
    phase: ProgramPhase;
    loadIndex: ProgramLoadIndex;
  };
  targetsByRoutineSetId: Map<string, WorkoutTargetSnapshot>;
}

async function resolveProgramWorkoutPlan(
  input: Pick<StartWorkoutFromProgramInput, 'programId' | 'programScheduleEntryId'>,
  startedAt: number,
): Promise<ProgramWorkoutPlan> {
  const program = await db.programs.get(input.programId);
  if (program === undefined || program.deletedAt !== 0) {
    throw new ProgramRepositoryError('program_not_found');
  }
  if (program.status !== 'active') throw new ProgramRepositoryError('program_invalid');

  const position = programPosition(program.startsAt, program.durationWeeks, startedAt);
  if (position.phase !== 'active') throw new ProgramRepositoryError('program_invalid');

  const week = alive(
    await db.programWeeks
      .where('[programId+weekIndex]')
      .equals([program.id, position.weekIndex])
      .toArray(),
  )[0];
  if (week === undefined) throw new ProgramRepositoryError('program_invalid');

  const revisions = alive(
    await db.programScheduleRevisions.where('programId').equals(program.id).toArray(),
  );
  const revisionIds = revisions.map((revision) => revision.id);
  const entries =
    revisionIds.length === 0
      ? []
      : alive(await db.programScheduleEntries.where('revisionId').anyOf(revisionIds).toArray());
  const effectiveEntry = resolveSchedule(revisions, entries, position.weekIndex).find(
    (entry) => entry.id === input.programScheduleEntryId,
  );
  if (effectiveEntry === undefined) throw new ProgramRepositoryError('program_invalid');

  const source = await readWorkoutRoutineSource(effectiveEntry.routineId);
  if (source === null) throw new ProgramRepositoryError('routine_missing');
  const prescriptionExercises = source.rows.map((row) => {
    const exercise = source.exercisesById.get(row.exerciseId);
    if (exercise === undefined || exercise.deletedAt !== 0) {
      throw new ProgramRepositoryError('routine_missing');
    }
    return {
      exercise,
      sets: source.plannedSets.filter(
        (set: RoutineSet) => set.routineExerciseId === row.id,
      ),
    };
  });

  const projection = projectProgramPrescription({
    week,
    exercises: prescriptionExercises,
  });
  const context: ProgramWorkoutPreflightContext = {
    programId: program.id,
    programWeekIndex: position.weekIndex,
    programScheduleRevisionId: effectiveEntry.revisionId,
    programScheduleEntryId: effectiveEntry.id,
    routineId: source.routine.id,
    routineName: source.routine.name,
    phase: week.phase,
    loadIndex: week.loadIndex,
    programIsDeload: week.phase === 'deload' ? 1 : 0,
  };
  return {
    source,
    context,
    week,
    targetsByRoutineSetId: new Map<string, WorkoutTargetSnapshot>(
      projection.sets.map((set) => [set.routineSetId, set]),
    ),
  };
}

/** Pure read: resolve the programmed session without inserting a workout. */
export async function preflightProgramWorkout(
  input: Pick<StartWorkoutFromProgramInput, 'programId' | 'programScheduleEntryId' | 'at'>,
): Promise<ProgramWorkoutPreflight> {
  const startedAt = input.at ?? Date.now();
  return db.transaction(
    'r',
    [
      db.programs,
      db.programWeeks,
      db.programScheduleRevisions,
      db.programScheduleEntries,
      db.routines,
      db.routineExercises,
      db.routineSets,
      db.exercises,
      db.workouts,
    ],
    async () => {
      await assertNoActiveWorkout();
      const plan = await resolveProgramWorkoutPlan(input, startedAt);
      return { context: plan.context };
    },
  );
}

/** Resolves and snapshots a programmed session in one read/write transaction. */
export async function startWorkoutFromProgram(
  input: StartWorkoutFromProgramInput,
): Promise<StartWorkoutFromProgramResult> {
  const startedAt = input.at ?? Date.now();

  return db.transaction(
    'rw',
    [
      db.programs,
      db.programWeeks,
      db.programScheduleRevisions,
      db.programScheduleEntries,
      db.routines,
      db.routineExercises,
      db.routineSets,
      db.exercises,
      db.workouts,
      db.workoutExercises,
      db.workoutSets,
    ],
    async () => {
      await assertNoActiveWorkout();
      const plan = await resolveProgramWorkoutPlan(input, startedAt);
      const graph = buildWorkoutEntities({
        source: plan.source,
        startedAt,
        programContext: {
          programId: plan.context.programId,
          programWeekIndex: plan.context.programWeekIndex,
          programScheduleEntryId: plan.context.programScheduleEntryId,
          programPhase: plan.week.phase,
          programLoadIndex: plan.week.loadIndex,
          programIsDeload: plan.week.phase === 'deload' ? 1 : 0,
        },
        targetsByRoutineSetId: plan.targetsByRoutineSetId,
      });

      await insertWorkoutEntities(graph);
      return { workout: graph.workout };
    },
  );
}
