import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DeloadSheet } from './DeloadSheet';

describe('DeloadSheet', () => {
  it('applies and closes after a successful write', async () => {
    const onApply = vi.fn().mockResolvedValue(true);
    const onClose = vi.fn();
    render(<DeloadSheet open onClose={onClose} onApply={onApply} />);

    await userEvent.click(screen.getByRole('button', { name: 'Appliquer' }));

    expect(onApply).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('stays open and offers retry when IndexedDB rejects the write', async () => {
    const onApply = vi.fn().mockRejectedValue(new Error('IndexedDB unavailable'));
    const onClose = vi.fn();
    render(<DeloadSheet open onClose={onClose} onApply={onApply} />);

    await userEvent.click(screen.getByRole('button', { name: 'Appliquer' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Le deload n’a pas pu être appliqué. Réessaie.',
    );
    expect(onClose).not.toHaveBeenCalled();
  });
});
