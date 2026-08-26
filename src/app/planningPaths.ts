/**
 * Planifier couvre trois routes canoniques, restées telles quelles pour ne pas
 * migrer les liens existants : la bibliothèque de routines, les programmes, et
 * la partie programmation du wiki.
 *
 * La barre basse doit les traiter comme un seul espace — sinon l'onglet s'éteint
 * dès qu'on ouvre le Guide, et l'utilisateur ne sait plus où il se trouve.
 *
 * Le prédicat vit à part de `BottomNav` parce qu'un fichier qui exporte autre
 * chose que des composants casse le rafraîchissement à chaud.
 */
export const isPlanningPath = (pathname: string): boolean =>
  pathname.startsWith('/routines') ||
  pathname.startsWith('/programs') ||
  pathname.startsWith('/knowledge/programmation');
