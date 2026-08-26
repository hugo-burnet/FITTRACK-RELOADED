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
  console.log('Wiki articles: artefact à jour');
} else {
  writeFileSync(outputPath, generated, 'utf8');
  const { coverage, programmingCoverage } = bundle;
  console.log(
    `Wiki articles: ${bundle.articles.length} articles -> ${outputPath}\n` +
      `  ${coverage.readablePassages} passages lisibles, ` +
      `${coverage.claims - coverage.uncoveredClaims.length}/${coverage.claims} affirmations citées\n` +
      `  ${programmingCoverage.rows - programmingCoverage.uncoveredRows.length}/${programmingCoverage.rows} fiches de programmation citées`,
  );
}
