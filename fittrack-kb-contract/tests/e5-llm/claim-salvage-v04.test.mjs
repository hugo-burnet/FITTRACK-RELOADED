import assert from 'node:assert/strict';
import { join } from 'node:path';
import test from 'node:test';
import { buildCoverageUnits } from '../../tools/e5-llm/coverage.mjs';
import { loadBenchmarkInputs } from '../../tools/e5-llm/inputs.mjs';
import {
  createE5ProviderPredictionSchema,
  PROVIDER_DTO_VERSION
} from '../../tools/e5-llm/provider-dto.mjs';
import {
  createPredictionValidator,
  validateProviderAndMaterialize
} from '../../tools/e5-llm/validate.mjs';

const root = join(import.meta.dirname, '../..');
const benchmark = loadBenchmarkInputs(root);
const sample = benchmark.inputs.find((item) => item.fragment.fragmentId === 'frag.f2.0001');
const coverageUnits = buildCoverageUnits(sample.fragment);
const anchor = "une différence d'amplitude EMG entre deux exercices";
const providerSchemaValidator = createPredictionValidator(
  createE5ProviderPredictionSchema(benchmark.predictionSchema, { dtoVersion: PROVIDER_DTO_VERSION })
);
const canonicalSchemaValidator = createPredictionValidator(benchmark.predictionSchema);
const runConfig = {
  schemaVersion: '1.0.0-e5-llm-benchmark-prediction',
  runId: 'run.e5-v04.salvage'
};

function coverageLedger() {
  return coverageUnits.map((unit) => ({
    unitIndex: unit.unitIndex,
    decision: unit.unitIndex === 0 ? 'CLAIM_CONTENT' : 'CONTEXT_ONLY'
  }));
}

function validClaim(overrides = {}) {
  return {
    supportAnchors: [anchor],
    rawStatementAnchorIndex: 0,
    domain: 'biomechanics',
    knowledgeTypeState: 'RESOLVED',
    knowledgeType: 'MYTH_REFUTATION',
    knowledgeTypeReason: null,
    epistemicStatusState: 'RESOLVED',
    epistemicStatus: 'refuted',
    epistemicStatusReason: null,
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
    flags: ['emg_content'],
    coverageUnitIndexes: [0],
    ...overrides
  };
}

function providerPrediction(claims, overrides = {}) {
  return {
    annotationPrediction: claims.length === 0 ? 'ZERO_CLAIM' : 'CLAIMS',
    coverageLedger: coverageLedger(),
    claims,
    ...overrides
  };
}

function validate(provider, options = {}) {
  return validateProviderAndMaterialize({
    rawResponse: options.rawResponse ?? JSON.stringify(provider),
    expectedFragment: sample.fragment,
    citationCatalog: options.citationCatalog ?? sample.citationCatalog,
    coverageUnits,
    providerSchemaValidator,
    canonicalSchemaValidator,
    runConfig
  });
}

function assertPartiallySalvaged(result) {
  assert.equal(result.status, 'PARTIALLY_VALIDATED');
  assert.equal(result.accepted, true);
  assert.equal(result.prediction.claims.length, 1);
  assert.equal(result.claimAudit.attempted, 2);
  assert.equal(result.claimAudit.retained, 1);
  assert.equal(result.claimAudit.filtered, 1);
  assert.ok(result.diagnostics.some((item) => item.code === 'CLAIM_FILTERED'));
  assert.ok(result.diagnostics.some((item) => item.code === 'PARTIAL_VALIDATION'));
}

test('retains a valid sister when another claim invents a citation', () => {
  const result = validate(providerPrediction([
    validClaim(),
    validClaim({ citationOccurrenceRefs: ['cand.e5-citation.0000000000000000'], citationAttributionState: 'ATTACHED' })
  ]));

  assertPartiallySalvaged(result);
  assert.ok(result.diagnostics.some((item) => item.code === 'INVENTED_CITATION'));
});

test('retains a valid sister when another claim has a missing anchor', () => {
  const result = validate(providerPrediction([
    validClaim(),
    validClaim({ supportAnchors: ['ancre absente du fragment'], rawStatementAnchorIndex: 0 })
  ]));

  assertPartiallySalvaged(result);
  assert.ok(result.diagnostics.some((item) => item.code === 'ANCHOR_NOT_FOUND'));
  assert.deepEqual(result.repairableClaimIndexes, [1]);
});

test('filters PRODUCT_POLICY without discarding a valid sister', () => {
  const result = validate(providerPrediction([
    validClaim(),
    validClaim({ knowledgeType: 'PRODUCT_POLICY' })
  ]));

  assertPartiallySalvaged(result);
  assert.ok(result.diagnostics.some((item) => item.code === 'UNSUPPORTED_INFERENCE'));
});

test('returns canonical ZERO_CLAIM when every attempted claim is filtered', () => {
  const result = validate(providerPrediction([
    validClaim({ knowledgeType: 'PRODUCT_POLICY' }),
    validClaim({ supportAnchors: ['ancre absente du fragment'] })
  ]));

  assert.equal(result.status, 'PARTIALLY_VALIDATED');
  assert.equal(result.accepted, true);
  assert.equal(result.prediction.annotationPrediction, 'ZERO_CLAIM');
  assert.deepEqual(result.prediction.claims, []);
  assert.deepEqual(
    { attempted: result.claimAudit.attempted, retained: result.claimAudit.retained, filtered: result.claimAudit.filtered },
    { attempted: 2, retained: 0, filtered: 2 }
  );
});

test('keeps a valid claim while reporting incomplete coverage', () => {
  const ledger = coverageLedger().slice(0, -1);
  const result = validate(providerPrediction([validClaim()], { coverageLedger: ledger }));

  assert.equal(result.status, 'PARTIALLY_VALIDATED');
  assert.equal(result.accepted, true);
  assert.equal(result.prediction.claims.length, 1);
  assert.ok(result.coverageAudit.diagnostics.some((item) => item.code === 'COVERAGE_INCOMPLETE'));
});

test('rejects invalid JSON globally', () => {
  const result = validate(null, { rawResponse: '{' });

  assert.equal(result.status, 'REJECTED');
  assert.equal(result.accepted, false);
  assert.equal(result.prediction, null);
  assert.ok(result.diagnostics.some((item) => item.code === 'INVALID_JSON'));
});

test('rejects an invalid Provider DTO globally', () => {
  const result = validate({ annotationPrediction: 'CLAIMS', claims: [] });

  assert.equal(result.status, 'REJECTED');
  assert.equal(result.accepted, false);
  assert.equal(result.prediction, null);
  assert.ok(result.diagnostics.some((item) => item.code === 'SCHEMA_FAILURE'));
});

test('retains valid claims and reports a provider annotation mismatch', () => {
  const result = validate(providerPrediction([validClaim()], { annotationPrediction: 'ZERO_CLAIM' }));

  assert.equal(result.status, 'PARTIALLY_VALIDATED');
  assert.equal(result.accepted, true);
  assert.equal(result.prediction.annotationPrediction, 'CLAIMS');
  assert.ok(result.diagnostics.some((item) => item.code === 'ANNOTATION_PREDICTION_MISMATCH'));
});
