import type { ProgramPhase, ProgramWeek, RoutineSet } from '@/data/types';
import { previousLoad, resolveLoadIncrementKg } from '@/lib/loadIncrement';
import type {
  ProgramPrescriptionExerciseInput,
  ProgramPrescriptionProjection,
  ProjectedProgramSet,
} from './prescription';

/** Week fields accepted by the deload recipe; loadIndex is intentionally unused. */
type DeloadWeekInput = Pick<ProgramWeek, 'loadIndex' | 'phase'> | {
  phase: ProgramPhase;
  loadIndex: number;
};

const orderedSets = (sets: readonly RoutineSet[]): RoutineSet[] =>
  [...sets].sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));

function isWarmup(set: Pick<RoutineSet, 'setType'>): boolean {
  return set.setType === 'warmup';
}

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
 * Deterministic deload recipe (spec §6.1):
 * - working-set load: two `previousLoad` steps (floor 0); warm-ups untouched
 * - volume: drop one working set, keep at least one
 * - reps: floor of the range (`targetReps`), no ceiling
 * - `loadIndex` is narrative only — never a multiplier
 */
export function createDeloadTargets(input: {
  week: DeloadWeekInput;
  exercises: readonly ProgramPrescriptionExerciseInput[];
}): ProgramPrescriptionProjection {
  void input.week.loadIndex;
  void input.week.phase;

  const sets: ProjectedProgramSet[] = [];

  for (const { exercise, sets: routineSets } of input.exercises) {
    const ordered = orderedSets(routineSets);
    const working = ordered.filter((set) => !isWarmup(set));
    const dropId =
      working.length > 1 ? working[working.length - 1]!.id : undefined;
    const increment = resolveLoadIncrementKg(exercise);

    for (const set of ordered) {
      if (dropId !== undefined && set.id === dropId) continue;

      if (isWarmup(set)) {
        sets.push(routineTargets(set));
        continue;
      }

      const projected: ProjectedProgramSet = {
        routineSetId: set.id,
      };

      if (set.targetWeight !== undefined) {
        projected.targetWeight = previousLoad(
          previousLoad(set.targetWeight, increment, exercise.measurementType),
          increment,
          exercise.measurementType,
        );
      }
      if (set.targetReps !== undefined) {
        projected.targetReps = set.targetReps;
      }
      // Deload pins the floor; drop the range ceiling.
      if (set.targetDurationSeconds !== undefined) {
        projected.targetDurationSeconds = set.targetDurationSeconds;
      }
      if (set.targetDistanceMeters !== undefined) {
        projected.targetDistanceMeters = set.targetDistanceMeters;
      }
      if (set.targetRpe !== undefined) {
        projected.targetRpe = set.targetRpe;
      }

      sets.push(projected);
    }
  }

  return { sets };
}
