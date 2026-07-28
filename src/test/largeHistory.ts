import { db } from '@/data/db';
import type {
  Equipment,
  Exercise,
  MuscleGroup,
  Syncable,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '@/data/types';
import { day } from '@/test/factories';

export interface LargeHistoryProfile {
  workoutCount: number;
  exercisesPerWorkout: number;
  setsPerExercise: number;
  startedAt: number;
  workoutSpacingMs: number;
}

export interface LargeHistoryCounts {
  exercises: number;
  workouts: number;
  workoutExercises: number;
  workoutSets: number;
}

export const LARGE_HISTORY_PROFILE: LargeHistoryProfile = {
  workoutCount: 2_000,
  exercisesPerWorkout: 8,
  setsPerExercise: 4,
  startedAt: day(-3_000),
  workoutSpacingMs: 36 * 60 * 60 * 1_000,
};

const MUSCLES: readonly MuscleGroup[] = [
  'chest',
  'lats',
  'upper_back',
  'shoulders',
  'quads',
  'hamstrings',
  'glutes',
  'abs',
];

const EQUIPMENT: readonly Equipment[] = [
  'barbell',
  'cable',
  'machine',
  'dumbbell',
  'barbell',
  'machine',
  'cable',
  'bodyweight',
];

const pad = (value: number): string => value.toString().padStart(5, '0');

function syncable(id: string, at: number): Syncable {
  return {
    id,
    createdAt: at,
    updatedAt: at,
    deletedAt: 0,
  };
}

export async function seedLargeHistory(
  profile: LargeHistoryProfile,
): Promise<LargeHistoryCounts> {
  const exercises: Exercise[] = Array.from(
    { length: profile.exercisesPerWorkout },
    (_, exerciseIndex) => ({
      ...syncable(`large-exercise-${pad(exerciseIndex)}`, profile.startedAt),
      name: `Benchmark exercise ${exerciseIndex + 1}`,
      primaryMuscle: MUSCLES[exerciseIndex % MUSCLES.length]!,
      secondaryMuscles: [],
      equipment: EQUIPMENT[exerciseIndex % EQUIPMENT.length]!,
      measurementType: 'weight_reps',
      isCustom: 1,
      isUnilateral: 0,
    }),
  );

  const workouts: Workout[] = [];
  const workoutExercises: WorkoutExercise[] = [];
  const workoutSets: WorkoutSet[] = [];

  for (let workoutIndex = 0; workoutIndex < profile.workoutCount; workoutIndex += 1) {
    const workoutId = `large-workout-${pad(workoutIndex)}`;
    const startedAt = profile.startedAt + workoutIndex * profile.workoutSpacingMs;

    workouts.push({
      ...syncable(workoutId, startedAt),
      routineId: '',
      name: `Benchmark workout ${workoutIndex + 1}`,
      status: 'completed',
      startedAt,
      endedAt: startedAt + 3_600_000,
      durationSeconds: 3_600,
      startedTimezoneOffsetMinutes: 0,
    });

    for (
      let exerciseIndex = 0;
      exerciseIndex < profile.exercisesPerWorkout;
      exerciseIndex += 1
    ) {
      const exercise = exercises[exerciseIndex]!;
      const rowId = `large-row-${pad(workoutIndex)}-${pad(exerciseIndex)}`;

      workoutExercises.push({
        ...syncable(rowId, startedAt),
        workoutId,
        exerciseId: exercise.id,
        order: exerciseIndex,
        supersetGroup: 0,
        restSeconds: 120,
        exerciseName: exercise.name,
        exerciseMeasurementType: exercise.measurementType,
        exercisePrimaryMuscle: exercise.primaryMuscle,
        exerciseEquipment: exercise.equipment,
      });

      for (let setIndex = 0; setIndex < profile.setsPerExercise; setIndex += 1) {
        workoutSets.push({
          ...syncable(
            `large-set-${pad(workoutIndex)}-${pad(exerciseIndex)}-${pad(setIndex)}`,
            startedAt,
          ),
          workoutExerciseId: rowId,
          exerciseId: exercise.id,
          workoutId,
          order: setIndex,
          setType: 'normal',
          side: 'both',
          weight: 20 + exerciseIndex * 10 + setIndex * 2.5,
          reps: 12 - setIndex,
          isCompleted: 1,
          performedAt:
            startedAt +
            (exerciseIndex * profile.setsPerExercise + setIndex + 1) * 60_000,
        });
      }
    }
  }

  await db.transaction(
    'rw',
    db.exercises,
    db.workouts,
    db.workoutExercises,
    db.workoutSets,
    async () => {
      await db.exercises.bulkAdd(exercises);
      await db.workouts.bulkAdd(workouts);
      await db.workoutExercises.bulkAdd(workoutExercises);
      await db.workoutSets.bulkAdd(workoutSets);
    },
  );

  return {
    exercises: exercises.length,
    workouts: workouts.length,
    workoutExercises: workoutExercises.length,
    workoutSets: workoutSets.length,
  };
}
