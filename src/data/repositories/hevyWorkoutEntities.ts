import type {
  Exercise,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '@/data/types';
import type { HevyParsedWorkout } from '@/lib/hevyCsv';
import { externalExerciseIdentityKey } from '@/lib/externalExerciseIdentity';
import { resolveRestSeconds } from '@/lib/rest';
import { localOffsetMinutes } from '@/lib/timezone';
import { newEntity } from './base';
import { snapshotOf } from '@/lib/exerciseSnapshot';

export interface HevyWorkoutEntities {
  workouts: Workout[];
  rows: WorkoutExercise[];
  sets: WorkoutSet[];
}

export function buildHevyWorkoutEntities(
  parsedWorkouts: readonly HevyParsedWorkout[],
  exercises: ReadonlyMap<string, Exercise>,
  /**
   * La routine reconstruite à laquelle chaque séance appartient, par clé
   * d'import. Une séance importée doit pointer vers elle comme une séance
   * lancée depuis l'app : c'est ce lien que lisent l'accueil (« dernière fois
   * que tu l'as faite ») et l'export CSV.
   */
  routineIdByImportKey: ReadonlyMap<string, string> = new Map(),
): HevyWorkoutEntities {
  const workouts: Workout[] = [];
  const rows: WorkoutExercise[] = [];
  const sets: WorkoutSet[] = [];

  for (const parsed of parsedWorkouts) {
    const workout = newEntity<Workout>({
      routineId: routineIdByImportKey.get(parsed.importKey) ?? '',
      name: parsed.title,
      status: 'completed',
      startedAt: parsed.startedAt,
      endedAt: parsed.endedAt,
      durationSeconds: parsed.durationSeconds,
      ...(parsed.notes === undefined ? {} : { notes: parsed.notes }),
      importSource: 'hevy_csv',
      importKey: parsed.importKey,
      // The CSV carries a wall-clock date with no zone. `hevyCsv` reads it in
      // the device's zone, so the offset that reproduces it is the device's
      // offset AT THAT DATE — not today's, which is why it is read per session.
      startedTimezoneOffsetMinutes: localOffsetMinutes(parsed.startedAt),
    });
    workouts.push(workout);

    const totalSets = parsed.exercises.reduce(
      (total, exercise) => total + exercise.sets.length,
      0,
    );
    let sequence = 0;
    for (const parsedExercise of parsed.exercises) {
      const sourceKey = externalExerciseIdentityKey(
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
        // Le repos déclaré par un export FitTrack d'abord, le défaut de
        // l'exercice ensuite : un fichier Hevy n'a pas cette colonne et retombe
        // sur le second, exactement comme avant.
        restSeconds: resolveRestSeconds(
          parsedExercise.restSeconds,
          exercise.defaultRestSeconds,
        ),
        ...snapshotOf(exercise),
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
            // Hevy ne dit pas quel côté a travaillé ; FitTrack, si.
            side: parsedSet.side ?? 'both',
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
