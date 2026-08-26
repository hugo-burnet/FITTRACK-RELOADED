// Structure de lecture du wiki, dérivée de l'index de preuves.
//
// Rien n'est généré dans un second fichier. Deux artefacts finissent par
// diverger, et c'est précisément le défaut qui a été corrigé le 2026-08-26 sur
// le banc hybride : il mesurait un pipeline différent de celui qui était livré.
// Regrouper 408 affirmations au chargement du module est instantané.
//
// Deux règles de lecture, contre deux défauts mesurés :
//   - on affiche `displayContext` et jamais `rawQuote`. 18 % des affirmations
//     sont des bouts de phrase, excellents pour retrouver et illisibles à lire ;
//   - on déduplique par contexte. Les 408 affirmations ne recouvrent que 266
//     passages réels ; sans ce repli, une page bégaie.
import indexDocument from './evidence-index.json';

export type WikiPassage = {
  /** Les affirmations qui vivent dans ce passage, dans l'ordre du document. */
  claimIds: string[];
  /** Prose lisible : le contexte projeté, pas la citation découpée. */
  text: string;
  /** Position dans le fichier source, qui donne l'ordre de lecture. */
  startByte: number;
};

export type WikiSection = {
  sectionId: string;
  documentId: string;
  /** Titre du document source, pour situer une section dont le titre est seul. */
  documentTitle: string;
  /** Dernier segment du chemin de titres : « 1.5 Biceps brachii et brachial ». */
  title: string;
  /** Le chemin complet sous le document, pour situer la section. */
  headingPath: string[];
  passages: WikiPassage[];
};

export type WikiDocument = {
  documentId: string;
  title: string;
  sections: WikiSection[];
};

type IndexedClaim = {
  claimId: string;
  fragmentId: string;
  sourceTitle: string;
  rawQuote: string;
  displayContext: string;
  supportStartByte: number;
};

const HEADING_SEPARATOR = ' › ';

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 60)
    .replace(/-+$/gu, '');
}

/**
 * Code du fichier source, lu dans l'identifiant de fragment. Dérivé de la donnée
 * plutôt que du titre : un titre se réécrit, un identifiant de fragment est gelé
 * par le contrat, et un titre entier ferait une URL de soixante caractères.
 *
 * Le préfixe `e5` est retiré : `f2` et `e5f2` sont les deux passes d'extraction
 * du *même* fichier — 186 affirmations relues par un humain, 224 sorties du
 * modèle — et leurs octets indexent le même texte. Les séparer couperait chaque
 * document en deux et casserait l'ordre de lecture. Un test vérifie qu'un code
 * ne recouvre jamais deux titres, parce que c'est l'hypothèse qui porte tout.
 */
function documentCode(fragmentId: string): string {
  const namespace = fragmentId.split('.')[1] ?? 'doc';
  return namespace.replace(/^e5/u, '');
}

const claims = indexDocument.claims as IndexedClaim[];
const claimOrder = new Map(claims.map((claim, index) => [claim.claimId, index]));

/**
 * Deux affirmations voisines projettent parfois des contextes **imbriqués** :
 * l'une porte la phrase, l'autre le paragraphe qui la contient. Dédupliquer par
 * égalité stricte ne les voit pas, et la page affiche alors deux fois le même
 * texte à quelques lignes d'intervalle. Mesuré : 57 des 266 passages, sur 36
 * sections des 64 — soit plus d'une page sur deux qui se répétait.
 *
 * On garde le passage le plus large et on lui rattache les ancrages de celui
 * qu'il absorbe : aucune affirmation n'est perdue, elles sont juste citées à
 * l'endroit où on les lit vraiment.
 */
function mergeNestedPassages(passages: WikiPassage[]): WikiPassage[] {
  const widestFirst = [...passages].sort((left, right) => right.text.length - left.text.length);
  const kept: WikiPassage[] = [];
  for (const passage of widestFirst) {
    const container = kept.find((candidate) => candidate.text.includes(passage.text));
    if (container === undefined) {
      kept.push(passage);
      continue;
    }
    container.claimIds.push(...passage.claimIds);
    container.startByte = Math.min(container.startByte, passage.startByte);
  }
  for (const passage of kept) {
    passage.claimIds.sort((left, right) => claimOrder.get(left)! - claimOrder.get(right)!);
  }
  return kept;
}

// Regroupement par titre source, puis par contexte à l'intérieur. L'ordre
// d'insertion suit l'ordre du corpus, ce qui sert de départage stable partout
// où deux éléments partagent un même octet de départ.
const sectionAccumulator = new Map<
  string,
  { claim: IndexedClaim; passages: Map<string, WikiPassage> }
>();

for (const claim of claims) {
  let section = sectionAccumulator.get(claim.sourceTitle);
  if (!section) {
    section = { claim, passages: new Map() };
    sectionAccumulator.set(claim.sourceTitle, section);
  }
  const passage = section.passages.get(claim.displayContext);
  if (passage) {
    passage.claimIds.push(claim.claimId);
    passage.startByte = Math.min(passage.startByte, claim.supportStartByte);
  } else {
    section.passages.set(claim.displayContext, {
      claimIds: [claim.claimId],
      text: claim.displayContext,
      startByte: claim.supportStartByte,
    });
  }
}

const takenIds = new Set<string>();
const builtSections: WikiSection[] = [];

for (const [sourceTitle, accumulated] of sectionAccumulator) {
  const segments = sourceTitle.split(HEADING_SEPARATOR);
  const headingPath = segments.slice(1);
  const title = headingPath[headingPath.length - 1] ?? segments[0] ?? '';
  const code = documentCode(accumulated.claim.fragmentId);

  // Une collision enverrait deux sections sur la même URL, en silence. Le
  // suffixe la rend impossible, et un test vérifie l'unicité sur les 64.
  let sectionId = `${code}-${slugify(title)}`;
  let suffix = 2;
  while (takenIds.has(sectionId)) sectionId = `${code}-${slugify(title)}-${suffix++}`;
  takenIds.add(sectionId);

  builtSections.push({
    sectionId,
    documentId: code,
    documentTitle: segments[0] ?? code,
    title,
    headingPath,
    passages: mergeNestedPassages([...accumulated.passages.values()]).sort(
      (left, right) => left.startByte - right.startByte,
    ),
  });
}

export const wikiSections: readonly WikiSection[] = builtSections;

const documentAccumulator = new Map<string, WikiDocument>();
for (const [sourceTitle, accumulated] of sectionAccumulator) {
  const code = documentCode(accumulated.claim.fragmentId);
  if (documentAccumulator.has(code)) continue;
  documentAccumulator.set(code, {
    documentId: code,
    title: sourceTitle.split(HEADING_SEPARATOR)[0] ?? code,
    sections: [],
  });
}

for (const section of builtSections) {
  documentAccumulator.get(section.documentId)?.sections.push(section);
}

// L'ordre de lecture est celui du document source, pas l'ordre alphabétique :
// une section « 10. » doit suivre la « 9. » et non s'intercaler après la « 1. ».
for (const document of documentAccumulator.values()) {
  document.sections.sort(
    (left, right) => (left.passages[0]?.startByte ?? 0) - (right.passages[0]?.startByte ?? 0),
  );
}

export const wikiDocuments: readonly WikiDocument[] = [...documentAccumulator.values()];

const sectionsById = new Map(builtSections.map((section) => [section.sectionId, section]));

export function findWikiSection(sectionId: string): WikiSection | undefined {
  return sectionsById.get(sectionId);
}

// Une affirmation retrouvée par la recherche doit pouvoir atterrir dans sa
// section plutôt que de flotter seule : c'est la différence entre un extrait et
// une page qu'on peut lire autour.
const sectionIdByClaimId = new Map<string, string>();
for (const section of builtSections) {
  for (const passage of section.passages) {
    for (const claimId of passage.claimIds) sectionIdByClaimId.set(claimId, section.sectionId);
  }
}

export function findSectionIdForClaim(claimId: string): string | undefined {
  return sectionIdByClaimId.get(claimId);
}
