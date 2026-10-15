import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

describe('WorkoutSetRow — à l’échec : les répétitions sont le résultat, jamais une proposition', () => {
  const failureSet: WorkoutSet = {
    ...set,
    id: 'set-failure',
    setType: 'failure',
    weight: undefined,
    reps: undefined,
    unilateralSecondSideStartsAt: undefined,
  };
  // La dernière fois : 70 kg × 12. Une séance ordinaire la propose en grisé, et la coche l'enregistre.
  const lastTime: WorkoutSet = { ...failureSet, id: 'last', setType: 'normal', weight: 70, reps: 12 };

  const renderRow = (props: Partial<Parameters<typeof WorkoutSetRow>[0]> = {}) => {
    const onComplete = vi.fn();
    render(
      <WorkoutSetRow
        set={failureSet}
        number={1}
        columns={entryColumns('weight_reps')}
        previous={lastTime}
        onWrite={vi.fn()}
        onComplete={onComplete}
        onUncomplete={vi.fn()}
        onMenu={vi.fn()}
        {...props}
      />,
    );
    return onComplete;
  };

  it('garde l’habitude d’une séance ordinaire : la coche propose les chiffres de la dernière fois', async () => {
    const onComplete = renderRow();

    await userEvent.click(screen.getByRole('button', { name: 'Valider la série 1' }));

    expect(onComplete).toHaveBeenCalledWith({ weight: 70, reps: 12 });
  });

  it('ferme la coche tant que les répétitions ne sont pas tapées, même avec une dernière fois', () => {
    renderRow({ amrap: true });

    expect(screen.getByRole('button', { name: 'Valider la série 1' })).toBeDisabled();
    // Le chiffre de la dernière fois n'est pas non plus suggéré en grisé dans la case : il ne se validerait pas.
    expect(screen.getByRole('textbox', { name: /Série 1 — reps/ })).toHaveAttribute('placeholder', '');
  });

  it('ouvre la coche une fois les répétitions tapées, et ne propose que la charge', async () => {
    const onComplete = renderRow({ amrap: true, set: { ...failureSet, reps: 9 } });

    const tick = screen.getByRole('button', { name: 'Valider la série 1' });
    expect(tick).toBeEnabled();
    await userEvent.click(tick);

    expect(onComplete).toHaveBeenCalledWith({ weight: 70, reps: undefined });
  });

  it('laisse « Précédent » écrire la dernière fois, puisque c’est un geste explicite', async () => {
    const onWrite = vi.fn();
    renderRow({ amrap: true, onWrite });

    await userEvent.click(screen.getByRole('button', { name: 'Précédent' }));

    expect(onWrite).toHaveBeenCalledWith({ weight: 70, reps: 12 }, true);
  });
});
