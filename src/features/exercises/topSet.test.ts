import { describe, expect, it } from 'vitest';
import { newEntity } from '@/data/repositories/base';
import type { WorkoutSet } from '@/data/types';
import { topSetLabel } from './topSet';

const set = (weight: number | undefined, reps: number, setType: WorkoutSet['setType'] = 'normal') =>
  newEntity<WorkoutSet>({
    workoutExerciseId: 'we',
    exerciseId: 'ex',
    workoutId: 'w',
    order: 0,
    setType,
    side: 'both',
    ...(weight === undefined ? {} : { weight }),
    reps,
    isCompleted: 1,
    performedAt: 1,
  });

describe('topSetLabel', () => {
  it('prend la charge la plus lourde pour une charge normale', () => {
    expect(topSetLabel([set(60, 10), set(100, 5)], 'weight_reps')).toBe('100 kg × 5');
  });

  it("prend l'assistance la plus faible pour un exercice assisté", () => {
    expect(topSetLabel([set(40, 8), set(20, 6), set(30, 7)], 'assisted_weight_reps')).toBe(
      '20 kg × 6',
    );
  });

  it('à assistance égale, départage aux répétitions', () => {
    expect(topSetLabel([set(20, 5), set(20, 8)], 'assisted_weight_reps')).toBe('20 kg × 8');
  });

  it("compte une assistance nulle comme la meilleure, et ignore l'échauffement", () => {
    expect(
      topSetLabel([set(10, 8), set(0, 3), set(0, 20, 'warmup')], 'assisted_weight_reps'),
    ).toBe('0 kg × 3');
  });
});
