import indexDocument from './evidence-index.json';
import { normalizeGymTerm } from './frenchGymVocabulary';
import { programmingSearchEntries } from './programmingIndex';
import { findSectionIdForClaim } from './wikiIndex';

export type EpistemicStatus =
  | 'absence_of_evidence'
  | 'established'
  | 'established_direction'
  | 'mechanistic_only'
  | 'practice_only'
  | 'probable'
  | 'refuted'
  | 'uncertain';

export type EvidenceRecord = {
  claimId: string;
  fragmentId: string;
  sourceTitle: string;
  rawQuote: string;
  rawContext: string;
  displayContext: string;
  retrievalText: string;
  epistemicStatus: EpistemicStatus | null;
  knowledgeType: string | null;
  citationCount: number;
  sourceHash: string;
  supportStartByte: number;
  supportEndByte: number;
};

type EvidenceIndex = {
  calibration: { status: 'UNCALIBRATED'; profileId: null };
  claims: EvidenceRecord[];
};

export type EvidenceCandidate = EvidenceRecord & {
  matchedTerms: string[];
  score: number;
  /**
   * D'où vient le passage. Les deux familles se classent dans le même palmarès
   * — c'est le but, une seule recherche — mais elles ne mènent pas au même
   * écran et n'ont pas le même statut de relecture.
   */
  kind: 'claim' | 'programming';
  /** Section de destination du lien « lire dans sa section ». */
  sectionId: string | undefined;
};

export type EvidenceSearchOutcome =
  | { kind: 'EMPTY_QUERY'; candidates: [] }
  | { kind: 'NO_LEXICAL_EVIDENCE'; candidates: [] }
  | { kind: 'EVIDENCE_CANDIDATES'; candidates: EvidenceCandidate[] };

const evidenceIndex = indexDocument as EvidenceIndex;

const STOP_WORDS = new Set([
  'ai',
  'au',
  'aux',
  'avec',
  'ce',
  'ces',
  'dans',
  'de',
  'des',
  'du',
  'elle',
  'en',
  'est',
  'et',
  'fait',
  'faire',
  'il',
  'je',
  'la',
  'le',
  'les',
  'mais',
  'moins',
  'ne',
  'on',
  'ou',
  'par',
  'pas',
  'plus',
  'pour',
  'que',
  'qui',
  'sans',
  'si',
  'sont',
  'sur',
  'tout',
  'tu',
  'un',
  'une',
  'vous',
]);

export function tokenizeEvidenceText(text: string): string[] {
  return text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/['’]/gu, ' ')
    .split(/[^a-z0-9]+/u)
    .filter((word) => word.length >= 2 && !STOP_WORDS.has(word))
    // Appliqué aux deux côtés — questions et affirmations indexées — donc les
    // termes appariés restent comparables : c'est un repli, pas une expansion.
    .map(normalizeGymTerm);
}

/**
 * Le document indexé n'est pas `retrievalText` tel quel, mais ses trois parties
 * repondérées par répétition.
 *
 * `retrievalText` concatène titre + contexte + citation à poids égal, et le
 * contexte est la partie la plus large : une affirmation sur la largeur de prise
 * en rowing remontait sur « poulie » parce que sa phrase voisine énumérait le
 * matériel. Le contexte sert à comprendre, pas à décider de la pertinence.
 *
 * Le chemin de titres, lui, est le signal topique le plus fiable du corpus —
 * « 6.2 Coude » dit de quoi parle la section mieux que n'importe quelle phrase.
 */
const TITLE_WEIGHT = 3;
const QUOTE_WEIGHT = 1;
const CONTEXT_WEIGHT = 1;

function weightedDocument(entry: {
  sourceTitle: string;
  rawQuote: string;
  retrievalText: string;
}): string[] {
  const parts: string[] = [];
  for (let index = 0; index < TITLE_WEIGHT; index += 1) parts.push(entry.sourceTitle);
  for (let index = 0; index < QUOTE_WEIGHT; index += 1) parts.push(entry.rawQuote);
  for (let index = 0; index < CONTEXT_WEIGHT; index += 1) parts.push(entry.retrievalText);
  return tokenizeEvidenceText(parts.join(' '));
}

type SearchableEntry = EvidenceRecord & {
  kind: 'claim' | 'programming';
  sectionId: string | undefined;
};

/**
 * Un seul palmarès pour deux familles de contenu.
 *
 * La prose vient de l'extraction E5 ; les fiches de programmation viennent des
 * tableaux de F1, extraits déterministiquement à l'étage E1. Les chercher
 * séparément obligerait le lecteur à deviner dans quel silo se trouve sa
 * réponse — or « combien de séries par semaine » et « le rowing appuyé enlève
 * quoi » sont la même question pour lui : où est-ce écrit ?
 *
 * Les fiches n'ont pas de statut épistémique : leur niveau de confiance est un
 * champ du tableau, affiché dans la fiche, pas une étiquette du corpus E5. Le
 * laisser à `null` évite de fabriquer une équivalence entre deux échelles.
 */
const programmingEntries: SearchableEntry[] = programmingSearchEntries.map((row) => ({
  kind: 'programming',
  sectionId: row.sectionId,
  claimId: row.rowId,
  fragmentId: row.rowId,
  sourceTitle: row.sourceTitle,
  rawQuote: row.affirmation,
  rawContext: row.displayText,
  displayContext: row.displayText,
  // Ce que la recherche voit : les valeurs, sans les libellés de colonnes.
  retrievalText: row.searchText,
  epistemicStatus: null,
  knowledgeType: null,
  citationCount: 0,
  sourceHash: '',
  supportStartByte: row.startByte,
  supportEndByte: row.endByte,
}));

const searchable: SearchableEntry[] = [
  ...evidenceIndex.claims.map((claim) => ({
    ...claim,
    kind: 'claim' as const,
    sectionId: findSectionIdForClaim(claim.claimId),
  })),
  ...programmingEntries,
];

const documents = searchable.map(weightedDocument);
const documentFrequency = new Map<string, number>();
for (const tokens of documents) {
  for (const token of new Set(tokens)) {
    documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
  }
}
const averageLength = documents.reduce((sum, tokens) => sum + tokens.length, 0) / documents.length;

// Huit et non quatre. Quatre était le bon chiffre pour un système qui prétend
// répondre : on ne jette pas douze passages à quelqu'un qui attend une réponse.
// Ce n'est pas ce que fait cet écran — il montre où lire. Mesuré sur les 31
// questions DEV dont la réponse est dans le corpus (scripts/score-evidence-search.mjs) :
// rappel 23/31 à quatre candidats, 27/31 à huit, 29/31 à douze. Huit dépasse
// donc la fusion dense + lexicale mesurée à 26/31, sans embarquer de modèle.
export function searchEvidence(query: string, limit = 8): EvidenceSearchOutcome {
  const terms = [...new Set(tokenizeEvidenceText(query))];
  if (terms.length === 0) return { kind: 'EMPTY_QUERY', candidates: [] };

  const candidates = documents
    .map((tokens, index) => {
      const frequencies = new Map<string, number>();
      for (const token of tokens) frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
      const matchedTerms = terms.filter((term) => frequencies.has(term));
      let score = 0;
      for (const term of matchedTerms) {
        const frequency = frequencies.get(term) ?? 0;
        const containingDocuments = documentFrequency.get(term) ?? 0;
        const inverseFrequency = Math.log(
          (documents.length - containingDocuments + 0.5) / (containingDocuments + 0.5) + 1,
        );
        score +=
          (inverseFrequency * frequency * 2.2) /
          (frequency + 1.2 * (0.25 + 0.75 * (tokens.length / averageLength)));
      }
      return { index, matchedTerms, score };
    })
    .filter((candidate) => candidate.score > 0)
    // Le score BM25 tient déjà compte de la couverture des termes, puisqu'il les
    // somme. Trier d'abord par *nombre* de termes appariés favorisait
    // structurellement les documents longs : une fiche de programmation est un
    // bloc multi-champs, elle touche mécaniquement plus de termes distincts
    // qu'une phrase, et passait devant sans être plus pertinente.
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.matchedTerms.length - left.matchedTerms.length ||
        left.index - right.index,
    );

  if (candidates.length === 0) return { kind: 'NO_LEXICAL_EVIDENCE', candidates: [] };

  // L'égalité stricte ne suffit pas : 77 des 408 affirmations ont un contexte
  // *inclus* dans celui d'une autre — l'une porte la phrase, l'autre le
  // paragraphe qui la contient. Sur une vraie question posée depuis l'app
  // (« pourquoi le triceps à la poulie me fait mal au coude »), trois des huit
  // résultats étaient le même passage découpé à trois endroits. Le chevauchement
  // dans un sens ou dans l'autre vaut donc doublon, et le premier arrivé gagne :
  // il a le meilleur score.
  // Les deux familles ne se classent pas équitablement dans un même palmarès.
  // Une fiche de programmation est un bloc multi-champs long et dense en
  // vocabulaire d'entraînement ; une affirmation E5 est une phrase. La
  // normalisation de longueur de BM25 ne les égalise pas, et les fiches
  // évinçaient de bonnes réponses avec du hors-sujet — « bras longs au développé
  // couché » ramenait une fiche sur les séries de 1 à 3 répétitions, et « bonne
  // technique » en ramenait cinq sur le sommeil et les temps de repos. Mesuré :
  // rappel@8 28/31 sans elles, 26/31 sans plafond, 28/31 avec ce plafond.
  //
  // Deux places EN PLUS, jamais prises sur les autres. Un plafond qui retire des
  // places coûtait encore deux questions au banc : la bonne réponse tombait au
  // rang 9. Les fiches ne sont pas des concurrentes des affirmations, elles sont
  // du matériel supplémentaire — les faire payer leur présence n'a pas de sens.
  // L'ordre global par score reste intact : une fiche qui domine la requête sort
  // première, mais elles ne peuvent jamais prendre la page.
  const PROGRAMMING_SLOTS = 2;
  let programmingTaken = 0;
  let claimsTaken = 0;
  const selectedContexts: { kind: 'claim' | 'programming'; text: string }[] = [];
  const selected: EvidenceCandidate[] = [];
  for (const candidate of candidates) {
    const claim = searchable[candidate.index];
    if (!claim) continue;
    if (claim.kind === 'programming' && programmingTaken === PROGRAMMING_SLOTS) continue;
    if (claim.kind === 'claim' && claimsTaken === limit) continue;
    // La déduplication ne vaut qu'à l'intérieur d'une même famille. Elle existe
    // parce que les affirmations E5 partagent des contextes projetés ; une fiche
    // de programmation et une affirmation ne sont jamais deux découpes du même
    // passage, et un chevauchement de texte entre elles est une coïncidence. Le
    // faire compter écartait de bonnes affirmations dès qu'une fiche longue les
    // contenait par hasard.
    const overlaps = selectedContexts.some(
      (entry) =>
        entry.kind === claim.kind &&
        (entry.text.includes(claim.displayContext) || claim.displayContext.includes(entry.text)),
    );
    if (overlaps) continue;
    selectedContexts.push({ kind: claim.kind, text: claim.displayContext });
    selected.push({ ...claim, matchedTerms: candidate.matchedTerms, score: candidate.score });
    if (claim.kind === 'programming') programmingTaken += 1;
    else claimsTaken += 1;
    if (claimsTaken === limit && programmingTaken === PROGRAMMING_SLOTS) break;
  }

  return { kind: 'EVIDENCE_CANDIDATES', candidates: selected };
}

export const evidenceIndexStatus = evidenceIndex.calibration.status;
