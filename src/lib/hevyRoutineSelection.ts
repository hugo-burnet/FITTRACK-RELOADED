import type { HevyParsedWorkout } from './hevyCsv';
import { normalizeHevyExerciseTitle } from './hevyExerciseMatch';
import { normalizeRoutineName } from './routineName';

export interface HevyRoutineSource {
  name: string;
  workout: HevyParsedWorkout;
}

/** Le regroupement de l'import et le rattachement de l'accueil, même règle. */
export const normalizeHevyRoutineName = normalizeRoutineName;

function displayName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

function distinctExerciseCount(workout: HevyParsedWorkout): number {
  return new Set(
    workout.exercises.map((exercise) =>
      normalizeHevyExerciseTitle(exercise.sourceTitle),
    ),
  ).size;
}

export function selectHevyRoutineSources(
  workouts: readonly HevyParsedWorkout[],
): HevyRoutineSource[] {
  const groups = new Map<string, HevyParsedWorkout[]>();
  for (const workout of workouts) {
    const key = normalizeHevyRoutineName(workout.title);
    const group = groups.get(key);
    if (group === undefined) groups.set(key, [workout]);
    else group.push(workout);
  }

  const selected = [...groups.values()].map((group) => {
    const winner = [...group]
      .sort((left, right) => right.startedAt - left.startedAt)
      .slice(0, 5)
      .sort(
        (left, right) =>
          distinctExerciseCount(right) -
            distinctExerciseCount(left) ||
          right.startedAt - left.startedAt,
      )[0]!;

    return {
      name: displayName(winner.title),
      workout: winner,
    };
  });

  return selected.sort(
    (left, right) =>
      left.workout.startedAt - right.workout.startedAt,
  );
}
