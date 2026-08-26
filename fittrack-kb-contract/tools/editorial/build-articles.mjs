// Validation et projection du corpus éditorial vers l'artefact embarqué.
//
// Tout ce que la spécification appelle « erreur de contenu » doit être une
// erreur de *build*, pas une surprise dans l'application : un slug inventé, un
// claim qui n'existe pas, un rôle musculaire affirmé hors d'un article de
// mouvement, une fiche de programmation promue relue sans relecture humaine.
//
// Le bundle produit est déterministe — articles triés, aucun horodatage — pour
// que `--check` puisse comparer octet à octet et détecter une dérive entre le
// Markdown canonique et le JSON livré.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArticle } from './article-format.mjs';

export const ARTICLE_FAMILIES = [
  'muscles',
  'movements',
  'exercise-choice',
  'programming',
  'clinical',
  'method',
];

const SCHEMA_VERSION = '1.0.0-wiki-articles';

const REPOSITORY_ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');

/**
 * Les groupes musculaires sont lus dans `src/data/types.ts` plutôt que recopiés
 * ici. Une seconde liste dériverait de la première sans que rien ne le signale,
 * et c'est exactement le défaut que ce validateur existe pour empêcher.
 */
export function readMuscleGroups(root) {
  const source = readFileSync(resolve(root, 'src/data/types.ts'), 'utf8');
  const block = source.match(/export const MUSCLE_GROUPS = \[([\s\S]*?)\] as const;/u);
  if (!block) throw new Error('MUSCLE_GROUPS introuvable dans src/data/types.ts');
  const groups = [...block[1].matchAll(/'([a-z_]+)'/gu)].map((match) => match[1]);
  if (groups.length === 0) throw new Error('MUSCLE_GROUPS vide dans src/data/types.ts');
  return groups;
}

export function loadReferences(root = REPOSITORY_ROOT) {
  const read = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
  const vocabulary = read('fittrack-kb-contract/vocabularies/movement-pattern.vocab.json');
  return {
    evidenceIndex: read('src/features/knowledge/evidence-index.json'),
    programming: read('src/features/knowledge/f1-programming.json'),
    movementPatterns: vocabulary.terms.map((term) => term.term),
    catalogue: read('src/data/seed/exercises.json'),
    muscleGroups: readMuscleGroups(root),
  };
}

/** Lit récursivement les Markdown d'un dossier d'articles, dans un ordre stable. */
export function readArticleSources(articlesDir) {
  const files = [];
  const walk = (directory) => {
    const entries = readdirSync(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const full = join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.md')) files.push(full);
    }
  };
  walk(articlesDir);
  return files.map((file) =>
    parseArticle(readFileSync(file, 'utf8'), relative(articlesDir, file).split(sep).join('/')),
  );
}

function blocksOf(article) {
  return article.sections.flatMap((section) => section.blocks);
}

/**
 * Couverture de la matière anatomique et clinique.
 *
 * Un contexte est `merged` lorsqu'il est strictement contenu dans un contexte
 * plus large de la même section : deux affirmations voisines projettent
 * régulièrement la phrase et le paragraphe qui la contient, et les afficher
 * toutes les deux faisait bégayer une page sur deux. Les 266 contextes se
 * replient ainsi sur 209 passages lisibles, sans perdre une seule des 408
 * affirmations — `uncoveredClaims` est la garantie que rien ne tombe.
 */
export function buildCoverageReport({ articles, evidenceIndex }) {
  const bySection = new Map();
  for (const claim of evidenceIndex.claims) {
    let section = bySection.get(claim.sourceTitle);
    if (!section) {
      section = new Map();
      bySection.set(claim.sourceTitle, section);
    }
    const existing = section.get(claim.displayContext);
    if (existing) existing.push(claim.claimId);
    else section.set(claim.displayContext, [claim.claimId]);
  }

  let contexts = 0;
  let merged = 0;
  for (const section of bySection.values()) {
    contexts += section.size;
    const kept = [];
    const widestFirst = [...section.keys()].sort((left, right) => right.length - left.length);
    for (const text of widestFirst) {
      if (kept.some((container) => container.includes(text))) merged += 1;
      else kept.push(text);
    }
  }

  const cited = new Set(
    articles.flatMap((article) => blocksOf(article).flatMap((block) => block.claimIds)),
  );
  const uncoveredClaims = evidenceIndex.claims
    .map((claim) => claim.claimId)
    .filter((claimId) => !cited.has(claimId));

  return {
    contexts,
    merged,
    readablePassages: contexts - merged,
    claims: evidenceIndex.claims.length,
    uncoveredClaims,
  };
}

/**
 * Couverture des 102 fiches de programmation. Elles restent un artefact séparé :
 * elles ne sont jamais fusionnées avec les passages E5 et ne comptent pas dans
 * les 209. Une ligne bibliographique est une métadonnée de publication, donc
 * `appendix` ; toute autre ligne citée est `integrated`.
 */
export function buildProgrammingCoverage({ articles, programming }) {
  const cited = new Set(
    articles.flatMap((article) => blocksOf(article).flatMap((block) => block.rowIds)),
  );
  const rows = programming.sections.flatMap((section) => section.rows);
  const states = [];
  const uncoveredRows = [];
  for (const row of rows) {
    if (cited.has(row.rowId)) states.push(row.isBibliography ? 'appendix' : 'integrated');
    else uncoveredRows.push(row.rowId);
  }
  return {
    rows: rows.length,
    integrated: states.filter((state) => state === 'integrated').length,
    appendix: states.filter((state) => state === 'appendix').length,
    uncoveredRows,
  };
}

/**
 * @returns {{code: string, articleId: string, detail: string}[]} Les diagnostics
 * bloquants. Un tableau vide est la seule sortie qui autorise à livrer.
 */
export function validateArticleBundle(bundle, references = loadReferences()) {
  const { evidenceIndex, programming, movementPatterns, catalogue, muscleGroups } = references;

  const knownClaims = new Set(evidenceIndex.claims.map((claim) => claim.claimId));
  const knownRows = new Set(
    programming.sections.flatMap((section) => section.rows.map((row) => row.rowId)),
  );
  const knownSlugs = new Set(catalogue.map((exercise) => exercise.slug));
  const knownMuscles = new Set(muscleGroups);
  const knownPatterns = new Set(movementPatterns);

  const diagnostics = [];
  const seen = new Set();
  const report = (code, articleId, detail) => diagnostics.push({ code, articleId, detail });

  for (const article of bundle.articles) {
    const { articleId } = article;
    if (seen.has(articleId)) report('DUPLICATE_ARTICLE_ID', articleId, articleId);
    seen.add(articleId);

    if (!ARTICLE_FAMILIES.includes(article.family)) {
      report('UNKNOWN_FAMILY', articleId, article.family);
    }
    // L'ordre d'affichage est une décision éditoriale : le bundle reste trié par
    // identifiant pour être déterministe, et c'est ce champ qui dit dans quel
    // ordre une famille se lit.
    if (!Number.isInteger(article.order) || article.order < 1) {
      report('INVALID_ORDER', articleId, String(article.order));
    }
    for (const muscle of article.muscleGroups ?? []) {
      if (!knownMuscles.has(muscle)) report('UNKNOWN_MUSCLE', articleId, muscle);
    }
    for (const pattern of article.movementPatterns ?? []) {
      if (!knownPatterns.has(pattern)) report('UNKNOWN_MOVEMENT', articleId, pattern);
    }
    for (const slug of article.exerciseSlugs ?? []) {
      if (!knownSlugs.has(slug)) report('UNKNOWN_EXERCISE_SLUG', articleId, slug);
    }

    let citesProgramming = false;
    for (const block of blocksOf(article)) {
      for (const claimId of block.claimIds) {
        if (!knownClaims.has(claimId)) report('UNKNOWN_CLAIM', articleId, claimId);
      }
      for (const rowId of block.rowIds) {
        citesProgramming = true;
        if (!knownRows.has(rowId)) report('UNKNOWN_ROW', articleId, rowId);
      }
      if (block.muscleRoles.length > 0 && article.family !== 'movements') {
        report('ROLE_OUTSIDE_MOVEMENT', articleId, block.blockId);
      }
      for (const role of block.muscleRoles) {
        if (!knownMuscles.has(role)) report('UNKNOWN_MUSCLE_ROLE', articleId, role);
      }
    }

    // Le remaniement éditorial ne vaut pas validation scientifique : citer une
    // fiche non relue interdit d'afficher l'article comme relu.
    if (citesProgramming && article.reviewState !== 'pending_human_review') {
      report('PROGRAMMING_REVIEW_PROMOTED', articleId, article.reviewState);
    }
  }

  // Deux articles au même rang, ou un trou dans la suite, rendraient l'ordre
  // dépendant du tri par identifiant — c'est-à-dire du hasard.
  for (const family of ARTICLE_FAMILIES) {
    const orders = bundle.articles
      .filter((article) => article.family === family)
      .map((article) => article.order)
      .sort((left, right) => left - right);
    const expected = orders.map((_, index) => index + 1);
    if (orders.join(',') !== expected.join(',')) {
      report('BROKEN_FAMILY_ORDER', family, orders.join(','));
    }
  }

  return diagnostics;
}

export function buildArticleBundle({ articles, evidenceIndex, programming }) {
  const sorted = [...articles].sort((left, right) => left.articleId.localeCompare(right.articleId));
  return {
    schemaVersion: SCHEMA_VERSION,
    sourceHashes: {
      evidence: evidenceIndex.corpusHash,
      programming: programming.contentHash,
    },
    families: ARTICLE_FAMILIES,
    articles: sorted,
    coverage: buildCoverageReport({ articles: sorted, evidenceIndex }),
    programmingCoverage: buildProgrammingCoverage({ articles: sorted, programming }),
  };
}
