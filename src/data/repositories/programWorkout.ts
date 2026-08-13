import { db } from '@/data/db';
import type {
  PersonalRecord,
  ProgramLoadIndex,
  ProgramPhase,
  RoutineSet,
  Workout,
} from '@/data/types';
import {
  programPosition,
  projectProgramPrescription,
  resolveSchedule,
  type ProgramPrescriptionWarning,
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
  warningAcknowledgement?: ProgramWorkoutWarningAcknowledgement;
}

export interface StartWorkoutFromProgramResult {
  workout: Workout;
  warnings: ProgramPrescriptionWarning[];
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

export interface ProgramWorkoutPreflightWarning extends ProgramPrescriptionWarning {
  exerciseName: string;
}

export interface ProgramWorkoutWarningAcknowledgement {
  context: ProgramWorkoutPreflightContext;
  warnings: ProgramWorkoutPreflightWarning[];
}

export interface ProgramWorkoutPreflight {
  context: ProgramWorkoutPreflightContext;
  warnings: ProgramWorkoutPreflightWarning[];
  warningAcknowledgement: ProgramWorkoutWarningAcknowledgement | null;
}

export class ProgramWorkoutWarningAcknowledgementError extends Error {
  readonly code = 'warning_acknowledgement_required' as const;

  constructor(readonly preflight: ProgramWorkoutPreflight) {
    super('warning_acknowledgement_required');
    this.name = 'ProgramWorkoutWarningAcknowledgementError';
  }
}

interface ProgramWorkoutPlan {
  source: WorkoutRoutineSource;
  context: ProgramWorkoutPreflightContext;
  week: {
    phase: ProgramPhase;
    loadIndex: ProgramLoadIndex;
  };
  targetsByRoutineSetId: Map<string, WorkoutTargetSnapshot>;
  projectionWarnings: ProgramPrescriptionWarning[];
  preflight: ProgramWorkoutPreflight;
}

function currentOneRepMaxByExerciseId(records: readonly PersonalRecord[]): Map<string, number> {
  const result = new Map<string, number>();
  for (const record of records) {
    if (
      record.deletedAt !== 0 ||
      record.type !== 'best_1rm' ||
      !Number.isFinite(record.value) ||
      record.value <= 0
    ) {
      continue;
    }
    const current = result.get(record.exerciseId);
    if (current === undefined || record.value > current) result.set(record.exerciseId, record.value);
  }
  return result;
}

const compareWarnings = (
  left: ProgramWorkoutPreflightWarning,
  right: ProgramWorkoutPreflightWarning,
): number =>
  left.exerciseId.localeCompare(right.exerciseId) ||
  left.code.localeCompare(right.code) ||
  left.exerciseName.localeCompare(right.exerciseName);

function acknowledgementFor(
  context: ProgramWorkoutPreflightContext,
  warnings: readonly ProgramWorkoutPreflightWarning[],
): ProgramWorkoutWarningAcknowledgement | null {
  if (warnings.length === 0) return null;
  return {
    context: { ...context },
    warnings: warnings.map((warning) => ({ ...warning })).sort(compareWarnings),
  };
}

function sameAcknowledgement(
  expected: ProgramWorkoutWarningAcknowledgement,
  received: ProgramWorkoutWarningAcknowledgement | undefined,
): boolean {
  if (received === undefined) return false;
  const contextKeys = Object.keys(expected.context) as (keyof ProgramWorkoutPreflightContext)[];
  if (contextKeys.some((key) => expected.context[key] !== received.context[key])) return false;
  if (received.warnings.length !== expected.warnings.length) return false;
  const receivedWarnings = [...received.warnings].sort(compareWarnings);
  return expected.warnings.every((warning, index) => {
    const receivedWarning = receivedWarnings[index];
    return (
      receivedWarning !== undefined &&
      warning.code === receivedWarning.code &&
      warning.exerciseId === receivedWarning.exerciseId &&
      warning.exerciseName === receivedWarning.exerciseName
    );
  });
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

  const exerciseIds = [...new Set(source.rows.map((row) => row.exerciseId))];
  const records =
    exerciseIds.length === 0
      ? []
      : await db.personalRecords.where('exerciseId').anyOf(exerciseIds).toArray();
  const projection = projectProgramPrescription({
    week,
    exercises: prescriptionExercises,
    oneRepMaxByExerciseId: currentOneRepMaxByExerciseId(records),
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
  const warnings = projection.warnings
    .map((warning) => ({
      ...warning,
      exerciseName: source.exercisesById.get(warning.exerciseId)?.name ?? warning.exerciseId,
    }))
    .sort(compareWarnings);
  const warningAcknowledgement = acknowledgementFor(context, warnings);

  return {
    source,
    context,
    week,
    targetsByRoutineSetId: new Map<string, WorkoutTargetSnapshot>(
      projection.sets.map((set) => [set.routineSetId, set]),
    ),
    projectionWarnings: projection.warnings,
    preflight: { context, warnings, warningAcknowledgement },
  };
}

/** Pure read used by UI to expose projection fallbacks before any workout exists. */
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
      db.personalRecords,
      db.workouts,
    ],
    async () => {
      await assertNoActiveWorkout();
      return (await resolveProgramWorkoutPlan(input, startedAt)).preflight;
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
      db.personalRecords,
      db.workouts,
      db.workoutExercises,
      db.workoutSets,
    ],
    async () => {
      await assertNoActiveWorkout();
      const plan = await resolveProgramWorkoutPlan(input, startedAt);
      const requiredAcknowledgement = plan.preflight.warningAcknowledgement;
      if (
        requiredAcknowledgement !== null &&
        !sameAcknowledgement(requiredAcknowledgement, input.warningAcknowledgement)
      ) {
        throw new ProgramWorkoutWarningAcknowledgementError(plan.preflight);
      }
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
      return { workout: graph.workout, warnings: plan.projectionWarnings };
    },
  );
}
