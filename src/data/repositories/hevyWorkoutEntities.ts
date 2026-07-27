import type {
  Exercise,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '@/data/types';
import type { HevyParsedWorkout } from '@/lib/hevyCsv';
import { normalizeHevyExerciseTitle } from '@/lib/hevyExerciseMatch';
import { resolveRestSeconds } from '@/lib/rest';
import { newEntity } from './base';

export interface HevyWorkoutEntities {
  workouts: Workout[];
  rows: WorkoutExercise[];
  sets: WorkoutSet[];
}

export function buildHevyWorkoutEntities(
  parsedWorkouts: readonly HevyParsedWorkout[],
  exercises: ReadonlyMap<string, Exercise>,
): HevyWorkoutEntities {
  const workouts: Workout[] = [];
  const rows: WorkoutExercise[] = [];
  const sets: WorkoutSet[] = [];

  for (const parsed of parsedWorkouts) {
    const workout = newEntity<Workout>({
      routineId: '',
      name: parsed.title,
      status: 'completed',
      startedAt: parsed.startedAt,
      endedAt: parsed.endedAt,
      durationSeconds: parsed.durationSeconds,
      ...(parsed.notes === undefined ? {} : { notes: parsed.notes }),
      importSource: 'hevy_csv',
      importKey: parsed.importKey,
    });
    workouts.push(workout);

    const totalSets = parsed.exercises.reduce(
      (total, exercise) => total + exercise.sets.length,
      0,
    );
    let sequence = 0;
    for (const parsedExercise of parsed.exercises) {
      const sourceKey = normalizeHevyExerciseTitle(
        parsedExercise.sourceTitle,
      );
      const exercise = exercises.get(sourceKey);
      if (exercise === undefined) {
        throw new Error(`Missing resolved Hevy exercise: ${sourceKey}`);
      }
      const row = newEntity<WorkoutExercise>({
        workoutId: workout.id,
        exerciseId: exercise.id,
        order: parsedExercise.order,
        supersetGroup: parsedExercise.supersetGroup,
        ...(parsedExercise.notes === undefined
          ? {}
          : { notes: parsedExercise.notes }),
        restSeconds: resolveRestSeconds(
          undefined,
          exercise.defaultRestSeconds,
        ),
      });
      rows.push(row);

      for (const parsedSet of parsedExercise.sets) {
        sequence += 1;
        const performedAt =
          parsed.startedAt +
          Math.floor(
            ((parsed.endedAt - parsed.startedAt) * sequence) /
              (totalSets + 1),
          );
        sets.push(
          newEntity<WorkoutSet>({
            workoutExerciseId: row.id,
            exerciseId: exercise.id,
            workoutId: workout.id,
            order: parsedSet.order,
            setType: parsedSet.setType,
            side: 'both',
            ...(parsedSet.weight === undefined
              ? {}
              : { weight: parsedSet.weight }),
            ...(parsedSet.reps === undefined
              ? {}
              : { reps: parsedSet.reps }),
            ...(parsedSet.durationSeconds === undefined
              ? {}
              : { durationSeconds: parsedSet.durationSeconds }),
            ...(parsedSet.distanceMeters === undefined
              ? {}
              : { distanceMeters: parsedSet.distanceMeters }),
            ...(parsedSet.rpe === undefined
              ? {}
              : { rpe: parsedSet.rpe }),
            isCompleted: 1,
            performedAt,
          }),
        );
      }
    }
  }
  return { workouts, rows, sets };
}
