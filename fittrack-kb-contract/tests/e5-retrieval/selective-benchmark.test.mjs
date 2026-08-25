import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSelectiveBenchmark } from '../../tools/e5-retrieval/scaffold-selective-benchmark.mjs';

const questions = Array.from({ length: 120 }, (_, index) => `Question indépendante ${index + 1} ?`);

test('creates deterministic DEV, CAL and TEST partitions', () => {
  const first = buildSelectiveBenchmark(questions, { seed: 'fixed' });
  const second = buildSelectiveBenchmark(questions, { seed: 'fixed' });

  assert.deepEqual(first, second);
  assert.deepEqual(first.manifest.counts, { DEV: 40, CAL: 40, TEST: 40 });
  assert.equal(new Set(first.manifest.questions.map((question) => question.questionId)).size, 120);
  assert.equal(first.annotationTemplate.annotations.length, 120);
});

test('rejects a set smaller than the declared independent benchmark', () => {
  assert.throws(
    () => buildSelectiveBenchmark(questions.slice(0, 119)),
    /120 questions nouvelles minimum/u,
  );
});

test('rejects normalized duplicates and reused development questions', () => {
  assert.throws(
    () => buildSelectiveBenchmark([...questions.slice(0, 119), '  QUESTION indépendante 1 ?  ']),
    /dupliquées/u,
  );
  assert.throws(
    () => buildSelectiveBenchmark(questions, { priorQuestions: ['Question indépendante 17 ?'] }),
    /déjà utilisées/u,
  );
});
