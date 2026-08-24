import assert from 'node:assert/strict';
import test from 'node:test';
import { selectDev20, selectHoldout30 } from '../../tools/e5-llm/v04-selection.mjs';

function fragment(corpus, index) {
  return {
    fragmentId: 'frag.' + corpus.toLowerCase() + '.' + String(index).padStart(4, '0'),
    corpusFileId: 'corpus.' + corpus.toLowerCase() + '.fixture',
    headingPath: ['Fixture'],
    rawText: 'Phrase ' + index + '.'
  };
}

test('HOLDOUT-30 is deterministic, disjoint, and split 15/15', () => {
  const fragments = [
    ...Array.from({ length: 16 }, (_, index) => fragment('F2', index)),
    ...Array.from({ length: 16 }, (_, index) => fragment('F3', index))
  ];
  const input = {
    fragments, citationCandidates: [], corpusCommit: 'fixture-commit',
    dev100Ids: ['frag.f2.0000', 'frag.f3.0000']
  };
  const first = selectHoldout30(input);
  assert.deepEqual(first, selectHoldout30(input));
  assert.deepEqual(first.counts, { F2: 15, F3: 15 });
  assert.equal(new Set(first.fragmentIds).size, 30);
  assert.equal(first.fragmentIds.some((id) => input.dev100Ids.includes(id)), false);
});

test('DEV-20 follows the frozen bucket order and split 10/10', () => {
  const fragmentResults = Array.from({ length: 20 }, (_, index) => ({
    fragmentId: 'frag.' + (index < 10 ? 'f2.' : 'f3.') + String(index).padStart(4, '0'),
    corpus: index < 10 ? 'F2' : 'F3', status: 'VALIDATED', errors: [], goldenZero: index % 2 === 0
  }));
  const annotations = fragmentResults.map((item) => ({
    fragmentId: item.fragmentId, annotationStatus: item.goldenZero ? 'zero_claim' : 'claims'
  }));
  const result = selectDev20({ annotations, fragmentResults, errors: [] });
  assert.deepEqual(result.counts, { F2: 10, F3: 10 });
  assert.deepEqual(result.bucketPriority, [
    'partial_rejection', 'false_zero_claim', 'missed_claim', 'merged_claims',
    'wrong_epistemic_status', 'citation_error', 'safety_violation',
    'successful_zero_claim_witness', 'successful_nonempty_witness', 'residual_error_count'
  ]);
});
