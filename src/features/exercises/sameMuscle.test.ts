import { describe, expect, it } from 'vitest';
import type { Exercise } from '@/data/types';
import { sameMuscleExercises } from './sameMuscle';

const ex = (id: string, primaryMuscle: Exercise['primaryMuscle']) =>
  ({ id, name: id, primaryMuscle }) as Exercise;

describe('sameMuscleExercises', () => {
  const all = [ex('a', 'chest'), ex('b', 'quads'), ex('c', 'chest'), ex('d', 'chest')];

  it('keeps the exercises sharing the muscle, in the given order, without the replaced one', () => {
    expect(sameMuscleExercises(all, 'chest', 'c').map((e) => e.id)).toEqual(['a', 'd']);
  });

  it('returns nothing when no muscle is known', () => {
    expect(sameMuscleExercises(all, undefined, 'c')).toEqual([]);
  });
});
