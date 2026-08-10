import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { RoutineExerciseDetail } from '@/data/repositories/routines';
import type { Exercise, RoutineExercise } from '@/data/types';
import type { ItemState } from '@/ui';
import { RoutineExerciseCard } from './RoutineExerciseCard';

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

const row: RoutineExercise = {
  ...stamps,
  id: 'routine-exercise-1',
  routineId: 'routine-1',
  exerciseId: exercise.id,
  order: 0,
  supersetGroup: 0,
  restSeconds: 0,
};

const line: RoutineExerciseDetail = { row, exercise, sets: [] };

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
    <RoutineExerciseCard
      line={line}
      state={state}
      reorderEnabled={reorderEnabled}
      onMenu={vi.fn()}
      onOpenSet={vi.fn()}
      onDeleteSet={vi.fn()}
      onAddSet={vi.fn()}
    />,
  );
}

/** The column holding the title and its subtitle — what the handle used to inset. */
function headerContent(): HTMLElement {
  const header = screen.getByText(NAME).closest('span.flex-col');
  expect(header).not.toBeNull();
  return header as HTMLElement;
}

describe('RoutineExerciseCard', () => {
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
