import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OrderLockButton } from './OrderLockButton';

describe('OrderLockButton', () => {
  it('annonce le déverrouillage quand le cadenas est fermé', () => {
    render(<OrderLockButton unlocked={false} onToggle={vi.fn()} />);
    expect(
      screen.getByRole('button', { name: 'Déverrouiller l’ordre des exercices' }),
    ).toHaveAttribute('aria-pressed', 'false');
  });

  it('annonce le verrouillage et appelle la bascule quand le cadenas est ouvert', () => {
    const onToggle = vi.fn();
    render(<OrderLockButton unlocked onToggle={onToggle} />);

    const button = screen.getByRole('button', { name: 'Verrouiller l’ordre des exercices' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledOnce();
  });
});
