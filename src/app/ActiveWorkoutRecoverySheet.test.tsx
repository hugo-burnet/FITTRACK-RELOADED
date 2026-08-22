import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ActiveWorkoutRecoverySheet } from './ActiveWorkoutRecoverySheet';

type RecoveryProps = React.ComponentProps<typeof ActiveWorkoutRecoverySheet>;

function props(overrides: Partial<RecoveryProps> = {}): RecoveryProps {
  return {
    open: true,
    workoutName: 'Poussée',
    validatedSetCount: 2,
    onClose: vi.fn(),
    onResume: vi.fn(),
    onFinish: vi.fn(),
    onDiscard: vi.fn(),
    ...overrides,
  };
}

describe('ActiveWorkoutRecoverySheet', () => {
  it('offers explicit resume and finish choices without discarding anything', async () => {
    const onResume = vi.fn();
    const onFinish = vi.fn();
    const onDiscard = vi.fn();
    const { rerender } = render(
      <ActiveWorkoutRecoverySheet {...props({ onResume, onFinish, onDiscard })} />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Reprendre la séance' }));
    expect(onResume).toHaveBeenCalledOnce();
    expect(onDiscard).not.toHaveBeenCalled();

    rerender(<ActiveWorkoutRecoverySheet {...props({ onResume, onFinish, onDiscard })} />);
    await userEvent.click(screen.getByRole('button', { name: 'Voir le bilan et terminer' }));
    expect(onFinish).toHaveBeenCalledOnce();
    expect(onDiscard).not.toHaveBeenCalled();
  });

  it('keeps discard inaccessible while the validated count is unknown', async () => {
    const onResume = vi.fn();
    const onFinish = vi.fn();
    const onDiscard = vi.fn();
    const { rerender } = render(
      <ActiveWorkoutRecoverySheet
        {...props({ validatedSetCount: null, onResume, onFinish, onDiscard })}
      />,
    );

    const discard = screen.getByRole('button', { name: 'Abandonner la séance' });
    expect(discard).toBeDisabled();
    expect(screen.queryByText(/0 série/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirmer l’abandon' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Reprendre la séance' }));
    await userEvent.click(screen.getByRole('button', { name: 'Voir le bilan et terminer' }));
    expect(onResume).toHaveBeenCalledOnce();
    expect(onFinish).toHaveBeenCalledOnce();

    rerender(
      <ActiveWorkoutRecoverySheet
        {...props({ validatedSetCount: 2, onResume, onFinish, onDiscard })}
      />,
    );
    expect(screen.getByRole('button', { name: 'Abandonner la séance' })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: 'Abandonner la séance' }));
    expect(screen.getByText('2 séries validées ne seront pas conservées.')).toBeVisible();
  });

  it.each([
    [0, 'Aucune série validée ne sera conservée.'],
    [1, 'La série validée ne sera pas conservée.'],
    [3, '3 séries validées ne seront pas conservées.'],
  ])('uses the exact counted discard copy for %i validated sets', async (count, copy) => {
    render(<ActiveWorkoutRecoverySheet {...props({ validatedSetCount: count })} />);

    await userEvent.click(screen.getByRole('button', { name: 'Abandonner la séance' }));

    expect(screen.getByText(copy)).toBeVisible();
  });

  it('requires confirmation before discard', async () => {
    const onDiscard = vi.fn();
    render(<ActiveWorkoutRecoverySheet {...props({ onDiscard })} />);

    await userEvent.click(screen.getByRole('button', { name: 'Abandonner la séance' }));
    expect(onDiscard).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Confirmer l’abandon' }));

    expect(onDiscard).toHaveBeenCalledOnce();
  });

  it('resets confirmation after close and reopen without two open sheets', async () => {
    const base = props();
    const { rerender } = render(<ActiveWorkoutRecoverySheet {...base} />);

    await userEvent.click(screen.getByRole('button', { name: 'Abandonner la séance' }));
    const choiceDialog = screen.getAllByRole('dialog')[0];
    if (choiceDialog === undefined) throw new Error('Expected the recovery choice dialog');
    fireEvent.transitionEnd(choiceDialog);
    expect(screen.getAllByRole('dialog')).toHaveLength(1);

    rerender(<ActiveWorkoutRecoverySheet {...base} open={false} />);
    const confirmDialog = screen
      .getByRole('button', { name: 'Confirmer l’abandon' })
      .closest('[role="dialog"]');
    expect(confirmDialog).toHaveStyle({ transform: 'translateY(100%)' });
    rerender(<ActiveWorkoutRecoverySheet {...base} open />);

    expect(screen.getByRole('button', { name: 'Reprendre la séance' })).toBeVisible();
    expect(confirmDialog).toHaveStyle({ transform: 'translateY(100%)' });
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Reprendre la séance' }).closest('[role="dialog"]'),
      ).not.toHaveStyle({ transform: 'translateY(100%)' });
    });
  });
});
