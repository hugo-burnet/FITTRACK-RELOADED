import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HomeDashboardData } from '@/data/repositories/home';
import { setRoutineFolderContext } from '@/data/repositories/settings';
import { t } from '@/i18n/fr';
import { HomeRoutineContextSheet } from './HomeRoutineContextSheet';

vi.mock('@/data/repositories/settings', () => ({
  setRoutineFolderContext: vi.fn(),
}));

const options = [
  { value: 'folder:push' as const, label: 'Salle', routineCount: 2 },
  { value: 'root' as const, routineCount: 1 },
] satisfies HomeDashboardData['routineContext']['options'];

function SessionHarness() {
  const [open, setOpen] = useState(true);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Rouvrir
      </button>
      <HomeRoutineContextSheet
        open={open}
        value={null}
        options={options}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

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

    await user.click(
      screen.getByRole('radio', { name: t('home.rootRoutineFolder') }),
    );

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

  it('clears failed feedback after dismissal before a new sheet session', async () => {
    vi.mocked(setRoutineFolderContext).mockRejectedValueOnce(new Error('disk full'));
    const user = userEvent.setup();
    render(<SessionHarness />);

    await user.click(screen.getByRole('radio', { name: /Salle/ }));
    expect(await screen.findByRole('status')).toBeVisible();

    const dialog = screen.getByRole('dialog', { name: 'Choisir un dossier' });
    await user.click(screen.getAllByRole('button', { name: 'Fermer' }).at(-1)!);
    fireEvent.transitionEnd(dialog);
    await user.click(screen.getByRole('button', { name: 'Rouvrir' }));

    expect(await screen.findByRole('dialog', { name: 'Choisir un dossier' })).toBeVisible();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('exposes checked radio rows with 56px touch targets', () => {
    render(
      <HomeRoutineContextSheet open value="root" options={options} onClose={vi.fn()} />,
    );

    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(2);
    for (const radio of radios) expect(radio).toHaveClass('min-h-14');

    const selected = screen.getByRole('radio', {
      name: t('home.rootRoutineFolder'),
    });
    expect(selected).toHaveAttribute('aria-checked', 'true');
    expect(selected.querySelector('svg')).not.toBeNull();
    expect(screen.getByRole('radio', { name: /Salle/ })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });
});
