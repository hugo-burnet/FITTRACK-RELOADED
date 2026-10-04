/**
 * Les dossiers dont l'accueil tire sa suggestion « À lancer ».
 *
 * **Pourquoi plusieurs.** Le contexte a d'abord été un seul dossier. Un cycle qui
 * traverse deux dossiers — quatre séances « haut / bas » dans l'un, six
 * « push / pull / jambes » dans l'autre, une semaine sur deux — n'y entrait
 * pas : la suggestion ne voyait jamais que la moitié du cycle. Avec la routine
 * réalisée le moins récemment parmi **tous** les dossiers du cycle, la
 * suggestion est exactement la séance suivante.
 *
 * Fonctions pures : la forme enregistrée, sa lecture défensive, et le passage
 * entre elle et les valeurs que la feuille de choix coche. Rien ici ne lit la
 * base — `getHomeDashboard` et la feuille s'en servent chacun de leur côté.
 */

/**
 * Ce que l'accueil enregistre. Les deux premières formes sont celles de l'époque
 * du dossier unique ; elles restent lues, et écrites quand le choix est unique,
 * pour qu'un réglage existant n'ait besoin d'aucune migration.
 */
export type RoutineFolderContext =
  | { kind: 'root' }
  | { kind: 'folder'; folderId: string }
  | { kind: 'folders'; folderIds: string[]; root: boolean };

/** Une ligne de la feuille de choix : la racine « Sans dossier », ou un dossier. */
export type RoutineContextValue = 'root' | `folder:${string}`;

const FOLDER_PREFIX = 'folder:';

const isId = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

/**
 * Lit un réglage sans lui faire confiance : un fichier de sauvegarde, une
 * version plus ancienne ou plus récente peuvent y avoir écrit n'importe quoi, et
 * l'accueil retombe alors sur « aucun choix » — il redemande, il ne plante pas.
 */
export function normalizeRoutineFolderContext(value: unknown): RoutineFolderContext | null {
  if (typeof value !== 'object' || value === null) return null;
  const candidate = value as Record<string, unknown>;

  if (candidate.kind === 'root') return { kind: 'root' };
  if (candidate.kind === 'folder') {
    return isId(candidate.folderId) ? { kind: 'folder', folderId: candidate.folderId } : null;
  }
  if (candidate.kind === 'folders') {
    const { folderIds, root } = candidate;
    if (!Array.isArray(folderIds) || !folderIds.every(isId)) return null;
    if (root !== undefined && typeof root !== 'boolean') return null;

    const unique = [...new Set<string>(folderIds)];
    const includesRoot = root === true;
    // Une sélection vide ne choisit rien : c'est l'absence de choix, pas un choix.
    return unique.length > 0 || includesRoot
      ? { kind: 'folders', folderIds: unique, root: includesRoot }
      : null;
  }

  return null;
}

/** Ce qu'un réglage coche dans la feuille : les dossiers dans l'ordre écrit, la racine en dernier. */
export function routineContextValues(context: RoutineFolderContext | null): RoutineContextValue[] {
  if (context === null) return [];
  if (context.kind === 'root') return ['root'];
  if (context.kind === 'folder') return [`${FOLDER_PREFIX}${context.folderId}`];
  return [
    ...context.folderIds.map((folderId): RoutineContextValue => `${FOLDER_PREFIX}${folderId}`),
    ...(context.root ? (['root'] as const) : []),
  ];
}

/**
 * Le réglage à enregistrer pour des lignes cochées, `null` quand il n'y en a
 * aucune — l'appelant n'écrit alors rien : fermer une feuille vide ne choisit
 * pas à la place de l'utilisateur.
 *
 * Un choix unique garde sa forme historique : pour qui n'a jamais coché qu'un
 * dossier, rien ne change dans ce qui est enregistré.
 */
export function routineContextFromValues(
  values: readonly RoutineContextValue[],
): RoutineFolderContext | null {
  const unique = [...new Set(values)];
  const [only] = unique;

  if (only === undefined) return null;
  if (unique.length === 1) {
    return only === 'root'
      ? { kind: 'root' }
      : { kind: 'folder', folderId: only.slice(FOLDER_PREFIX.length) };
  }

  return {
    kind: 'folders',
    folderIds: unique
      .filter((value): value is `folder:${string}` => value !== 'root')
      .map((value) => value.slice(FOLDER_PREFIX.length)),
    root: unique.includes('root'),
  };
}
