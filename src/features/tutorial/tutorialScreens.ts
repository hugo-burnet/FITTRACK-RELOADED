/**
 * Où vit la commande dont une étape parle — et donc où il faut être pour la voir.
 *
 * Les missions ne connaissaient qu'un `routePrefix` par mission. Cinq étapes
 * sur douze visent des ancres qui n'existent que dans l'éditeur d'une routine,
 * `/routines/:id` ; depuis la liste `/routines` le préfixe correspondait déjà,
 * donc rien ne naviguait, aucune cible n'était trouvée, et le coach disait
 * « ajoute un exercice à cette routine » devant une liste où il n'y a pas de
 * « cette routine ». La mission ne pouvait alors plus avancer du tout.
 *
 * Un écran, pas un préfixe : chaque étape déclare le sien, on sait donc y
 * emmener l'utilisateur (`pathForScreen`) et savoir s'il y est (`screenHolds`).
 */
export type TutorialScreen =
  | 'routines'
  | 'routine-editor'
  | 'workout'
  | 'workout-finish'
  | 'settings'
  /** Une commande présente sur toute l'application — la barre de séance active. */
  | 'anywhere';

/** L'identifiant de routine lu dans l'URL, `null` hors de l'éditeur. */
export function routineIdFromPath(pathname: string): string | null {
  const match = /^\/routines\/([^/]+)/.exec(pathname);
  const id = match?.[1];
  // `new` n'existe pas côté routines, mais un segment réservé qui arriverait ici
  // désignerait un écran et non une routine : ne rien retenir vaut mieux que
  // retenir une adresse morte vers laquelle on renverrait ensuite l'utilisateur.
  return id === undefined || id === 'new' ? null : id;
}

/**
 * L'adresse où emmener l'utilisateur pour cette étape. `null` quand elle n'est
 * pas connue — l'éditeur d'une routine sans routine retenue — auquel cas on ne
 * navigue nulle part plutôt que d'inventer une destination.
 */
export function pathForScreen(screen: TutorialScreen, routineId: string | null): string | null {
  switch (screen) {
    case 'routines':
      return '/routines';
    case 'routine-editor':
      return routineId === null ? null : `/routines/${routineId}`;
    case 'workout':
      return '/workout';
    case 'workout-finish':
      return '/workout/finish';
    case 'settings':
      return '/settings';
    case 'anywhere':
      return null;
  }
}

/**
 * L'utilisateur est-il là où l'étape a un sens ?
 *
 * Tolérant vers le bas, strict vers le côté. Le sélecteur d'exercices vit sous
 * `/routines/:id/add` : c'est *l'étape elle-même* qui vient de l'ouvrir, donc
 * le renvoyer à l'éditeur casserait le geste qu'on lui demande. En revanche la
 * liste `/routines` n'est pas l'éditeur, et c'est toute la différence que le
 * préfixe ne savait pas faire.
 */
export function screenHolds(
  pathname: string,
  screen: TutorialScreen,
  routineId: string | null,
): boolean {
  switch (screen) {
    case 'routines':
      return pathname === '/routines';
    case 'routine-editor': {
      const own = routineIdFromPath(pathname);
      if (own === null) return false;
      return routineId === null || own === routineId;
    }
    case 'workout':
      return pathname === '/workout' || pathname === '/workout/add';
    case 'workout-finish':
      return pathname.startsWith('/workout/finish');
    case 'settings':
      return pathname.startsWith('/settings');
    case 'anywhere':
      return true;
  }
}
