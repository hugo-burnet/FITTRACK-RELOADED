#!/usr/bin/env node
// Façade racine du corpus éditorial : Markdown canonique -> JSON embarqué.
//
// Le Markdown de `fittrack-kb-contract/editorial/articles/` est la source ;
// `src/features/knowledge/wiki-articles.json` en est la projection, jamais
// éditée à la main. `--check` compare octet à octet et échoue à la moindre
// dérive — c'est le seul moyen d'empêcher les deux artefacts de diverger en
// silence, défaut déjà payé une fois sur le banc hybride, qui mesurait un
// pipeline différent de celui qui était livré.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildArticleBundle,
  loadReferences,
  readArticleSources,
  validateArticleBundle,
} from '../fittrack-kb-contract/tools/editorial/build-articles.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const articlesDir = resolve(root, 'fittrack-kb-contract/editorial/articles');
const outputPath = resolve(root, 'src/features/knowledge/wiki-articles.json');

const mode = process.argv[2] ?? '--write';
if (mode !== '--write' && mode !== '--check') {
  throw new Error(`mode inconnu: ${mode} (attendu --write ou --check)`);
}

const references = loadReferences(root);
const articles = readArticleSources(articlesDir);
if (articles.length === 0) {
  throw new Error(`aucun article dans ${articlesDir}; le corpus éditorial est vide`);
}

const bundle = buildArticleBundle({
  articles,
  evidenceIndex: references.evidenceIndex,
  programming: references.programming,
});

const diagnostics = validateArticleBundle(bundle, references);
if (diagnostics.length > 0) {
  for (const diagnostic of diagnostics) {
    console.error(`${diagnostic.code} ${diagnostic.articleId}: ${diagnostic.detail}`);
  }
  throw new Error(`${diagnostics.length} diagnostic(s) bloquant(s) sur le corpus éditorial`);
}

const generated = `${JSON.stringify(bundle, null, 2)}\n`;

/**
 * Où va un identifiant de traçabilité, en toutes lettres.
 *
 * L'écran affichait « claim.6f33aaaeadcc53d9 · claim.9b4fa84c… » sous chaque
 * paragraphe : trois hashes que personne ne lit, alors qu'ils désignaient tous
 * la même section du corpus. La correspondance existe dans `evidence-index.json`
 * et dans `f1-programming.json`, mais ces deux fichiers pèsent 1,1 Mo — les
 * embarquer sur la route d'un article pour afficher une ligne de texte serait
 * absurde dans une app qui doit se charger dans un sous-sol. On projette donc
 * ici la seule chose dont la lecture a besoin, et `--check` empêche cette
 * projection de dériver comme il le fait déjà pour le bundle.
 *
 * Les libellés sont mis en commun : le segment le plus profond du chemin suffit
 * à situer une source, et il se répète des dizaines de fois.
 */
const sourceLabels = [];
const labelIndex = new Map();
const byId = {};

const intern = (label) => {
  const known = labelIndex.get(label);
  if (known !== undefined) return known;
  const next = sourceLabels.length;
  sourceLabels.push(label);
  labelIndex.set(label, next);
  return next;
};

for (const claim of references.evidenceIndex.claims) {
  const segments = claim.sourceTitle.split(' › ');
  byId[claim.claimId] = intern(segments.at(-1) ?? claim.sourceTitle);
}

for (const section of references.programming.sections) {
  const label = intern(section.title);
  for (const row of section.rows) byId[row.rowId] = label;
}

const sourcesPath = resolve(root, 'src/features/knowledge/claim-sources.json');
const generatedSources = `${JSON.stringify({ schemaVersion: '1.0.0-claim-sources', labels: sourceLabels, byId }, null, 2)}\n`;

if (mode === '--check') {
  const existing = existsSync(outputPath) ? readFileSync(outputPath, 'utf8') : '';
  // Comparaison **normalisée**. Avec `core.autocrlf=true`, git rend le fichier
  // en CRLF au checkout alors que ce script l'écrit en LF : la comparaison
  // octet à octet échouait donc sur tout clone frais sous Windows, et faisait
  // tomber `npm run build` via prebuild. Trouvé en fusionnant sur master, pas
  // dans le worktree où le fichier venait d'être écrit. C'est le contenu qui ne
  // doit pas dériver, pas ses fins de ligne.
  const normalise = (value) => value.split('\r\n').join('\n');
  if (normalise(existing) !== normalise(generated)) {
    throw new Error('wiki-articles.json est périmé; lancer npm run kb:build-articles');
  }
  const existingSources = existsSync(sourcesPath) ? readFileSync(sourcesPath, 'utf8') : '';
  if (normalise(existingSources) !== normalise(generatedSources)) {
    throw new Error('claim-sources.json est périmé; lancer npm run kb:build-articles');
  }
  console.log('Wiki articles: artefact à jour');
} else {
  writeFileSync(outputPath, generated, 'utf8');
  writeFileSync(sourcesPath, generatedSources, 'utf8');
  const { coverage, programmingCoverage } = bundle;
  console.log(
    `Wiki articles: ${bundle.articles.length} articles -> ${outputPath}\n` +
      `  ${coverage.readablePassages} passages lisibles, ` +
      `${coverage.claims - coverage.uncoveredClaims.length}/${coverage.claims} affirmations citées\n` +
      `  ${programmingCoverage.rows - programmingCoverage.uncoveredRows.length}/${programmingCoverage.rows} fiches de programmation citées`,
  );
}
