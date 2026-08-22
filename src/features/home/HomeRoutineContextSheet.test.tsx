import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setRoutineFolderContext } from '@/data/repositories/settings';
import { HomeRoutineContextSheet } from './HomeRoutineContextSheet';

vi.mock('@/data/repositories/settings', () => ({
  setRoutineFolderContext: vi.fn(),
}));

const options = [
  { value: 'folder:push' as const, label: 'Salle', routineCount: 2 },
  { value: 'root' as const, label: 'Sans dossier', routineCount: 1 },
];

describe('HomeRoutineContextSheet', () => {
  beforeEach(() => {
    vi.mocked(setRoutineFolderContext).mockReset();
  });

  it('persists a folder and closes only after the write succeeds', async () => {
    let finishWrite: (() => void) | undefined;
    vi.mocked(setRoutineFolderContext).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishWrite = resolve;
        }),
    );
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <HomeRoutineContextSheet open value={null} options={options} onClose={onClose} />,
    );

    await user.click(screen.getByRole('radio', { name: /Salle/ }));

    expect(setRoutineFolderContext).toHaveBeenCalledWith({
      kind: 'folder',
      folderId: 'push',
    });
    expect(onClose).not.toHaveBeenCalled();
    for (const radio of screen.getAllByRole('radio')) expect(radio).toBeDisabled();

    finishWrite?.();
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });

  it('maps the root option to the persisted root context', async () => {
    vi.mocked(setRoutineFolderContext).mockResolvedValueOnce();
    const user = userEvent.setup();
    render(
      <HomeRoutineContextSheet open value={null} options={options} onClose={vi.fn()} />,
    );

    await user.click(screen.getByRole('radio', { name: /Sans dossier/ }));

    expect(setRoutineFolderContext).toHaveBeenCalledWith({ kind: 'root' });
  });

  it('keeps the sheet open and reports a failed local write', async () => {
    vi.mocked(setRoutineFolderContext).mockRejectedValueOnce(new Error('disk full'));
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <HomeRoutineContextSheet open value={null} options={options} onClose={onClose} />,
    );

    await user.click(screen.getByRole('radio', { name: /Salle/ }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Impossible de changer de dossier.',
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Choisir un dossier' })).toBeVisible();
    expect(screen.getByRole('radio', { name: /Salle/ })).toBeEnabled();
  });

  it('exposes checked radio rows with 56px touch targets', () => {
    render(
      <HomeRoutineContextSheet open value="root" options={options} onClose={vi.fn()} />,
    );

    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(2);
    for (const radio of radios) expect(radio).toHaveClass('min-h-14');

    const selected = screen.getByRole('radio', { name: /Sans dossier/ });
    expect(selected).toHaveAttribute('aria-checked', 'true');
    expect(selected.querySelector('svg')).not.toBeNull();
    expect(screen.getByRole('radio', { name: /Salle/ })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });
});
