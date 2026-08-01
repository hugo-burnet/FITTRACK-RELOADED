import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DeloadSheet } from './DeloadSheet';

describe('DeloadSheet', () => {
  it('applies and closes after a successful write', async () => {
    const onApply = vi.fn().mockResolvedValue(true);
    const onClose = vi.fn();
    render(<DeloadSheet open onClose={onClose} onApply={onApply} />);

    const apply = screen.getByRole('button', { name: 'Appliquer' });
    expect(apply).toHaveClass('bg-[var(--color-accent)]');
    await userEvent.click(apply);

    expect(onApply).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('retries and closes after IndexedDB recovers from a rejected write', async () => {
    const onApply = vi
      .fn()
      .mockRejectedValueOnce(new Error('IndexedDB unavailable'))
      .mockResolvedValueOnce(true);
    const onClose = vi.fn();
    render(<DeloadSheet open onClose={onClose} onApply={onApply} />);

    await userEvent.click(screen.getByRole('button', { name: 'Appliquer' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Le deload n’a pas pu être appliqué. Réessaie.',
    );
    expect(onClose).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Appliquer' }));

    expect(onApply).toHaveBeenCalledTimes(2);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('ignores a second submission while the first write is pending', async () => {
    let resolveWrite: (() => void) | undefined;
    const onApply = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveWrite = resolve;
        }),
    );
    const onClose = vi.fn();
    render(<DeloadSheet open onClose={onClose} onApply={onApply} />);
    const apply = screen.getByRole('button', { name: 'Appliquer' });

    await userEvent.click(apply);
    expect(apply).toBeDisabled();
    await userEvent.click(apply);

    expect(onApply).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();

    resolveWrite?.();
    await screen.findByRole('button', { name: 'Appliquer' });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
