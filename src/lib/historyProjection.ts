import type {
  Equipment,
  MeasurementType,
  MuscleGroup,
  SetType,
  Side,
} from '@/data/types';

export type HistoricalScope =
  | { kind: 'workout'; workoutId: string }
  | { kind: 'exercise'; exerciseId: string; from?: number; to?: number }
  | { kind: 'period'; from: number; to: number }
  | { kind: 'all-history' };

export interface HistoricalSet {
  setType: SetType;
  side: Side;
  weight?: number;
  reps?: number;
  durationSeconds?: number;
  distanceMeters?: number;
  rpe?: number;
}

export interface HistoricalExercise {
  exerciseId: string;
  name?: string;
  measurementType?: MeasurementType;
  primaryMuscle?: MuscleGroup;
  /** Read by the body map only; every count in the app stays on the primary. */
  secondaryMuscles?: MuscleGroup[];
  equipment?: Equipment;
  bodyweightLoadFactor?: number;
  notes?: string;
  sets: HistoricalSet[];
}

export interface HistoricalWorkout {
  workoutId: string;
  name: string;
  notes?: string;
  startedAt: number;
  timezoneOffsetMinutes?: number;
  durationSeconds: number;
  bodyWeightKg?: number;
  exercises: HistoricalExercise[];
}
