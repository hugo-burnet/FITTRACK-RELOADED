import type { HistoricalExercise, HistoricalWorkout } from './historyProjection';
import { isTimedMeasurement, measurementShape } from './measurement';
import { sessionTotals, type SessionTotals, type VolumeEntry } from './volume';

/**
 * Reading a **stored** session with the rules `sessionTotals` expects.
 *
 * `HistoricalWorkout` carries measurement types, not the four flags the volume
 * engine reads (`weightRole`, `timed`, `bodyweightLoadFactor`, `repSeconds`),
 * so every consumer of the history had to derive them again: the coach export,
 * the weekly volume chart, the exercise metrics, and now the monthly report.
 * Three copies of one projection is three chances for the tonnage of a screen
 * to disagree with the tonnage of another — the exact defect v0.9.0 fixed on
 * the bodyweight coefficient, one layer up.
 *
 * Pure by construction (architecture §7): a stored session in, numbers out.
 */

export function volumeEntriesOf(exercise: HistoricalExercise): VolumeEntry[] {
  const weightRole =
    exercise.measurementType === undefined
      ? undefined
      : measurementShape(exercise.measurementType).weightRole;
  const timed =
    exercise.measurementType === undefined
      ? undefined
      : isTimedMeasurement(exercise.measurementType);

  return exercise.sets.map((set) => ({
    set,
    weightRole,
    bodyweightLoadFactor: exercise.bodyweightLoadFactor,
    timed,
    repSeconds: exercise.repSeconds,
  }));
}

/** What one stored session is worth, warm-ups excluded as everywhere else. */
export function workoutTotals(workout: HistoricalWorkout): SessionTotals {
  return sessionTotals(workout.exercises.flatMap(volumeEntriesOf), workout.bodyWeightKg);
}

/** The same reading, narrowed to one exercise of that session. */
export function exerciseTotals(
  workout: HistoricalWorkout,
  exercise: HistoricalExercise,
): SessionTotals {
  return sessionTotals(volumeEntriesOf(exercise), workout.bodyWeightKg);
}
