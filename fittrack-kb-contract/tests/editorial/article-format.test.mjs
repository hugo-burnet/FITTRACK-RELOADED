import assert from 'node:assert/strict';
import test from 'node:test';
import { ArticleFormatError, parseArticle } from '../../tools/editorial/article-format.mjs';

// Une ligne vide sépare deux blocs. Sans elle, retirer l'annotation du second
// ne produit pas un bloc orphelin : il se recolle au premier, qui est sourcé,
// et le défaut passe inaperçu. C'est le format qui doit rendre le trou visible.
const VALID = `<!-- fittrack-wiki
{"articleId":"muscle-triceps","title":"Triceps","summary":"Comprendre le triceps.","family":"muscles","muscleGroups":["triceps"],"movementPatterns":[],"exerciseSlugs":[],"reviewState":"reviewed"}
-->
# Triceps

## Anatomie et fonctions

<!-- factual: claim.97d620570f37f665 | roles: triceps -->
Le chef long traverse aussi l’épaule.

<!-- editorial -->
Cette distinction organise la suite de la fiche.
`;

test('parse les métadonnées, sections et sources de chaque bloc', () => {
  const article = parseArticle(VALID, 'muscles/triceps.md');
  assert.equal(article.articleId, 'muscle-triceps');
  assert.deepEqual(article.muscleGroups, ['triceps']);
  assert.deepEqual(article.sections[0].blocks[0].claimIds, ['claim.97d620570f37f665']);
  assert.deepEqual(article.sections[0].blocks[0].muscleRoles, ['triceps']);
  assert.equal(article.sections[0].blocks[1].editorial, true);
});

test('recolle un paragraphe écrit sur plusieurs lignes', () => {
  const source = VALID.replace(
    'Le chef long traverse aussi l’épaule.',
    'Le chef long traverse\naussi l’épaule.',
  );
  assert.equal(
    parseArticle(source, 'muscles/triceps.md').sections[0].blocks[0].text,
    'Le chef long traverse aussi l’épaule.',
  );
});

test('rejette un paragraphe sans annotation', () => {
  assert.throws(
    () => parseArticle(VALID.replace('<!-- editorial -->\n', ''), 'broken.md'),
    (error) => error instanceof ArticleFormatError && error.code === 'UNSOURCED_BLOCK',
  );
});

test('rejette une annotation mal orthographiée au lieu de l’afficher', () => {
  assert.throws(
    () => parseArticle(VALID.replace('<!-- editorial -->', '<!-- editoriale -->'), 'broken.md'),
    (error) => error instanceof ArticleFormatError && error.code === 'UNKNOWN_ANNOTATION',
  );
});

test('accepte une fiche de programmation comme source', () => {
  const source = VALID.replace(
    '<!-- factual: claim.97d620570f37f665 | roles: triceps -->',
    '<!-- factual: row:cand.e1.bbadd751172a5c7f -->',
  ).replace('"reviewed"', '"pending_human_review"');
  assert.deepEqual(parseArticle(source, 'programming/volume.md').sections[0].blocks[0].rowIds, [
    'cand.e1.bbadd751172a5c7f',
  ]);
});
