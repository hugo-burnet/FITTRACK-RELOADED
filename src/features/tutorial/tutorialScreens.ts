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
  | 'home'
  | 'routines'
  | 'routine-editor'
  | 'routine-picker'
  | 'programs'
  | 'program-editor'
  | 'program-detail'
  | 'workout'
  | 'workout-finish'
  | 'history'
  | 'history-detail'
  | 'history-edit'
  | 'history-import'
  | 'analytics'
  /** L'analyse qui porte à la fois un filtre de période et un export. */
  | 'analytics-weekly'
  | 'exercises'
  /** Le formulaire de création — `/exercises/:id/edit` est un autre écran. */
  | 'exercise-form'
  | 'settings'
  | 'knowledge'
  /** Une commande présente sur toute l'application — la barre de séance active. */
  | 'anywhere';

/**
 * Ce qu'il faut savoir en plus du nom de l'écran pour en faire une adresse.
 *
 * Les deux identifiants sont persistés dans la progression : une mission
 * reprise après un rechargement doit retrouver la routine ou le programme dont
 * elle parle, faute de quoi `/routines/:id` n'est pas une adresse mais un
 * gabarit.
 */
export interface TutorialRouteContext {
  routineId: string | null;
  programId: string | null;
  /** La séance archivée dont une mission d'historique parle. */
  workoutId: string | null;
}

/** L'identifiant de routine lu dans l'URL, `null` hors de l'éditeur. */
export function routineIdFromPath(pathname: string): string | null {
  const match = /^\/routines\/([^/]+)/.exec(pathname);
  const id = match?.[1];
  // `new` n'existe pas côté routines, mais un segment réservé qui arriverait ici
  // désignerait un écran et non une routine : ne rien retenir vaut mieux que
  // retenir une adresse morte vers laquelle on renverrait ensuite l'utilisateur.
  return id === undefined || id === 'new' ? null : id;
}

/** La séance archivée lue dans l'URL — `import` est un écran, pas une séance. */
export function workoutIdFromPath(pathname: string): string | null {
  const match = /^\/history\/([^/]+)/.exec(pathname);
  const id = match?.[1];
  return id === undefined || id === 'import' ? null : id;
}

/** L'identifiant de programme lu dans l'URL — `/programs/new` n'en est pas un. */
export function programIdFromPath(pathname: string): string | null {
  const match = /^\/programs\/([^/]+)/.exec(pathname);
  const id = match?.[1];
  return id === undefined || id === 'new' ? null : id;
}

/**
 * L'adresse où emmener l'utilisateur pour cette étape. `null` quand elle n'est
 * pas connue — l'éditeur d'une routine sans routine retenue — auquel cas on ne
 * navigue nulle part plutôt que d'inventer une destination.
 *
 * `program-editor` est la seule exception assumée : sans programme retenu,
 * l'assistant de création *est* sa page, et c'est exactement là qu'une mission
 * « créer un bloc » doit commencer.
 */
export function pathForScreen(
  screen: TutorialScreen,
  context: TutorialRouteContext,
): string | null {
  const { routineId, programId, workoutId } = context;
  switch (screen) {
    case 'home':
      return '/';
    case 'routines':
      return '/routines';
    case 'routine-editor':
      return routineId === null ? null : `/routines/${routineId}`;
    case 'routine-picker':
      return routineId === null ? null : `/routines/${routineId}/add`;
    case 'programs':
      return '/programs';
    case 'program-editor':
      return programId === null ? '/programs/new' : `/programs/${programId}/edit`;
    case 'program-detail':
      return programId === null ? null : `/programs/${programId}`;
    case 'workout':
      return '/workout';
    case 'workout-finish':
      return '/workout/finish';
    case 'history':
      return '/history';
    case 'history-detail':
      return workoutId === null ? null : `/history/${workoutId}`;
    case 'history-edit':
      return workoutId === null ? null : `/history/${workoutId}/edit`;
    case 'history-import':
      return '/history/import';
    case 'analytics':
      return '/analytics';
    case 'analytics-weekly':
      return '/analytics/weekly';
    case 'exercises':
      return '/exercises';
    case 'exercise-form':
      return '/exercises/new';
    case 'settings':
      return '/settings';
    case 'knowledge':
      return '/knowledge';
    case 'anywhere':
      return null;
  }
}

/**
 * L'utilisateur est-il là où l'étape a un sens ?
 *
 * Strict, désormais, y compris vers le bas. La version tolérante laissait
 * l'éditeur d'une routine « tenir » le sélecteur d'exercices, parce que c'était
 * l'étape elle-même qui venait de l'ouvrir et qu'un retour l'aurait refermé.
 * Ce n'est plus le compromis à faire : le sélecteur a son propre écran, l'étape
 * qui parle de lui le déclare, et le retour en arrière est empêché là où il
 * doit l'être — par `movesForward`, qui ne remonte jamais.
 *
 * Ce que la tolérance coûtait : une consigne lue devant un écran qui ne la
 * contient pas. Une liste n'est pas un éditeur, une création n'est pas un
 * détail, et le tutoriel n'a rien à dire tant qu'il n'est pas au bon endroit.
 */
export function screenHolds(
  pathname: string,
  screen: TutorialScreen,
  context: TutorialRouteContext,
): boolean {
  switch (screen) {
    case 'home':
      return pathname === '/';
    case 'routines':
      return pathname === '/routines';
    case 'routine-editor': {
      const own = routineIdFromPath(pathname);
      if (own === null || pathname !== `/routines/${own}`) return false;
      return context.routineId === null || own === context.routineId;
    }
    case 'routine-picker': {
      const own = routineIdFromPath(pathname);
      if (own === null || pathname !== `/routines/${own}/add`) return false;
      return context.routineId === null || own === context.routineId;
    }
    case 'programs':
      return pathname === '/programs';
    case 'program-editor': {
      if (pathname === '/programs/new') return true;
      const own = programIdFromPath(pathname);
      if (own === null || pathname !== `/programs/${own}/edit`) return false;
      return context.programId === null || own === context.programId;
    }
    case 'program-detail': {
      const own = programIdFromPath(pathname);
      if (own === null || pathname !== `/programs/${own}`) return false;
      return context.programId === null || own === context.programId;
    }
    case 'workout':
      return pathname === '/workout' || pathname === '/workout/add';
    case 'workout-finish':
      return pathname.startsWith('/workout/finish');
    case 'history':
      return pathname === '/history';
    case 'history-detail': {
      const own = workoutIdFromPath(pathname);
      if (own === null || pathname !== `/history/${own}`) return false;
      return context.workoutId === null || own === context.workoutId;
    }
    case 'history-edit': {
      const own = workoutIdFromPath(pathname);
      if (own === null || pathname !== `/history/${own}/edit`) return false;
      return context.workoutId === null || own === context.workoutId;
    }
    case 'history-import':
      return pathname === '/history/import';
    case 'analytics':
      return pathname === '/analytics';
    case 'analytics-weekly':
      return pathname === '/analytics/weekly';
    case 'exercises':
      return pathname === '/exercises';
    case 'exercise-form':
      return pathname === '/exercises/new';
    case 'settings':
      return pathname === '/settings';
    case 'knowledge':
      return pathname === '/knowledge';
    case 'anywhere':
      return true;
  }
}

/**
 * Le tutoriel n'a jamais le droit de faire **reculer** l'utilisateur.
 *
 * `TUT-CAM-01` vise le bouton de création, sur la liste, mais s'achève sur
 * `routine-created` — c'est-à-dire dans l'éditeur, une fois la routine écrite
 * en base, plusieurs images après l'arrivée. Entre les deux, l'étape courante
 * désigne encore la liste : sans cette règle, la visite renvoyait à la liste
 * quelqu'un qui venait d'ouvrir exactement ce qu'on lui demandait d'ouvrir.
 *
 * Un écran plus profond que la destination compte donc comme l'ayant déjà
 * dépassée. Un déplacement demandé explicitement — une mission choisie dans
 * l'aide de la page — ne passe pas par ici : c'est l'utilisateur qui l'a
 * demandé, il peut revenir en arrière.
 */
export function movesForward(pathname: string, destination: string): boolean {
  return pathname !== destination && !pathname.startsWith(`${destination}/`);
}
