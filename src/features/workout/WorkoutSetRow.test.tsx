import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WorkoutSet } from '@/data/types';
import { entryColumns } from '@/lib/measurement';
import { WorkoutSetRow } from './WorkoutSetRow';

const set: WorkoutSet = {
  id: 'set-unilateral',
  createdAt: 1,
  updatedAt: 1,
  deletedAt: 0,
  workoutExerciseId: 'row-1',
  exerciseId: 'exercise-1',
  workoutId: 'workout-1',
  order: 0,
  setType: 'normal',
  side: 'both',
  weight: 12,
  reps: 8,
  isCompleted: 0,
  performedAt: 0,
  unilateralSecondSideStartsAt: 110_000,
};

describe('WorkoutSetRow — transition unilatérale', () => {
  afterEach(() => vi.useRealTimers());

  it('libère la coche du second côté à l’échéance sans rendu du parent', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(100_000);
    render(
      <WorkoutSetRow
        set={set}
        number={1}
        columns={entryColumns('weight_reps')}
        previous={undefined}
        unilateral
        onWrite={vi.fn()}
        onComplete={vi.fn()}
        onUncomplete={vi.fn()}
        onMenu={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Changement de côté · 10' })).toBeDisabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(
      screen.getByRole('button', { name: 'Second côté — valider la série 1' }),
    ).toBeEnabled();
  });
});
