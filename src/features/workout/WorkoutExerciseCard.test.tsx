import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { WorkoutExerciseDetail } from '@/data/repositories/workouts';
import type { Exercise, WorkoutExercise } from '@/data/types';
import type { ItemState } from '@/ui';
import { WorkoutExerciseCard } from './WorkoutExerciseCard';
import { INITIAL_WORKOUT_FOLD_COMMAND } from './workoutFold';

const stamps = { createdAt: 1, updatedAt: 1, deletedAt: 0 };

const NAME = 'Développé couché';

const exercise: Exercise = {
  ...stamps,
  id: 'exercise-bench',
  name: NAME,
  primaryMuscle: 'chest',
  secondaryMuscles: [],
  equipment: 'barbell',
  measurementType: 'weight_reps',
  isCustom: 0,
  isUnilateral: 0,
};

const row: WorkoutExercise = {
  ...stamps,
  id: 'workout-exercise-1',
  workoutId: 'workout-1',
  exerciseId: exercise.id,
  order: 0,
  supersetGroup: 0,
  restSeconds: 90,
};

const line: WorkoutExerciseDetail = { row, exercise, sets: [], previous: [] };

const state: ItemState = {
  dragging: false,
  handleProps: {
    onPointerDown: vi.fn(),
    onPointerMove: vi.fn(),
    onPointerUp: vi.fn(),
    onPointerCancel: vi.fn(),
    onKeyDown: vi.fn(),
    style: {},
  },
};

function renderCard(reorderEnabled: boolean) {
  render(
    <WorkoutExerciseCard
      line={line}
      rest={null}
      records={new Map()}
      state={state}
      reorderEnabled={reorderEnabled}
      foldCommand={INITIAL_WORKOUT_FOLD_COMMAND}
      onMenu={vi.fn()}
      onSetMenu={vi.fn()}
      onWrite={vi.fn()}
      onComplete={vi.fn()}
      onUncomplete={vi.fn()}
      onDeleteSet={vi.fn()}
      onRestoreSet={vi.fn()}
      onAddSet={vi.fn()}
    />,
  );
}

/** The fold button carrying the title and its subtitle — what the handle used to inset. */
const headerContent = (): HTMLElement => screen.getByRole('button', { expanded: true });

describe('WorkoutExerciseCard', () => {
  it('décale l’en-tête quand l’ordre est verrouillé', () => {
    renderCard(false);

    expect(screen.queryByRole('button', { name: `Déplacer ${NAME}` })).toBeNull();
    expect(headerContent()).toHaveClass('pl-4');
  });

  it('laisse la poignée porter le décalage quand l’ordre est déverrouillé', () => {
    renderCard(true);

    expect(headerContent()).not.toHaveClass('pl-4');
  });
});
