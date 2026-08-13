import { db } from '@/data/db';
import type { PersonalRecord, Workout } from '@/data/types';
import {
  programPosition,
  projectProgramPrescription,
  resolveSchedule,
  type ProgramPrescriptionWarning,
} from '@/lib/programs';
import { alive } from './base';
import { ProgramRepositoryError } from './programLifecycle';
import {
  buildWorkoutEntities,
  insertWorkoutEntities,
  readWorkoutRoutineSource,
  type WorkoutTargetSnapshot,
} from './workoutLifecycle';

export type ProgramWorkoutErrorCode = 'active_workout_exists';

export class ProgramWorkoutError extends Error {
  constructor(readonly code: ProgramWorkoutErrorCode) {
    super(code);
    this.name = 'ProgramWorkoutError';
  }
}

export interface StartWorkoutFromProgramInput {
  programId: string;
  programScheduleEntryId: string;
  at?: number;
}

export interface StartWorkoutFromProgramResult {
  workout: Workout;
  warnings: ProgramPrescriptionWarning[];
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
      const activeWorkout = alive(
        await db.workouts.where('status').equals('active').toArray(),
      )[0];
      if (activeWorkout !== undefined) throw new ProgramWorkoutError('active_workout_exists');

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
          : alive(
              await db.programScheduleEntries.where('revisionId').anyOf(revisionIds).toArray(),
            );
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
          sets: source.plannedSets.filter((set) => set.routineExerciseId === row.id),
        };
      });

      const exerciseIds = [...new Set(source.rows.map((row) => row.exerciseId))];
      const records =
        exerciseIds.length === 0
          ? []
          : await db.personalRecords.where('exerciseId').anyOf(exerciseIds).toArray();
      const oneRepMaxByExerciseId = currentOneRepMaxByExerciseId(records);
      const projection = projectProgramPrescription({
        week,
        exercises: prescriptionExercises,
        oneRepMaxByExerciseId,
      });
      const targetsByRoutineSetId = new Map<string, WorkoutTargetSnapshot>(
        projection.sets.map((set) => [set.routineSetId, set]),
      );
      const graph = buildWorkoutEntities({
        source,
        startedAt,
        programContext: {
          programId: program.id,
          programWeekIndex: position.weekIndex,
          programScheduleEntryId: effectiveEntry.id,
          programIsDeload: week.isDeload,
        },
        targetsByRoutineSetId,
      });

      await insertWorkoutEntities(graph);
      return { workout: graph.workout, warnings: projection.warnings };
    },
  );
}
