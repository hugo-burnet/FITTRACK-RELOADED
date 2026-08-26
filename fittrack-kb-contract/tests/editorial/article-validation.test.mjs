import assert from 'node:assert/strict';
import test from 'node:test';
import { parseArticle } from '../../tools/editorial/article-format.mjs';
import { loadReferences, validateArticleBundle } from '../../tools/editorial/build-articles.mjs';

const references = loadReferences();

// Des identités réelles, pas des chaînes plausibles : un validateur qu'on teste
// avec des références inventées ne prouve que sa propre grammaire.
const CLAIM = 'claim.97d620570f37f665';
const ROW = 'cand.e1.bbadd751172a5c7f';
const SLUG = 'barbell-bench-press';

function article({ header = {}, annotation = `<!-- factual: ${CLAIM} -->` } = {}) {
  const metadata = {
    articleId: 'muscle-triceps',
    title: 'Triceps',
    summary: 'Comprendre le triceps.',
    family: 'muscles',
    order: 1,
    muscleGroups: ['triceps'],
    movementPatterns: [],
    exerciseSlugs: [],
    reviewState: 'reviewed',
    ...header,
  };
  const source = `<!-- fittrack-wiki
${JSON.stringify(metadata)}
-->
# ${metadata.title}

## Anatomie et fonctions

${annotation}
Le chef long traverse aussi l’épaule.
`;
  return parseArticle(source, 'fixture.md');
}

const codes = (diagnostics) => diagnostics.map((diagnostic) => diagnostic.code);
const bundleOf = (...articles) => ({ articles });

test('accepte un article dont toutes les identités existent', () => {
  assert.deepEqual(codes(validateArticleBundle(bundleOf(article()), references)), []);
});

test('rejette les identifiants, muscles, mouvements, slugs et sources inconnus', () => {
  assert.deepEqual(
    codes(validateArticleBundle(bundleOf(article(), article({ header: { order: 2 } })), references)),
    ['DUPLICATE_ARTICLE_ID'],
  );
  assert.deepEqual(
    codes(validateArticleBundle(bundleOf(article({ header: { muscleGroups: ['inconnu'] } })), references)),
    ['UNKNOWN_MUSCLE'],
  );
  assert.deepEqual(
    codes(
      validateArticleBundle(bundleOf(article({ header: { movementPatterns: ['inconnu'] } })), references),
    ),
    ['UNKNOWN_MOVEMENT'],
  );
  assert.deepEqual(
    codes(validateArticleBundle(bundleOf(article({ header: { exerciseSlugs: ['inconnu'] } })), references)),
    ['UNKNOWN_EXERCISE_SLUG'],
  );
  assert.deepEqual(
    codes(validateArticleBundle(bundleOf(article({ annotation: '<!-- factual: claim.inconnu -->' })), references)),
    ['UNKNOWN_CLAIM'],
  );
});

test('accepte une portée par slug du catalogue', () => {
  const scoped = article({ header: { exerciseSlugs: [SLUG] } });
  assert.deepEqual(codes(validateArticleBundle(bundleOf(scoped), references)), []);
});

test('conserve pending_human_review dès qu’une fiche de programmation est citée', () => {
  const promoted = article({
    header: { family: 'programming', reviewState: 'reviewed' },
    annotation: `<!-- factual: row:${ROW} -->`,
  });
  assert.deepEqual(codes(validateArticleBundle(bundleOf(promoted), references)), [
    'PROGRAMMING_REVIEW_PROMOTED',
  ]);

  const honest = article({
    header: { family: 'programming', reviewState: 'pending_human_review' },
    annotation: `<!-- factual: row:${ROW} -->`,
  });
  assert.deepEqual(codes(validateArticleBundle(bundleOf(honest), references)), []);
});

test('rejette un rôle musculaire hors d’un article de mouvement', () => {
  const misplaced = article({ annotation: `<!-- factual: ${CLAIM} | roles: triceps -->` });
  assert.deepEqual(codes(validateArticleBundle(bundleOf(misplaced), references)), [
    'ROLE_OUTSIDE_MOVEMENT',
  ]);

  const allowed = article({
    header: { family: 'movements', muscleGroups: [] },
    annotation: `<!-- factual: ${CLAIM} | roles: triceps -->`,
  });
  assert.deepEqual(codes(validateArticleBundle(bundleOf(allowed), references)), []);
});

test('rejette un rôle musculaire hors vocabulaire', () => {
  const invented = article({
    header: { family: 'movements', muscleGroups: [] },
    annotation: `<!-- factual: ${CLAIM} | roles: pectoral-superieur -->`,
  });
  assert.deepEqual(codes(validateArticleBundle(bundleOf(invented), references)), [
    'UNKNOWN_MUSCLE_ROLE',
  ]);
});

test('exige un rang de lecture déclaré et contigu dans chaque famille', () => {
  assert.deepEqual(codes(validateArticleBundle(bundleOf(article({ header: { order: 3 } })), references)), [
    'BROKEN_FAMILY_ORDER',
  ]);
  assert.ok(
    codes(validateArticleBundle(bundleOf(article({ header: { order: 0 } })), references)).includes(
      'INVALID_ORDER',
    ),
  );
});
