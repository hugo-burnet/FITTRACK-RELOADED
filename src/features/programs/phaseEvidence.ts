// Ce que le corpus dit de la phase que tu traverses.
//
// L'app savait planifier une semaine de décharge, et le wiki savait ce que la
// littérature en dit — sans qu'aucun des deux ne mentionne l'autre. Le lecteur
// devait deviner qu'une réponse existait, puis aller la chercher dans un autre
// écran. Une page qu'on ne trouve pas ne vaut pas mieux qu'une page absente.
//
// La table ne couvre PAS les six phases. Une phase n'y figure que si une
// section du corpus la traite vraiment : `construction` et `test` n'ont pas de
// section dédiée, et les envoyer vers un chapitre vaguement voisin serait pire
// que de ne rien proposer — ça apprendrait au lecteur que le lien ment.
import { findProgrammingSection } from '@/features/knowledge/programmingIndex';
import { articleHref, findArticleForRow } from '@/features/knowledge/articleCatalogue';
import type { ProgramPhase } from '@/data/types';

const PHASE_SECTIONS: Partial<Record<ProgramPhase, string>> = {
  deload: 'f1-13-deload',
  progression: 'f1-11-progression-et-autoregulation',
  overload: 'f1-2-volume',
  return: 'f1-15-fatigue-et-recuperation',
};

export type PhaseEvidence = {
  sectionId: string;
  title: string;
  /** Nombre de fiches, hors références bibliographiques. */
  count: number;
  href: string;
};

/**
 * La section de programmation qui traite cette phase, ou `null` si le corpus
 * n'en dit rien. Le lien ne s'affiche que lorsqu'il mène quelque part.
 */
export function phaseEvidenceFor(phase: ProgramPhase): PhaseEvidence | null {
  const sectionId = PHASE_SECTIONS[phase];
  if (sectionId === undefined) return null;
  const section = findProgrammingSection(sectionId);
  // Un identifiant qui ne résout plus veut dire que le corpus a bougé sous nos
  // pieds. On se tait plutôt que de proposer un lien mort.
  if (section === undefined) return null;
  const rows = section.rows.filter((row) => !row.isBibliography);
  if (rows.length === 0) return null;
  const article = findArticleForRow(rows[0]!.rowId);
  if (article === undefined) return null;
  return {
    sectionId,
    title: section.title,
    count: rows.length,
    href: articleHref(article),
  };
}
