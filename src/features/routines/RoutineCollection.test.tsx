import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { RoutineSummary } from '@/data/repositories/routines';
import type { Routine, RoutineFolder } from '@/data/types';
import { RoutineCollection } from './RoutineCollection';
import { collapsibleRoutineFolderIds } from './collapsibleFolders';
import type { RoutineCollectionProps } from './RoutineCollection';

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
  };
}

function folder(id: string, name: string, order = 0): RoutineFolder {
  return { ...stamps, id, name, order };
}

function summary(value: Routine, exerciseCount = 1, setCount = 2): RoutineSummary {
  return { routine: value, exerciseCount, setCount };
}

function Collection(
  props: Pick<RoutineCollectionProps, 'summaries' | 'folders' | 'onIntent'> &
    Partial<RoutineCollectionProps>,
) {
  return (
    <RoutineCollection
      reorderUnlocked
      collapsedFolderIds={new Set()}
      onToggleFolder={() => {}}
      {...props}
    />
  );
}

describe('RoutineCollection', () => {
  it('expose les deux intentions de l\u2019\u00e9tat vide', async () => {
    const user = userEvent.setup();
    const onIntent = vi.fn();
    render(<Collection summaries={[]} folders={[]} onIntent={onIntent} />);

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
      <Collection
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

    expect(
      rootHeading.compareDocumentPosition(rootName) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
    expect(
      rootName.compareDocumentPosition(pushHeading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
    expect(
      pushHeading.compareDocumentPosition(pushName) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
    expect(
      pushName.compareDocumentPosition(legsHeading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
    expect(
      legsHeading.compareDocumentPosition(legsName) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
  });

  it('rend une routine racine sans titre lorsqu’aucun dossier n’existe', () => {
    render(
      <Collection
        summaries={[summary(routine('routine-root', 'Racine'))]}
        folders={[]}
        onIntent={vi.fn()}
      />,
    );

    expect(screen.getByText('Racine')).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Sans dossier' })).not.toBeInTheDocument();
  });

  it('omet la racine vide même lorsqu’un dossier existe', () => {
    const push = folder('folder-push', 'Push');
    render(<Collection summaries={[]} folders={[push]} onIntent={vi.fn()} />);

    expect(screen.queryByRole('heading', { name: 'Sans dossier' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Push' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Routine vide' })).not.toBeInTheDocument();
  });

  it('ne compte la racine parmi les dossiers repliables que si elle contient une routine', () => {
    const push = folder('folder-push', 'Push');
    const rootRoutine = routine('routine-root', 'Racine');

    expect(collapsibleRoutineFolderIds([], [push])).toEqual([push.id]);
    expect(collapsibleRoutineFolderIds([summary(rootRoutine)], [push])).toEqual(['root', push.id]);
  });

  it('traduit les ouvertures en intentions portant les entit\u00e9s courantes', async () => {
    const user = userEvent.setup();
    const onIntent = vi.fn();
    const pushFolder = folder('folder-push', 'Push');
    const pushRoutine = routine('routine-push', 'Pouss\u00e9e', pushFolder.id);
    render(
      <Collection summaries={[summary(pushRoutine)]} folders={[pushFolder]} onIntent={onIntent} />,
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
    render(<Collection summaries={summaries} folders={folders} onIntent={onIntent} />);

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
      <Collection summaries={[summary(pushRoutine)]} folders={[pushFolder]} onIntent={onIntent} />,
    );

    screen.getByRole('button', { name: 'D\u00e9placer Pouss\u00e9e' }).focus();
    await user.keyboard('{ArrowUp}');

    expect(onIntent).toHaveBeenLastCalledWith({
      kind: 'reorderRoutines',
      placement: [{ id: pushRoutine.id, folderId: '' }],
    });
  });
});

describe('RoutineCollection repli et verrou', () => {
  const rootRoutine = routine('routine-root', 'Racine');
  const pushFolder = folder('folder-push', 'Push');
  const pushRoutine = routine('routine-push', 'Poussée', pushFolder.id, 1);
  const summaries = [summary(rootRoutine), summary(pushRoutine)];
  const folders = [pushFolder];

  it('annonce l’état de chaque dossier et son nombre de routines', () => {
    render(
      <Collection
        summaries={summaries}
        folders={folders}
        onIntent={vi.fn()}
        reorderUnlocked={false}
      />,
    );

    const header = screen.getByRole('button', { expanded: true, name: /Push/u });
    expect(header).toHaveTextContent('1');
    expect(screen.getByRole('button', { expanded: true, name: /Sans dossier/u })).toBeVisible();
  });

  it('masque le contenu d’un dossier replié sans toucher au repository', async () => {
    const user = userEvent.setup();
    const onIntent = vi.fn();
    const onToggleFolder = vi.fn();
    render(
      <Collection
        summaries={summaries}
        folders={folders}
        onIntent={onIntent}
        reorderUnlocked={false}
        collapsedFolderIds={new Set(['folder-push'])}
        onToggleFolder={onToggleFolder}
      />,
    );

    expect(screen.queryByText('Poussée')).toBeNull();
    expect(screen.getByText('Racine')).toBeVisible();
    expect(screen.getByRole('button', { expanded: false, name: /Push/u })).toBeVisible();

    await user.click(screen.getByRole('button', { expanded: false, name: /Push/u }));
    expect(onToggleFolder).toHaveBeenCalledWith('folder-push');
    // Replier est un état de lecture : aucune écriture ne doit partir.
    expect(onIntent).not.toHaveBeenCalled();
  });

  it('ne rend aucune poignée quand l’ordre est verrouillé', () => {
    render(
      <Collection
        summaries={summaries}
        folders={folders}
        onIntent={vi.fn()}
        reorderUnlocked={false}
      />,
    );

    expect(screen.queryByRole('button', { name: /Déplacer/u })).toBeNull();
  });

  it('gèle le repli pendant un réordonnancement', () => {
    render(<Collection summaries={summaries} folders={folders} onIntent={vi.fn()} />);

    // Un dossier qui se ferme sous un doigt en train de déplacer une routine
    // ferait disparaître la cible du geste.
    expect(screen.getByRole('button', { expanded: true, name: /Push/u })).toBeDisabled();
  });

  it('garde la liste complète pendant un réordonnancement, repli ignoré', () => {
    // L'invariant du design : un déplacement ne se calcule jamais sur une liste
    // amputée. La racine est marquée repliée alors que l'ordre est déverrouillé
    // — une combinaison que le store empêche, et que le composant doit quand
    // même traiter sans perdre une routine.
    const onIntent = vi.fn();
    render(
      <Collection
        summaries={summaries}
        folders={folders}
        onIntent={onIntent}
        collapsedFolderIds={new Set(['root'])}
      />,
    );

    expect(screen.getByText('Racine')).toBeVisible();
    expect(screen.getByText('Poussée')).toBeVisible();

    fireEvent.keyDown(screen.getByRole('button', { name: 'Déplacer Racine' }), {
      key: 'ArrowDown',
    });

    // Les deux routines sont dans le placement, avec leur dossier d'arrivée.
    // Un placement calculé sur la liste visible en aurait perdu une.
    expect(onIntent).toHaveBeenCalledWith({
      kind: 'reorderRoutines',
      placement: [
        { id: 'routine-root', folderId: 'folder-push' },
        { id: 'routine-push', folderId: 'folder-push' },
      ],
    });
  });
});
