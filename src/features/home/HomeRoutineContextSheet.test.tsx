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
  { value: 'folder:ul' as const, label: 'UL', routineCount: 4 },
  { value: 'folder:ppl' as const, label: 'PPL', routineCount: 6 },
  { value: 'root' as const, routineCount: 2 },
] satisfies HomeDashboardData['routineContext']['options'];

const TITLE = 'Choisir les dossiers';
const done = () => screen.getByRole('button', { name: 'Terminé' });

function SessionHarness({ value = [] }: { value?: HomeDashboardData['routineContext']['selected'] }) {
  const [open, setOpen] = useState(true);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Rouvrir
      </button>
      <HomeRoutineContextSheet
        open={open}
        value={value}
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

  it('writes nothing while folders are ticked, and one choice when it is done', async () => {
    vi.mocked(setRoutineFolderContext).mockResolvedValueOnce();
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<HomeRoutineContextSheet open value={[]} options={options} onClose={onClose} />);

    await user.click(screen.getByRole('checkbox', { name: 'UL' }));
    await user.click(screen.getByRole('checkbox', { name: 'PPL' }));

    expect(setRoutineFolderContext).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    await user.click(done());

    expect(setRoutineFolderContext).toHaveBeenCalledOnce();
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });

  it('persists a single folder in its historical shape', async () => {
    vi.mocked(setRoutineFolderContext).mockResolvedValueOnce();
    const user = userEvent.setup();
    render(<HomeRoutineContextSheet open value={[]} options={options} onClose={vi.fn()} />);

    await user.click(screen.getByRole('checkbox', { name: 'PPL' }));
    await user.click(done());

    expect(setRoutineFolderContext).toHaveBeenCalledWith({ kind: 'folder', folderId: 'ppl' });
  });

  it('maps the root option alone to the persisted root context', async () => {
    vi.mocked(setRoutineFolderContext).mockResolvedValueOnce();
    const user = userEvent.setup();
    render(<HomeRoutineContextSheet open value={[]} options={options} onClose={vi.fn()} />);

    await user.click(screen.getByRole('checkbox', { name: t('home.rootRoutineFolder') }));
    await user.click(done());

    expect(setRoutineFolderContext).toHaveBeenCalledWith({ kind: 'root' });
  });

  it('persists several folders in library order, whatever order they were ticked in', async () => {
    vi.mocked(setRoutineFolderContext).mockResolvedValueOnce();
    const user = userEvent.setup();
    render(<HomeRoutineContextSheet open value={[]} options={options} onClose={vi.fn()} />);

    await user.click(screen.getByRole('checkbox', { name: t('home.rootRoutineFolder') }));
    await user.click(screen.getByRole('checkbox', { name: 'PPL' }));
    await user.click(screen.getByRole('checkbox', { name: 'UL' }));
    await user.click(done());

    expect(setRoutineFolderContext).toHaveBeenCalledWith({
      kind: 'folders',
      folderIds: ['ul', 'ppl'],
      root: true,
    });
  });

  it('starts from the saved selection and lets a folder be unticked', async () => {
    vi.mocked(setRoutineFolderContext).mockResolvedValueOnce();
    const user = userEvent.setup();
    render(
      <HomeRoutineContextSheet
        open
        value={['folder:ul', 'folder:ppl']}
        options={options}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('checkbox', { name: 'UL' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('checkbox', { name: 'PPL' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('checkbox', { name: t('home.rootRoutineFolder') })).toHaveAttribute(
      'aria-checked',
      'false',
    );

    await user.click(screen.getByRole('checkbox', { name: 'UL' }));
    await user.click(done());

    expect(setRoutineFolderContext).toHaveBeenCalledWith({ kind: 'folder', folderId: 'ppl' });
  });

  it('does not let an empty selection through, and says why', async () => {
    const user = userEvent.setup();
    render(<HomeRoutineContextSheet open value={[]} options={options} onClose={vi.fn()} />);

    expect(done()).toBeDisabled();
    expect(screen.getByText(t('home.routineFolderPickOne'))).toBeVisible();

    await user.click(screen.getByRole('checkbox', { name: 'UL' }));

    expect(done()).toBeEnabled();
    expect(screen.queryByText(t('home.routineFolderPickOne'))).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'UL' }));

    expect(done()).toBeDisabled();
    expect(setRoutineFolderContext).not.toHaveBeenCalled();
  });

  it('explains the point of ticking several folders when there are several to tick', () => {
    const { rerender } = render(
      <HomeRoutineContextSheet open value={[]} options={options} onClose={vi.fn()} />,
    );
    expect(screen.getByText(t('home.routineFolderHint'))).toBeVisible();

    rerender(
      <HomeRoutineContextSheet open value={[]} options={options.slice(0, 1)} onClose={vi.fn()} />,
    );
    expect(screen.queryByText(t('home.routineFolderHint'))).not.toBeInTheDocument();
  });

  it('closes only after the write succeeds, and blocks a second action meanwhile', async () => {
    let finishWrite: (() => void) | undefined;
    vi.mocked(setRoutineFolderContext).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishWrite = resolve;
        }),
    );
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<HomeRoutineContextSheet open value={[]} options={options} onClose={onClose} />);

    await user.click(screen.getByRole('checkbox', { name: 'UL' }));
    await user.click(done());

    expect(onClose).not.toHaveBeenCalled();
    for (const checkbox of screen.getAllByRole('checkbox')) expect(checkbox).toBeDisabled();
    expect(done()).toBeDisabled();

    finishWrite?.();
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });

  it('keeps the sheet open, with the ticks, and reports a failed local write', async () => {
    vi.mocked(setRoutineFolderContext).mockRejectedValueOnce(new Error('disk full'));
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<HomeRoutineContextSheet open value={[]} options={options} onClose={onClose} />);

    await user.click(screen.getByRole('checkbox', { name: 'UL' }));
    await user.click(done());

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Impossible de changer de dossier.',
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: TITLE })).toBeVisible();
    expect(screen.getByRole('checkbox', { name: 'UL' })).toBeEnabled();
    expect(screen.getByRole('checkbox', { name: 'UL' })).toHaveAttribute('aria-checked', 'true');
  });

  it('forgets the draft and the failure when the sheet is closed without being done', async () => {
    vi.mocked(setRoutineFolderContext).mockRejectedValueOnce(new Error('disk full'));
    const user = userEvent.setup();
    render(<SessionHarness value={['folder:ppl']} />);

    await user.click(screen.getByRole('checkbox', { name: 'UL' }));
    await user.click(done());
    expect(await screen.findByRole('status')).toBeVisible();

    const dialog = screen.getByRole('dialog', { name: TITLE });
    await user.click(screen.getAllByRole('button', { name: 'Fermer' }).at(-1)!);
    fireEvent.transitionEnd(dialog);
    await user.click(screen.getByRole('button', { name: 'Rouvrir' }));

    expect(await screen.findByRole('dialog', { name: TITLE })).toBeVisible();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    // Le coche posé sans valider n'est pas resté : on repart de ce qui est enregistré.
    expect(screen.getByRole('checkbox', { name: 'UL' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('checkbox', { name: 'PPL' })).toHaveAttribute('aria-checked', 'true');
  });

  it('exposes checkbox rows with 56px touch targets', () => {
    render(
      <HomeRoutineContextSheet open value={['root']} options={options} onClose={vi.fn()} />,
    );

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(3);
    for (const checkbox of checkboxes) expect(checkbox).toHaveClass('min-h-14');
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.getByRole('checkbox', { name: t('home.rootRoutineFolder') })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('checkbox', { name: 'UL' })).toHaveAttribute('aria-checked', 'false');
  });
});
