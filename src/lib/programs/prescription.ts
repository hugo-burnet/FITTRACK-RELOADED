import type { Exercise, ProgramWeek, RoutineSet } from '@/data/types';
import { nextLoad, previousLoad, resolveLoadIncrementKg } from '@/lib/loadIncrement';
import { createDeloadTargets } from './deloadTargets';
import { loadIndexSteps } from './phaseSuggestions';

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
}

type ProgramWeekPrescription = Pick<ProgramWeek, 'loadIndex' | 'phase'>;

const orderedSets = (sets: readonly RoutineSet[]): RoutineSet[] =>
  [...sets].sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));

const isWarmup = (set: Pick<RoutineSet, 'setType'>): boolean => set.setType === 'warmup';

/**
 * Applies `steps` load increments to one working set.
 *
 * Repeated single steps rather than one multiplication: `nextLoad` re-rounds
 * onto the exercise's own grid each time and floors at zero, so two crans up
 * from 82,5 kg on a barbell is 87,5 kg and never 86,625. It also carries the
 * assistance inversion — on an assisted machine, harder means less counterweight.
 */
function shiftWorkingLoad(
  weight: number,
  steps: number,
  increment: number,
  measurementType: Exercise['measurementType'],
): number {
  let value = weight;
  for (let applied = 0; applied < Math.abs(steps); applied += 1) {
    value =
      steps > 0
        ? nextLoad(value, increment, measurementType)
        : previousLoad(value, increment, measurementType);
  }
  return value;
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
 * Projects program-week intention onto routine targets without inventing
 * performed values.
 *
 * The week's level moves the working sets **by crans of the exercise's own load
 * increment** — never as a multiplier (`loadIndexSteps`). At the neutral level
 * the projection is the identity and the routine stays the source of truth.
 * Deload weeks keep the deterministic recipe of `createDeloadTargets`, which
 * also drops a set and pins the bottom of the rep range; their level is read by
 * the recipe, not applied twice.
 *
 * Reps, durations, distances and RPE are never touched: what a level says is
 * "more load", and inventing repetitions the user never planned is exactly the
 * kind of silent decision the app refuses to make.
 */
export function projectProgramPrescription(input: {
  week: ProgramWeekPrescription;
  exercises: readonly ProgramPrescriptionExerciseInput[];
}): ProgramPrescriptionProjection {
  if (input.week.phase === 'deload') {
    return createDeloadTargets({
      week: input.week,
      exercises: input.exercises,
    });
  }

  const steps = loadIndexSteps(input.week.loadIndex);
  const sets: ProjectedProgramSet[] = [];
  for (const { exercise, sets: routineSets } of input.exercises) {
    const increment = resolveLoadIncrementKg(exercise);
    for (const set of orderedSets(routineSets)) {
      const projected = routineTargets(set);
      if (steps !== 0 && !isWarmup(set) && projected.targetWeight !== undefined) {
        projected.targetWeight = shiftWorkingLoad(
          projected.targetWeight,
          steps,
          increment,
          exercise.measurementType,
        );
      }
      sets.push(projected);
    }
  }
  return { sets };
}
