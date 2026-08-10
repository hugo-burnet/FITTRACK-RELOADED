import type { HistoricalWorkout } from '@/lib/historyProjection';
import type { AnalyticsSession } from './metrics';

export function toAnalyticsSessions(
  workouts: readonly HistoricalWorkout[],
): AnalyticsSession[] {
  return workouts.map((workout) => {
    const sets = workout.exercises.flatMap((exercise) =>
      exercise.sets.map((set) => ({
        ...set,
        ...(exercise.bodyweightLoadFactor === undefined
          ? {}
          : {
              bodyweightLoadFactor:
                exercise.bodyweightLoadFactor,
            }),
      })),
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
      sets,
    };
  });
}
