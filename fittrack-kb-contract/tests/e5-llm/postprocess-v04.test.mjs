import assert from 'node:assert/strict';
import { join } from 'node:path';
import test from 'node:test';
import { buildCoverageUnits } from '../../tools/e5-llm/coverage.mjs';
import { loadBenchmarkInputs } from '../../tools/e5-llm/inputs.mjs';
import { postprocessClaims } from '../../tools/e5-llm/postprocess.mjs';
import {
  createE5ProviderPredictionSchema,
  PROVIDER_DTO_VERSION
} from '../../tools/e5-llm/provider-dto.mjs';
import {
  createPredictionValidator,
  validateProviderAndMaterialize
} from '../../tools/e5-llm/validate.mjs';

const citationId = 'cand.e5-citation.0123456789abcdef';

function fragment(rawText = 'Conseil pratique avec une source. Deuxième phrase.') {
  return { fragmentId: 'frag.f2.0001', rawText };
}

function claim(overrides = {}) {
  return {
    technicalClaimRef: 'tmp.claim.01',
    rawStatement: 'Conseil pratique avec une source.',
    supportSpans: [{ text: 'Conseil pratique avec une source.', occurrence: 1 }],
    knowledgeType: { state: 'RESOLVED', value: 'EXPERT_PRACTICE', reason: null },
    epistemicStatus: { state: 'UNRESOLVED', value: null, reason: 'not_explicit' },
    citationOccurrenceRefs: [],
    citationAttributionState: 'NOT_CITED',
    coverageUnitIndexes: [0],
    ...overrides
  };
}

function citation(fragmentId, relativeStartByte = 0, relativeEndByte = 8, overrides = {}) {
  return {
    candidateId: citationId,
    fragmentRef: fragmentId,
    payload: { relativeStartByte, relativeEndByte },
    ...overrides
  };
}

function fixtureExpertPractice() {
  const inputFragment = fragment();
  return {
    claims: [claim()],
    fragment: inputFragment,
    citationCatalog: [],
    coverageUnits: buildCoverageUnits(inputFragment)
  };
}

function fixtureUniqueLocalCitation() {
  const inputFragment = fragment();
  return {
    claims: [claim({ knowledgeType: { state: 'RESOLVED', value: 'EVIDENCE', reason: null } })],
    fragment: inputFragment,
    citationCatalog: [citation(inputFragment.fragmentId)],
    coverageUnits: buildCoverageUnits(inputFragment)
  };
}

function fixtureAmbiguousCitation() {
  const inputFragment = fragment();
  return {
    claims: [
      claim({ knowledgeType: { state: 'RESOLVED', value: 'EVIDENCE', reason: null } }),
      claim({ technicalClaimRef: 'tmp.claim.02' })
    ],
    fragment: inputFragment,
    citationCatalog: [citation(inputFragment.fragmentId)],
    coverageUnits: buildCoverageUnits(inputFragment)
  };
}

test('EXPERT_PRACTICE plus UNRESOLVED becomes practice_only with an audit reason', () => {
  const result = postprocessClaims(fixtureExpertPractice());

  assert.equal(result.claims[0].epistemicStatus.value, 'practice_only');
  assert.equal(result.resolutions[0].reason, 'deterministic_expert_practice_default');
});

test('one local citation attaches only to the sole eligible claim', () => {
  const result = postprocessClaims(fixtureUniqueLocalCitation());

  assert.deepEqual(result.claims[0].citationOccurrenceRefs, [citationId]);
  assert.equal(result.claims[0].citationAttributionState, 'ATTACHED');
});

test('a locally unique citation does not attach to an unresolved attribution', () => {
  const input = fixtureUniqueLocalCitation();
  input.claims[0].citationAttributionState = 'UNRESOLVED';

  const result = postprocessClaims(input);

  assert.deepEqual(result.claims[0].citationOccurrenceRefs, []);
  assert.equal(result.claims[0].citationAttributionState, 'UNRESOLVED');
});

test('multiple claims or citations stay unresolved', () => {
  const result = postprocessClaims(fixtureAmbiguousCitation());

  assert.deepEqual(result.claims.flatMap((item) => item.citationOccurrenceRefs), []);
});

test('unresolved epistemic states remain unresolved outside EXPERT_PRACTICE', () => {
  const input = fixtureExpertPractice();
  input.claims[0].knowledgeType = { state: 'RESOLVED', value: 'EMG_OBSERVATION', reason: null };

  const result = postprocessClaims(input);

  assert.deepEqual(result.claims[0].epistemicStatus, {
    state: 'UNRESOLVED',
    value: null,
    reason: 'not_explicit'
  });
});

test('a citation spanning a coverage-unit boundary does not attach', () => {
  const inputFragment = fragment();
  const units = buildCoverageUnits(inputFragment);
  const result = postprocessClaims({
    claims: [claim({ knowledgeType: { state: 'RESOLVED', value: 'EVIDENCE', reason: null } })],
    fragment: inputFragment,
    citationCatalog: [citation(inputFragment.fragmentId, 0, units[0].relativeEndByte + 1)],
    coverageUnits: units
  });

  assert.deepEqual(result.claims[0].citationOccurrenceRefs, []);
});

test('validation materializes deterministic resolutions after retaining claims', () => {
  const root = join(import.meta.dirname, '../..');
  const benchmark = loadBenchmarkInputs(root);
  const sample = benchmark.inputs.find((item) => item.fragment.fragmentId === 'frag.f2.0001');
  const units = buildCoverageUnits(sample.fragment);
  const providerClaim = {
    supportAnchors: ["une différence d'amplitude EMG entre deux exercices"],
    rawStatementAnchorIndex: 0,
    domain: 'biomechanics',
    knowledgeTypeState: 'RESOLVED',
    knowledgeType: 'EXPERT_PRACTICE',
    knowledgeTypeReason: null,
    epistemicStatusState: 'UNRESOLVED',
    epistemicStatus: null,
    epistemicStatusReason: 'not_explicit',
    confidenceState: 'NOT_STATED',
    confidenceAspects: null,
    confidenceLevels: null,
    confidenceRationales: null,
    confidenceRaw: null,
    confidenceReason: null,
    directnessState: 'UNRESOLVED',
    directness: null,
    directnessReason: 'not_explicit',
    evidenceTypesState: 'NOT_STATED',
    evidenceTypes: null,
    evidenceTypesReason: null,
    clinicalEvidenceLevel: null,
    supportsHypertrophySuperiority: false,
    supportsDemonstratedClinicalRisk: false,
    citationOccurrenceRefs: [],
    citationAttributionState: 'NOT_CITED',
    conditions: [],
    limitations: [],
    cannotConclude: [],
    unresolved: [],
    flags: ['expert_practice'],
    coverageUnitIndexes: [0]
  };
  const result = validateProviderAndMaterialize({
    rawResponse: JSON.stringify({
      annotationPrediction: 'CLAIMS',
      coverageLedger: units.map((unit) => ({
        unitIndex: unit.unitIndex,
        decision: unit.unitIndex === 0 ? 'CLAIM_CONTENT' : 'CONTEXT_ONLY'
      })),
      claims: [providerClaim]
    }),
    expectedFragment: sample.fragment,
    citationCatalog: sample.citationCatalog,
    coverageUnits: units,
    providerSchemaValidator: createPredictionValidator(
      createE5ProviderPredictionSchema(benchmark.predictionSchema, { dtoVersion: PROVIDER_DTO_VERSION })
    ),
    canonicalSchemaValidator: createPredictionValidator(benchmark.predictionSchema),
    runConfig: { schemaVersion: '1.0.0-e5-llm-benchmark-prediction', runId: 'run.e5-v04.postprocess' }
  });

  assert.equal(result.accepted, true);
  assert.equal(result.prediction.claims[0].epistemicStatus, 'practice_only');
  assert.equal(result.postprocess.resolutions[0].reason, 'deterministic_expert_practice_default');
  assert.equal(result.claimAudit.claims[0].canonicalCandidate.epistemicStatus, null);
});
