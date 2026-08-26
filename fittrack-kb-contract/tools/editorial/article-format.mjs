// Grammaire des articles du wiki. Le Markdown de `editorial/articles/` est
// l'artefact canonique ; ce parseur en est la seule lecture autorisée.
//
// La règle qui porte tout : **aucun paragraphe ne s'affiche sans avoir dit d'où
// il vient**. La mesure du 2026-08-26 a montré qu'une recherche ne peut pas
// décider quel passage répond à quoi ; la provenance redevient donc déclarée à
// la main, et le format la rend obligatoire au lieu de la recommander.
//
// Un bloc porte soit des sources (`claim.*` de l'index de preuves, `row:cand.*`
// des fiches de programmation), soit la marque `editorial` — qui autorise à
// introduire et relier, jamais à affirmer.

export class ArticleFormatError extends Error {
  constructor(code, filePath, message) {
    super(`${filePath}: ${message}`);
    this.name = 'ArticleFormatError';
    this.code = code;
    this.filePath = filePath;
  }
}

const HEADER = /^<!-- fittrack-wiki\s*\n([\s\S]*?)\n-->\s*\n/u;
const FACTUAL = /^<!-- factual: ([^|]+?)(?: \| roles: (.+))? -->$/u;
const EDITORIAL = '<!-- editorial -->';
const ROW_PREFIX = 'row:';

/**
 * @param {string} source Markdown UTF-8 complet du fichier.
 * @param {string} filePath Chemin relatif, uniquement pour situer une erreur.
 */
export function parseArticle(source, filePath) {
  const header = source.match(HEADER);
  if (!header) throw new ArticleFormatError('MISSING_HEADER', filePath, 'en-tête absent');

  let metadata;
  try {
    metadata = JSON.parse(header[1]);
  } catch {
    throw new ArticleFormatError('INVALID_HEADER', filePath, 'JSON invalide');
  }

  const lines = source.slice(header[0].length).split(/\r?\n/u);
  const sections = [];
  let section = null;
  let provenance = null;
  let textLines = [];

  // Un bloc se ferme sur ce qui le suit — titre, annotation ou ligne vide — et
  // jamais sur une longueur. Les lignes d'un même paragraphe sont recollées :
  // l'enroulement du Markdown est une commodité d'écriture, pas une structure.
  const flush = () => {
    if (textLines.length === 0) return;
    const text = textLines.join(' ').trim();
    textLines = [];
    if (!section) {
      throw new ArticleFormatError('BLOCK_OUTSIDE_SECTION', filePath, 'bloc hors section');
    }
    if (!provenance) {
      throw new ArticleFormatError('UNSOURCED_BLOCK', filePath, `bloc sans source: ${text}`);
    }
    const claimIds = provenance.refs.filter((value) => !value.startsWith(ROW_PREFIX));
    const rowIds = provenance.refs
      .filter((value) => value.startsWith(ROW_PREFIX))
      .map((value) => value.slice(ROW_PREFIX.length));
    section.blocks.push({
      blockId: `${section.sectionId}-b${section.blocks.length + 1}`,
      text,
      claimIds,
      rowIds,
      muscleRoles: provenance.muscleRoles,
      editorial: provenance.editorial,
    });
    provenance = null;
  };

  for (const line of lines) {
    // Le titre H1 duplique `title` dans l'en-tête ; il rend le fichier lisible
    // dans un éditeur et n'entre pas dans la structure exportée.
    if (line.startsWith('# ')) {
      flush();
      continue;
    }
    if (line.startsWith('## ')) {
      flush();
      section = {
        sectionId: `${metadata.articleId}-${sections.length + 1}`,
        title: line.slice(3),
        blocks: [],
      };
      sections.push(section);
      provenance = null;
      continue;
    }
    const factual = line.match(FACTUAL);
    if (factual) {
      flush();
      provenance = {
        refs: factual[1].split(',').map((value) => value.trim()),
        muscleRoles: factual[2]?.split(',').map((value) => value.trim()) ?? [],
        editorial: false,
      };
      continue;
    }
    if (line === EDITORIAL) {
      flush();
      provenance = { refs: [], muscleRoles: [], editorial: true };
      continue;
    }
    // Une annotation mal orthographiée tomberait sinon dans le texte du bloc et
    // s'afficherait telle quelle dans l'application. Échouer ici coûte une
    // seconde ; le laisser passer coûte une relecture de tout le corpus.
    if (line.trimStart().startsWith('<!--')) {
      throw new ArticleFormatError('UNKNOWN_ANNOTATION', filePath, `annotation inconnue: ${line.trim()}`);
    }
    if (line.trim() === '') {
      flush();
      continue;
    }
    textLines.push(line.trim());
  }
  flush();

  return { ...metadata, sections };
}
