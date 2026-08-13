import type { Exercise, ProgramWeek, RoutineSet } from '@/data/types';

export type ProgramPrescriptionWarningCode =
  | 'missing_one_rep_max'
  | 'unsupported_measurement'
  | 'assistance_not_supported';

export interface ProgramPrescriptionWarning {
  code: ProgramPrescriptionWarningCode;
  exerciseId: string;
}

export interface ProgramPrescriptionExerciseInput {
  exercise: Pick<Exercise, 'id' | 'equipment' | 'measurementType' | 'loadIncrementKg'>;
  sets: readonly RoutineSet[];
}

export interface ProjectedProgramSet {
  routineSetId: string;
  targetWeight?: number;
  targetReps?: number;
  targetRepsMax?: number;
  targetDurationSeconds?: number;
  targetDistanceMeters?: number;
  targetRpe?: number;
}

export interface ProgramPrescriptionProjection {
  sets: ProjectedProgramSet[];
  warnings: ProgramPrescriptionWarning[];
}

/** Week fields read by the projection; loadIndex is intentionally unused. */
type ProgramWeekPrescription = Pick<ProgramWeek, 'loadIndex' | 'phase'>;

const orderedSets = (sets: readonly RoutineSet[]): RoutineSet[] =>
  [...sets].sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));

function routineTargets(set: RoutineSet): ProjectedProgramSet {
  return {
    routineSetId: set.id,
    ...(set.targetWeight === undefined ? {} : { targetWeight: set.targetWeight }),
    ...(set.targetReps === undefined ? {} : { targetReps: set.targetReps }),
    ...(set.targetRepsMax === undefined ? {} : { targetRepsMax: set.targetRepsMax }),
    ...(set.targetDurationSeconds === undefined
      ? {}
      : { targetDurationSeconds: set.targetDurationSeconds }),
    ...(set.targetDistanceMeters === undefined
      ? {}
      : { targetDistanceMeters: set.targetDistanceMeters }),
    ...(set.targetRpe === undefined ? {} : { targetRpe: set.targetRpe }),
  };
}

/**
 * Projects program-week intention onto routine targets without inventing performed
 * values. Non-deload weeks are identity (routine is the source of truth). Deload
 * recipe lands in Task 4; until then deload also returns routine targets.
 *
 * `loadIndex` is never applied as a multiplier.
 */
export function projectProgramPrescription(input: {
  week: ProgramWeekPrescription;
  exercises: readonly ProgramPrescriptionExerciseInput[];
  oneRepMaxByExerciseId: ReadonlyMap<string, number>;
}): ProgramPrescriptionProjection {
  void input.week;
  void input.oneRepMaxByExerciseId;

  const sets: ProjectedProgramSet[] = [];
  for (const { sets: routineSets } of input.exercises) {
    sets.push(...orderedSets(routineSets).map(routineTargets));
  }
  return { sets, warnings: [] };
}
