import type { Exercise, MeasurementType, Workout, WorkoutSet } from '@/data/types';
import type { CoachExerciseLine, CoachSetInput } from './types';

function toCoachSet(set: WorkoutSet): CoachSetInput {
  return {
    setType: set.setType,
    isCompleted: set.isCompleted,
    reps: set.reps,
    weight: set.weight,
    targetReps: set.targetReps,
    targetRepsMax: set.targetRepsMax,
    performedAt: set.performedAt,
    order: set.order,
  };
}

export interface CoachLineSource {
  workout: Pick<Workout, 'id' | 'startedAt' | 'deloadPercent' | 'importSource'>;
  exerciseId: string;
  measurementType: MeasurementType;
  equipment: Exercise['equipment'];
  loadIncrementKg?: number;
  sets: readonly WorkoutSet[];
}

/** Pure projection from a session line into the engine's input shape. */
export function coachLineFromSource(source: CoachLineSource): CoachExerciseLine {
  return {
    exerciseId: source.exerciseId,
    workoutId: source.workout.id,
    workoutStartedAt: source.workout.startedAt,
    deloadPercent: source.workout.deloadPercent,
    importSource: source.workout.importSource,
    measurementType: source.measurementType,
    equipment: source.equipment,
    loadIncrementKg: source.loadIncrementKg,
    sets: source.sets.map(toCoachSet),
  };
}
