import type {
  HistoricalExercise,
  HistoricalSet,
  HistoricalWorkout,
} from '@/lib/historyProjection';

export const historicalSet = (
  values: Partial<HistoricalSet> = {},
): HistoricalSet => ({
  setType: 'normal',
  side: 'both',
  weight: 80,
  reps: 8,
  ...values,
});

export const historicalExercise = (
  values: Partial<HistoricalExercise> = {},
): HistoricalExercise => ({
  exerciseId: 'exercise-1',
  name: 'Développé couché',
  measurementType: 'weight_reps',
  primaryMuscle: 'chest',
  equipment: 'barbell',
  sets: [historicalSet()],
  ...values,
});

export const historicalWorkout = (
  values: Partial<HistoricalWorkout> = {},
): HistoricalWorkout => ({
  workoutId: 'workout-1',
  name: 'Upper A',
  startedAt: 1_000,
  durationSeconds: 3_600,
  exercises: [historicalExercise()],
  ...values,
});
