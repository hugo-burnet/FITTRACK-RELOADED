import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Exercise } from '@/data/types';
import { ExerciseList } from './ExerciseList';

const exercise: Exercise = {
  id: 'exercise-1',
  name: 'Curl barre',
  primaryMuscle: 'biceps',
  secondaryMuscles: [],
  equipment: 'barbell',
  measurementType: 'weight_reps',
  isCustom: 0,
  isUnilateral: 0,
  createdAt: 1,
  updatedAt: 1,
  deletedAt: 0,
};

describe('ExerciseList', () => {
  it('prevents the filtered list from shrinking inside the scroll column', () => {
    const { container } = render(
      <ExerciseList exercises={[exercise]} grouped={false} onOpen={vi.fn()} />,
    );

    expect(container.firstElementChild).toHaveClass('shrink-0');
  });
});
