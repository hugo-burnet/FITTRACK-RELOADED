import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildIndex, search, tokenize } from '../../tools/e5-llm/retrieval.mjs';

test('accents are folded so the typed form matches the written one', () => {
  // Le pratiquant tape « developpe » aussi souvent que « développé ».
  assert.deepEqual(tokenize('développé couché'), tokenize('developpe couche'));
});

test('elisions keep the useful word', () => {
  // « l'exercice » doit indexer « exercice », pas « l » et « exercice ».
  assert.ok(tokenize("l'exercice").includes('exercice'));
  assert.equal(tokenize("l'exercice").includes('l'), false);
});

test('stopwords and single letters are dropped', () => {
  assert.deepEqual(tokenize('est-ce que je dois vraiment le faire ?'), ['dois']);
});

const corpus = [
  { id: 'a', text: "l'entraînement en position étirée produit plus d'hypertrophie du chef long" },
  { id: 'b', text: 'une différence EMG ne prouve pas une hypertrophie supérieure' },
  { id: 'c', text: 'le squat profond augmente la contrainte fémoro-patellaire' }
];

test('a question finds the claim that shares its vocabulary', () => {
  const index = buildIndex(corpus);
  const hits = search(index, "est-ce que l'étirement fait prendre du chef long ?");
  assert.equal(hits[0].id, 'a');
});

test('a question about nothing in the corpus returns nothing', () => {
  // Le cas qui compte pour la sûreté : l'app doit pouvoir dire qu'elle ne sait pas.
  const index = buildIndex(corpus);
  assert.deepEqual(search(index, 'quelle quantité de protéines par jour ?'), []);
});

test('ranking is deterministic when two claims tie', () => {
  const index = buildIndex([
    { id: 'b', text: 'hypertrophie' },
    { id: 'a', text: 'hypertrophie' }
  ]);
  assert.deepEqual(search(index, 'hypertrophie').map((h) => h.id), ['a', 'b']);
});

test('each hit reports which words matched, so a result can be explained', () => {
  const index = buildIndex(corpus);
  const [hit] = search(index, 'EMG hypertrophie');
  assert.ok(hit.matched.includes('emg'));
});
