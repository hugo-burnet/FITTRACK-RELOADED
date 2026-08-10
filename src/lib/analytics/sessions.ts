import type { HistoricalWorkout } from '@/lib/historyProjection';
import type { AnalyticsSession } from './metrics';

export function toAnalyticsSessions(
  workouts: readonly HistoricalWorkout[],
): AnalyticsSession[] {
  return workouts.map((workout) => {
    const sets = workout.exercises.flatMap(
      (exercise) => exercise.sets,
    );
    const measurementType =
      workout.exercises[0]?.measurementType;

    return {
      workoutId: workout.workoutId,
      startedAt: workout.startedAt,
      ...(measurementType === undefined
        ? {}
        : { measurementType }),
      ...(workout.bodyWeightKg === undefined
        ? {}
        : { bodyWeightKg: workout.bodyWeightKg }),
      ...(workout.exercises[0]?.bodyweightLoadFactor === undefined
        ? {}
        : {
            bodyweightLoadFactor:
              workout.exercises[0].bodyweightLoadFactor,
          }),
      sets,
    };
  });
}
