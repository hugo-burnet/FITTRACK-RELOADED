import { beforeEach, describe, expect, it } from 'vitest';
import { useExerciseOrderLock } from './exerciseOrderLock';
import { useRoutineLibraryView } from './routineLibraryView';

const state = () => useRoutineLibraryView.getState();

describe('routineLibraryView', () => {
  beforeEach(() => {
    useRoutineLibraryView.getState().reset();
    useExerciseOrderLock.getState().reset();
  });

  it('part verrouillé et tout déplié', () => {
    expect(state().reorderUnlocked).toBe(false);
    expect(state().collapsedFolderIds.size).toBe(0);
  });

  it('replie et déplie un dossier', () => {
    state().toggleFolder('folder-a');
    expect(state().collapsedFolderIds).toEqual(new Set(['folder-a']));

    state().toggleFolder('folder-a');
    expect(state().collapsedFolderIds.size).toBe(0);
  });

  it('replie et déplie tout, racine comprise', () => {
    state().collapseAll(['root', 'folder-a']);
    expect(state().collapsedFolderIds).toEqual(new Set(['root', 'folder-a']));

    state().expandAll();
    expect(state().collapsedFolderIds.size).toBe(0);
  });

  /**
   * L'invariant qui porte tout : **on ne calcule jamais un déplacement sur une
   * liste dont une partie est invisible.** Déverrouiller déplie donc tout, et
   * gèle le repli le temps du geste ; reverrouiller rend l'état d'avant.
   */
  it('déplie tout en déverrouillant, et restaure le repli en reverrouillant', () => {
    state().toggleFolder('folder-a');

    state().setReorderUnlocked(true);
    expect(state().collapsedFolderIds.size).toBe(0);
    expect(state().rememberedCollapsedFolderIds).toEqual(new Set(['folder-a']));

    state().setReorderUnlocked(false);
    expect(state().collapsedFolderIds).toEqual(new Set(['folder-a']));
    expect(state().rememberedCollapsedFolderIds.size).toBe(0);
  });

  it('ignore tout repli tant que l’ordre est déverrouillé', () => {
    state().setReorderUnlocked(true);

    state().toggleFolder('folder-b');
    state().collapseAll(['root', 'folder-b']);
    expect(state().collapsedFolderIds.size).toBe(0);

    state().setReorderUnlocked(false);
    expect(state().collapsedFolderIds.size).toBe(0);
  });

  it('ne fait rien quand on redemande l’état déjà en place', () => {
    state().toggleFolder('folder-a');
    state().setReorderUnlocked(false);

    // Sans ce garde, un second « verrouiller » écraserait les dossiers repliés
    // avec un souvenir vide.
    expect(state().collapsedFolderIds).toEqual(new Set(['folder-a']));
  });

  it('reste indépendant du verrou de l’éditeur et de celui de la séance', () => {
    state().setReorderUnlocked(true);

    expect(useExerciseOrderLock.getState().unlocked.routine).toBe(false);
    expect(useExerciseOrderLock.getState().unlocked.workout).toBe(false);

    useExerciseOrderLock.getState().toggle('routine');
    expect(state().reorderUnlocked).toBe(true);

    state().setReorderUnlocked(false);
    expect(useExerciseOrderLock.getState().unlocked.routine).toBe(true);
  });

  it('revient à l’état de démarrage après un reset', () => {
    state().toggleFolder('folder-a');
    state().setReorderUnlocked(true);

    state().reset();

    expect(state().reorderUnlocked).toBe(false);
    expect(state().collapsedFolderIds.size).toBe(0);
    expect(state().rememberedCollapsedFolderIds.size).toBe(0);
  });
});
