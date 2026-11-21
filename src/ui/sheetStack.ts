/**
 * La pile des feuilles ouvertes, pour que la plateforme sache qu'il y en a une.
 *
 * Pourquoi : le retour d'Android arrive hors de React. Sans ce registre il ne
 * voyait que la route, et fermait l'écran (la séance) derrière une feuille au
 * lieu de la feuille. `Sheet` est le conteneur de tous les sélecteurs, boîtes de
 * confirmation et menus : s'y inscrire là couvre chacun d'eux, sans que aucun
 * écran n'ait à y penser.
 */
const stack: Array<() => void> = [];

/** Inscrit une feuille ouverte ; rend la fonction qui la retire (idempotente). */
export function registerSheet(close: () => void): () => void {
  stack.push(close);
  return () => {
    const index = stack.lastIndexOf(close);
    if (index !== -1) stack.splice(index, 1);
  };
}

export function hasOpenSheet(): boolean {
  return stack.length > 0;
}

/** Ferme la feuille la plus récente. `false` s'il n'y en avait aucune. */
export function closeTopSheet(): boolean {
  const close = stack.at(-1);
  if (close === undefined) return false;
  close();
  return true;
}
