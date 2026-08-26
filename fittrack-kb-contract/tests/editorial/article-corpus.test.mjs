// Le corpus réel, pas une fixture. C'est le seul test qui puisse dire qu'une
// affirmation a disparu pendant une réécriture éditoriale.
import assert from 'node:assert/strict';
import test from 'node:test';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ARTICLE_FAMILIES,
  buildArticleBundle,
  loadReferences,
  readArticleSources,
  validateArticleBundle,
} from '../../tools/editorial/build-articles.mjs';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');
const references = loadReferences(root);
const articles = readArticleSources(resolve(root, 'fittrack-kb-contract/editorial/articles'));
const bundle = buildArticleBundle({
  articles,
  evidenceIndex: references.evidenceIndex,
  programming: references.programming,
});

test('le corpus éditorial ne produit aucun diagnostic', () => {
  assert.deepEqual(validateArticleBundle(bundle, references), []);
});

test('les 408 affirmations sont citées, fusions comprises', () => {
  assert.equal(bundle.coverage.contexts, 266);
  assert.equal(bundle.coverage.merged, 57);
  assert.equal(bundle.coverage.readablePassages, 209);
  assert.equal(bundle.coverage.claims, 408);
  assert.deepEqual(bundle.coverage.uncoveredClaims, []);
});

test('les 102 fiches de programmation sont citées, bibliographie comprise', () => {
  assert.equal(bundle.programmingCoverage.rows, 102);
  assert.equal(bundle.programmingCoverage.appendix, 26);
  assert.equal(bundle.programmingCoverage.integrated, 76);
  assert.deepEqual(bundle.programmingCoverage.uncoveredRows, []);
});

test('les six familles sont peuplées', () => {
  const counts = new Map(ARTICLE_FAMILIES.map((family) => [family, 0]));
  for (const article of bundle.articles) counts.set(article.family, counts.get(article.family) + 1);
  assert.deepEqual([...counts.entries()].filter(([, count]) => count === 0), []);
});

test('les 13 familles de mouvement ont chacune un article, et un seul', () => {
  const byPattern = new Map();
  for (const article of bundle.articles.filter((item) => item.family === 'movements')) {
    for (const pattern of article.movementPatterns) {
      byPattern.set(pattern, (byPattern.get(pattern) ?? 0) + 1);
    }
  }
  const expected = references.movementPatterns.filter((pattern) => pattern !== 'autre');
  assert.deepEqual([...byPattern.keys()].sort(), [...expected].sort());
  assert.deepEqual([...byPattern.values()].filter((count) => count !== 1), []);
});

test('aucun article de programmation n’est promu relu', () => {
  const promoted = bundle.articles
    .filter((article) => article.family === 'programming')
    .filter((article) => article.reviewState !== 'pending_human_review');
  assert.deepEqual(promoted, []);
});
