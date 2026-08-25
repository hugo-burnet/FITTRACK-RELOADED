import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  FIELD_TRUST,
  dropContainedClaims,
  projectClaim,
  projectCorpus
} from '../../tools/e5-llm/corpus-projection.mjs';

function span(start, end) {
  return { text: 'x', relativeStartByte: start, relativeEndByte: end };
}

function claim(start, end, overrides = {}) {
  return {
    rawStatement: 'une affirmation',
    supportSpans: [span(start, end)],
    knowledgeType: 'EVIDENCE',
    epistemicStatus: 'probable',
    citationOccurrenceRefs: ['cand.1'],
    axisResolution: {},
    ...overrides
  };
}

test('a claim whose span sits inside another claim is dropped', () => {
  // Signature du sur-decoupage, validee sur F2 et F3 separement : ces claims ne sont
  // justes que dans 27 % des cas contre 77 % pour les autonomes.
  const claims = [claim(0, 200), claim(50, 100), claim(300, 400)];
  const kept = dropContainedClaims(claims);
  assert.equal(kept.length, 2);
  assert.deepEqual(
    kept.map((item) => item.supportSpans[0].relativeStartByte),
    [0, 300]
  );
});

test('two claims sharing the exact same span are both kept', () => {
  // La GOLD elle-meme empile plusieurs claims sur un span identique : n en retirer
  // aucune est le comportement sur.
  const claims = [claim(0, 100), claim(0, 100)];
  assert.equal(dropContainedClaims(claims).length, 2);
});

test('a model claim keeps only the fields measured reliable', () => {
  const projected = projectClaim(claim(0, 100), { source: 'model' });
  assert.equal(projected.rawStatement, 'une affirmation');
  assert.deepEqual(projected.supportSpans, [span(0, 100)]);
  // epistemicStatus n'est fiable qu'a `refuted` : precision 1,00 sur DEV-20 et DEV-100.
  assert.equal(projected.epistemicStatus, null);
  assert.equal(projected.knowledgeType, null);
  assert.equal(projected.trust.epistemicStatus, 'unresolved');
  assert.equal(projected.trust.rawStatement, 'verified');
});

test('a model claim keeps refuted, the only status measured exact', () => {
  const projected = projectClaim(claim(0, 100, { epistemicStatus: 'refuted' }), {
    source: 'model'
  });
  assert.equal(projected.epistemicStatus, 'refuted');
  assert.equal(projected.trust.epistemicStatus, 'verified');
});

test('a human claim keeps every field', () => {
  const projected = projectClaim(claim(0, 100), { source: 'human' });
  assert.equal(projected.epistemicStatus, 'probable');
  assert.equal(projected.knowledgeType, 'EVIDENCE');
  assert.equal(projected.trust.epistemicStatus, 'human');
});

test('citations are carried but never presented as verified', () => {
  // Precision 0,766 et rappel 0,670 sur DEV-100 : utilisable comme piste, pas comme
  // attribution sure.
  const projected = projectClaim(claim(0, 100), { source: 'model' });
  assert.deepEqual(projected.citationOccurrenceRefs, ['cand.1']);
  assert.equal(projected.trust.citationOccurrenceRefs, 'unverified');
  assert.equal(FIELD_TRUST.model.citationOccurrenceRefs, 'unverified');
});

test('the corpus reports how many claims came from each source', () => {
  const corpus = projectCorpus({
    human: [{ fragmentId: 'frag.f2.0001', expectedClaims: [claim(0, 100)] }],
    model: [
      {
        fragmentId: 'frag.f2.0002',
        status: 'VALIDATED',
        prediction: { claims: [claim(0, 200), claim(50, 100)] }
      }
    ]
  });
  assert.equal(corpus.summary.fragments, 2);
  assert.equal(corpus.summary.humanClaims, 1);
  assert.equal(corpus.summary.modelClaims, 1);
  assert.equal(corpus.summary.droppedAsContained, 1);
  assert.equal(corpus.claims.length, 2);
  assert.equal(corpus.claims.every((item) => item.fragmentId && item.source), true);
});

test('a rejected fragment contributes nothing', () => {
  const corpus = projectCorpus({
    human: [],
    model: [{ fragmentId: 'frag.f2.0002', status: 'REJECTED', prediction: null }]
  });
  assert.equal(corpus.claims.length, 0);
  assert.equal(corpus.summary.rejectedFragments, 1);
});
