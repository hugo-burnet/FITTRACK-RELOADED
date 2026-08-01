import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { RoutineSummary } from '@/data/repositories/routines';
import type { Routine, RoutineFolder } from '@/data/types';
import { RoutineCollection } from './RoutineCollection';

const stamps = {
  createdAt: 1,
  updatedAt: 1,
  deletedAt: 0,
};

function routine(id: string, name: string, folderId = '', order = 0): Routine {
  return {
    ...stamps,
    id,
    name,
    folderId,
    order,
    version: 1,
  };
}

function folder(id: string, name: string, order = 0): RoutineFolder {
  return { ...stamps, id, name, order };
}

function summary(value: Routine, exerciseCount = 1, setCount = 2): RoutineSummary {
  return { routine: value, exerciseCount, setCount };
}

describe('RoutineCollection', () => {
  it('expose les deux intentions de l\u2019\u00e9tat vide', async () => {
    const user = userEvent.setup();
    const onIntent = vi.fn();
    render(<RoutineCollection summaries={[]} folders={[]} onIntent={onIntent} />);

    await user.click(screen.getByRole('button', { name: 'Routine vide' }));
    await user.click(screen.getByRole('button', { name: 'Partir d\u2019un mod\u00e8le' }));

    expect(onIntent).toHaveBeenNthCalledWith(1, { kind: 'createBlank' });
    expect(onIntent).toHaveBeenNthCalledWith(2, { kind: 'showTemplates' });
  });

  it('rend la racine puis chaque dossier dans l\u2019ordre re\u00e7u', () => {
    const rootRoutine = routine('routine-root', 'Racine');
    const pushFolder = folder('folder-push', 'Push');
    const pushRoutine = routine('routine-push', 'Pouss\u00e9e', pushFolder.id, 1);
    const legsFolder = folder('folder-legs', 'Jambes', 1);
    const legsRoutine = routine('routine-legs', 'Squat', legsFolder.id, 1);
    render(
      <RoutineCollection
        summaries={[summary(rootRoutine), summary(pushRoutine), summary(legsRoutine)]}
        folders={[pushFolder, legsFolder]}
        onIntent={vi.fn()}
      />,
    );

    const rootHeading = screen.getByRole('heading', { name: 'Sans dossier' });
    const rootName = screen.getByText('Racine');
    const pushHeading = screen.getByRole('heading', { name: 'Push' });
    const pushName = screen.getByText('Pouss\u00e9e');
    const legsHeading = screen.getByRole('heading', { name: 'Jambes' });
    const legsName = screen.getByText('Squat');

    expect(rootHeading.compareDocumentPosition(rootName) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(rootName.compareDocumentPosition(pushHeading) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(pushHeading.compareDocumentPosition(pushName) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(pushName.compareDocumentPosition(legsHeading) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(legsHeading.compareDocumentPosition(legsName) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
  });

  it('rend une routine racine sans titre lorsqu’aucun dossier n’existe', () => {
    render(
      <RoutineCollection
        summaries={[summary(routine('routine-root', 'Racine'))]}
        folders={[]}
        onIntent={vi.fn()}
      />,
    );

    expect(screen.getByText('Racine')).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Sans dossier' })).not.toBeInTheDocument();
  });

  it('rend la racine m\u00eame vide d\u00e8s qu\u2019un dossier existe', () => {
    render(
      <RoutineCollection
        summaries={[]}
        folders={[folder('folder-push', 'Push')]}
        onIntent={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Sans dossier' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Push' })).toBeVisible();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('traduit les ouvertures en intentions portant les entit\u00e9s courantes', async () => {
    const user = userEvent.setup();
    const onIntent = vi.fn();
    const pushFolder = folder('folder-push', 'Push');
    const pushRoutine = routine('routine-push', 'Pouss\u00e9e', pushFolder.id);
    render(
      <RoutineCollection
        summaries={[summary(pushRoutine)]}
        folders={[pushFolder]}
        onIntent={onIntent}
      />,
    );

    await user.click(screen.getByText('Pouss\u00e9e'));
    await user.click(screen.getByRole('button', { name: 'Routine \u2014 Pouss\u00e9e' }));
    await user.click(screen.getByRole('button', { name: 'Dossier \u2014 Push' }));

    expect(onIntent).toHaveBeenNthCalledWith(1, {
      kind: 'openRoutine',
      routine: pushRoutine,
    });
    expect(onIntent).toHaveBeenNthCalledWith(2, {
      kind: 'openRoutineActions',
      routine: pushRoutine,
    });
    expect(onIntent).toHaveBeenNthCalledWith(3, {
      kind: 'openFolderActions',
      folder: pushFolder,
    });
  });

  it('classe une routine racine dans le dossier franchi au clavier', async () => {
    const user = userEvent.setup();
    const onIntent = vi.fn();
    const rootRoutine = routine('routine-root', 'Racine');
    const pushFolder = folder('folder-push', 'Push');
    const pushRoutine = routine('routine-push', 'Pouss\u00e9e', pushFolder.id, 1);
    const summaries = Object.freeze([
      Object.freeze(summary(rootRoutine)),
      Object.freeze(summary(pushRoutine)),
    ]);
    const folders = Object.freeze([Object.freeze(pushFolder)]);
    render(
      <RoutineCollection summaries={summaries} folders={folders} onIntent={onIntent} />,
    );

    screen.getByRole('button', { name: 'D\u00e9placer Racine' }).focus();
    await user.keyboard('{ArrowDown}');

    expect(onIntent).toHaveBeenLastCalledWith({
      kind: 'reorderRoutines',
      placement: [
        { id: rootRoutine.id, folderId: pushFolder.id },
        { id: pushRoutine.id, folderId: pushFolder.id },
      ],
    });
    expect(summaries[0]?.routine.folderId).toBe('');
    expect(folders[0]?.id).toBe(pushFolder.id);
  });

  it('reclasse une routine dans la racine en franchissant son dossier', async () => {
    const user = userEvent.setup();
    const onIntent = vi.fn();
    const pushFolder = folder('folder-push', 'Push');
    const pushRoutine = routine('routine-push', 'Pouss\u00e9e', pushFolder.id);
    render(
      <RoutineCollection
        summaries={[summary(pushRoutine)]}
        folders={[pushFolder]}
        onIntent={onIntent}
      />,
    );

    screen.getByRole('button', { name: 'D\u00e9placer Pouss\u00e9e' }).focus();
    await user.keyboard('{ArrowUp}');

    expect(onIntent).toHaveBeenLastCalledWith({
      kind: 'reorderRoutines',
      placement: [{ id: pushRoutine.id, folderId: '' }],
    });
  });
});
