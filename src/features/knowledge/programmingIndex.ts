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

export const programmingTitle: string = programmingDocument.title;
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
