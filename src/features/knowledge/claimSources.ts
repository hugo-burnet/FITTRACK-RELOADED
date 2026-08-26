// Où va un identifiant de traçabilité, en toutes lettres.
//
// L'article affichait « claim.6f33aaaeadcc53d9 · claim.9b4fa84cb3a9dcbf · … »
// sous chaque paragraphe. Trois hashes illisibles qui, vérification faite,
// désignaient tous la même section du corpus : la traçabilité était présente et
// ne servait à personne.
//
// La correspondance vit dans `evidence-index.json` et `f1-programming.json`,
// 1,1 Mo à eux deux. Les embarquer sur la route d'un article pour afficher une
// ligne de texte n'était pas envisageable dans une app qui doit s'ouvrir dans un
// sous-sol, d'où la projection de 21 Ko que `kb:check-articles` tient à jour.
import document from './claim-sources.json';

type ClaimSourceDocument = {
  readonly labels: readonly string[];
  readonly byId: Readonly<Record<string, number>>;
};

const { labels, byId } = document as ClaimSourceDocument;

export type ResolvedSource = {
  /** Le segment le plus profond du chemin — « 1.1 Pectoraux », pas tout le titre. */
  label: string;
  /** Combien d'affirmations de ce bloc viennent de là. */
  count: number;
};

/**
 * Regroupe des identifiants par source, dans leur ordre d'apparition.
 *
 * Un identifiant sans correspondance garde le sien : le build vérifie déjà que
 * les 408 affirmations et les 102 fiches sont couvertes, mais faire disparaître
 * une source en silence serait le seul défaut vraiment grave de ce module.
 */
export function resolveSources(ids: readonly string[]): ResolvedSource[] {
  const counts = new Map<string, number>();
  for (const id of ids) {
    const at = byId[id];
    const label = at === undefined ? id : (labels[at] ?? id);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts].map(([label, count]) => ({ label, count }));
}
