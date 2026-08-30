import type { RoutineSummary } from '@/data/repositories/routines';
import type { RoutineFolder } from '@/data/types';

/**
 * Les dossiers qui portent une flèche de repli — et `root` s'il y a lieu.
 *
 * La racine n'est pas un dossier en base : c'est `folderId === ''`, et elle ne
 * gagne un en-tête repliable que lorsqu'un vrai dossier existe à côté d'elle.
 * Une liste sans dossier n'a rien à replier, et lui donner une flèche unique
 * aurait fait apparaître une commande qui ne sépare rien.
 *
 * Dans son propre module plutôt qu'à côté du composant qui la consomme : un
 * fichier qui exporte une fonction **et** un composant coupe le rafraîchissement
 * à chaud de tout le fichier, ce que la règle `react-refresh` signalait.
 */
export function collapsibleRoutineFolderIds(
  summaries: readonly RoutineSummary[],
  folders: readonly RoutineFolder[],
): string[] {
  const hasRootRoutines = summaries.some((summary) => summary.routine.folderId === '');
  return [
    ...(hasRootRoutines && folders.length > 0 ? ['root'] : []),
    ...folders.map(({ id }) => id),
  ];
}
