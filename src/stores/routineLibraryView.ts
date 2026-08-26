import { create } from 'zustand';

/**
 * L'état de lecture de la bibliothèque de routines : quels dossiers sont
 * repliés, et si l'ordre est déverrouillé.
 *
 * **Éphémère, et volontairement.** Aucun middleware `persist`, aucune table
 * Dexie : un redémarrage complet revient à « tout déplié, cadenas fermé ». Un
 * repli survivant à un kill de l'app ferait disparaître des routines sans que
 * rien ne l'explique, et un cadenas ouvert au lancement exposerait la
 * bibliothèque au premier glissement de pouce.
 *
 * Indépendant des verrous de l'éditeur de routine et de la séance en cours
 * (`useExerciseOrderLock`) : ce sont trois surfaces différentes, et les lier
 * ferait qu'ouvrir l'une ouvrirait les autres.
 */
type RoutineLibraryViewState = {
  reorderUnlocked: boolean;
  collapsedFolderIds: Set<string>;
  /** Ce qu'on rendra au reverrouillage. Vide le reste du temps. */
  rememberedCollapsedFolderIds: Set<string>;
  toggleFolder: (id: string) => void;
  collapseAll: (ids: readonly string[]) => void;
  expandAll: () => void;
  setReorderUnlocked: (unlocked: boolean) => void;
  reset: () => void;
};

const emptyIds = (): Set<string> => new Set<string>();

export const useRoutineLibraryView = create<RoutineLibraryViewState>((set) => ({
  reorderUnlocked: false,
  collapsedFolderIds: emptyIds(),
  rememberedCollapsedFolderIds: emptyIds(),

  // Les trois mutations de repli sont des no-op tant que l'ordre est
  // déverrouillé : la projection de réordonnancement doit contenir *toutes* les
  // routines, sinon un déplacement se calcule sur une liste amputée.
  toggleFolder: (id) =>
    set((state) => {
      if (state.reorderUnlocked) return state;
      const next = new Set(state.collapsedFolderIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { collapsedFolderIds: next };
    }),

  collapseAll: (ids) =>
    set((state) => (state.reorderUnlocked ? state : { collapsedFolderIds: new Set(ids) })),

  expandAll: () =>
    set((state) => (state.reorderUnlocked ? state : { collapsedFolderIds: emptyIds() })),

  setReorderUnlocked: (unlocked) =>
    set((state) => {
      // Sans ce garde, un second « verrouiller » écraserait les dossiers repliés
      // avec un souvenir déjà consommé, donc vide.
      if (state.reorderUnlocked === unlocked) return state;
      return unlocked
        ? {
            reorderUnlocked: true,
            rememberedCollapsedFolderIds: new Set(state.collapsedFolderIds),
            collapsedFolderIds: emptyIds(),
          }
        : {
            reorderUnlocked: false,
            collapsedFolderIds: new Set(state.rememberedCollapsedFolderIds),
            rememberedCollapsedFolderIds: emptyIds(),
          };
    }),

  reset: () =>
    set({
      reorderUnlocked: false,
      collapsedFolderIds: emptyIds(),
      rememberedCollapsedFolderIds: emptyIds(),
    }),
}));
