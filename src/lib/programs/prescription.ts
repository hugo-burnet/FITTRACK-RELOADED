import type { Exercise, ProgramWeek, RoutineSet } from '@/data/types';
import { resolveLoadIncrementKg, roundLoadToIncrement } from '@/lib/loadIncrement';

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

type ProgramWeekPrescription = Pick<ProgramWeek, 'prescriptionKind' | 'prescriptionValue'>;

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

const isWorkingSet = (set: RoutineSet): boolean => set.setType !== 'warmup';

const isUsableOneRepMax = (value: number | undefined): value is number =>
  value !== undefined && Number.isFinite(value) && value > 0;

/**
 * Applies a program week's shared prescription to routine targets without ever
 * creating performed values. The caller owns storage and uses `routineSetId`
 * to copy these target-only rows into a fresh workout.
 */
export function projectProgramPrescription(input: {
  week: ProgramWeekPrescription;
  exercises: readonly ProgramPrescriptionExerciseInput[];
  oneRepMaxByExerciseId: ReadonlyMap<string, number>;
}): ProgramPrescriptionProjection {
  const sets: ProjectedProgramSet[] = [];
  const warnings: ProgramPrescriptionWarning[] = [];
  const warned = new Set<string>();

  const warn = (code: ProgramPrescriptionWarningCode, exerciseId: string): void => {
    const key = `${exerciseId}:${code}`;
    if (warned.has(key)) return;
    warned.add(key);
    warnings.push({ code, exerciseId });
  };

  for (const { exercise, sets: routineSets } of input.exercises) {
    const exerciseSets = orderedSets(routineSets);
    const targets = exerciseSets.map(routineTargets);
    const workingIndexes = exerciseSets.flatMap((set, index) =>
      isWorkingSet(set) ? [index] : [],
    );

    if (workingIndexes.length > 0 && input.week.prescriptionKind === 'target_rpe') {
      for (const index of workingIndexes) {
        const target = targets[index];
        if (target !== undefined) target.targetRpe = input.week.prescriptionValue;
      }
    } else if (workingIndexes.length > 0) {
      if (exercise.measurementType === 'assisted_weight_reps') {
        warn('assistance_not_supported', exercise.id);
      } else if (exercise.measurementType !== 'weight_reps') {
        warn('unsupported_measurement', exercise.id);
      } else {
        const oneRepMax = input.oneRepMaxByExerciseId.get(exercise.id);
        if (!isUsableOneRepMax(oneRepMax)) {
          warn('missing_one_rep_max', exercise.id);
        } else {
          const proposedWeight = roundLoadToIncrement(
            (oneRepMax * input.week.prescriptionValue) / 100,
            resolveLoadIncrementKg(exercise),
          );
          if (proposedWeight === undefined) {
            warn('missing_one_rep_max', exercise.id);
          } else {
            for (const index of workingIndexes) {
              const target = targets[index];
              if (target !== undefined) target.targetWeight = proposedWeight;
            }
          }
        }
      }
    }

    sets.push(...targets);
  }

  return { sets, warnings };
}
