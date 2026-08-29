// Le volet « programmation » du wiki, dérivé de l'extraction déterministe des
// tableaux de F1.
//
// Il vit à côté de `wikiIndex.ts` et non dedans, parce que la matière est d'une
// autre nature : une affirmation E5 est une phrase de prose ancrée, une ligne F1
// est une **fiche** — affirmation, confiance, population, sources, type de
// preuve, contradictions, limites, interprétation, et ce qu'on ne peut pas
// conclure. Les forcer dans la même forme perdrait ce qui fait la valeur de la
// seconde.
//
// Aucune de ces lignes n'a été relue par un humain (`pending_human_review`).
// L'interface doit le dire : l'extraction est déterministe, donc fidèle au
// document, mais fidèle n'est pas vérifié.
import programmingDocument from './f1-programming.json';

export type ProgrammingField = {
  label: string;
  value: string;
  links: { label: string; url: string }[];
};

export type ProgrammingRow = {
  rowId: string;
  fields: ProgrammingField[];
  shape: string;
  isBibliography: boolean;
  startByte: number;
  endByte: number;
  startLine: number;
  reviewState: string;
};

export type ProgrammingSection = {
  sectionId: string;
  title: string;
  headingPath: string[];
  rows: ProgrammingRow[];
};

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

const taken = new Set<string>();
const built: ProgrammingSection[] = [];
for (const section of programmingDocument.sections as Omit<ProgrammingSection, 'sectionId'>[]) {
  let sectionId = `f1-${slugify(section.title)}`;
  let suffix = 2;
  while (taken.has(sectionId)) sectionId = `f1-${slugify(section.title)}-${suffix++}`;
  taken.add(sectionId);
  built.push({ ...section, sectionId });
}

const programmingTitle: string = programmingDocument.title;
export const programmingSections: readonly ProgrammingSection[] = built;

/** Les fiches, sans les 26 lignes de métadonnées bibliographiques. */
export const programmingRowCount: number = built.reduce(
  (total, section) => total + section.rows.filter((row) => !row.isBibliography).length,
  0,
);

/** Vrai tant qu'aucune de ces lignes n'a été relue par un humain. */
export const programmingIsUnreviewed: boolean = (
  programmingDocument.reviewStates as string[]
).every((state) => state !== 'human_reviewed');

const byId = new Map(built.map((section) => [section.sectionId, section]));

export function findProgrammingSection(sectionId: string): ProgrammingSection | undefined {
  return byId.get(sectionId);
}

export type ProgrammingSearchEntry = {
  rowId: string;
  sectionId: string;
  /** Titre de section, pesé comme le chemin de titres des affirmations E5. */
  sourceTitle: string;
  /** L'affirmation principale : la phrase que la fiche défend. */
  affirmation: string;
  /** Les valeurs des champs, pour la recherche. */
  searchText: string;
  /** Les champs libellés, pour l'affichage d'un résultat. */
  displayText: string;
  startByte: number;
  endByte: number;
};

/**
 * Les fiches rendues cherchables au même titre que la prose.
 *
 * Sans ça, elles n'existaient que pour qui pensait à ouvrir l'écran
 * Programmation : chercher « combien de séries par semaine » renvoyait du bruit
 * alors que la réponse était dans l'app. Une page qu'on ne trouve pas ne vaut
 * pas mieux qu'une page absente.
 *
 * Les 26 lignes bibliographiques sont exclues : chercher un DOI n'est pas une
 * question de pratiquant, et elles diluerait les fiches.
 */
export const programmingSearchEntries: readonly ProgrammingSearchEntry[] = built.flatMap(
  (section) =>
    section.rows
      .filter((row) => !row.isBibliography)
      .map((row) => ({
        rowId: row.rowId,
        sectionId: section.sectionId,
        sourceTitle: `${programmingTitle} › ${section.title}`,
        affirmation: row.fields[0]?.value ?? '',
        // Les libellés de colonnes — « Confiance », « Limites », « Population »
        // — sont de la structure, pas du contenu. Les indexer faisait remonter
        // une fiche sur presque n'importe quelle question et coûtait trois
        // bonnes réponses au banc : rappel@8 28/31 -> 25/31.
        searchText: row.fields.map((field) => field.value).join('. '),
        displayText: row.fields.map((field) => `${field.label} : ${field.value}`).join('. '),
        startByte: row.startByte,
        endByte: row.endByte,
      })),
);
