import type { WorkoutExerciseDetail } from '@/data/repositories/workouts';
import { measurementShape } from '@/lib/measurement';
import { platesConfigFor } from './plateConfig';

export interface WarmupContext {
  targetWeightKg: number | undefined;
  minimumWeightKg: number;
}

export function warmupContextFor(line: WorkoutExerciseDetail): WarmupContext | null {
  const exercise = line.exercise;
  if (exercise === undefined) return null;
  if (measurementShape(exercise.measurementType).weightRole !== 'load') return null;

  const working = line.sets.find((set) => set.setType !== 'warmup');
  const targetWeightKg = working?.weight ?? working?.targetWeight;
  const minimumWeightKg = platesConfigFor(exercise)?.barWeight ?? 0;

  return { targetWeightKg, minimumWeightKg };
}
