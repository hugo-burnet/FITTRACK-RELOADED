import assert from 'node:assert/strict';
import { join } from 'node:path';
import test from 'node:test';
import { buildCoverageUnits } from '../../tools/e5-llm/coverage.mjs';
import { extractProseFragment } from '../../tools/e5-llm/extractor.mjs';
import { loadBenchmarkInputs } from '../../tools/e5-llm/inputs.mjs';
import {
  createE5ProviderPredictionSchema,
  PROVIDER_DTO_VERSION
} from '../../tools/e5-llm/provider-dto.mjs';

const root = join(import.meta.dirname, '../..');
const benchmark = loadBenchmarkInputs(root);
const sample = benchmark.inputs.find((item) => item.fragment.fragmentId === 'frag.f2.0001');
const anchor = "une différence d'amplitude EMG entre deux exercices";
const runConfig = {
  schemaVersion: '1.0.0-e5-llm-benchmark-prediction',
  runId: 'run.e5-v04.repair-salvage',
  maxAnchorRepairRetries: 1,
  maxRepairOutputTokens: 200,
  maxOutputTokens: 1000
};
const providerPredictionSchema = createE5ProviderPredictionSchema(
  benchmark.predictionSchema,
  { dtoVersion: PROVIDER_DTO_VERSION }
);
const coverageUnits = buildCoverageUnits(sample.fragment);

function coverageLedger() {
  return coverageUnits.map((unit) => ({
    unitIndex: unit.unitIndex,
    decision: unit.unitIndex === 0 ? 'CLAIM_CONTENT' : 'CONTEXT_ONLY'
  }));
}

function claim(overrides = {}) {
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

function prediction(secondClaim = claim({ supportAnchors: ['anchor absent'], rawStatementAnchorIndex: 0 })) {
  return {
    annotationPrediction: 'CLAIMS',
    coverageLedger: coverageLedger(),
    claims: [claim(), secondClaim]
  };
}

function extractionInput() {
  return {
    ...sample,
    vocabularies: benchmark.vocabularies,
    predictionSchema: benchmark.predictionSchema,
    providerPredictionSchema,
    runConfig
  };
}

function adapterWith(responses, calls = []) {
  let cursor = 0;
  return {
    async generate(request) {
      calls.push(request);
      const response = responses[cursor];
      cursor += 1;
      if (response instanceof Error) throw response;
      return { rawResponse: response };
    }
  };
}

function repairedClaim() {
  return JSON.stringify({
    repairs: [{ claimIndex: 1, supportAnchors: [anchor], rawStatementAnchorIndex: 0 }]
  });
}

test('repairs only claim 2, preserves claim 1, and enables v0.4 coverage validation', async () => {
  const calls = [];
  const result = await extractProseFragment(extractionInput(), {
    modelAdapter: adapterWith([JSON.stringify(prediction()), repairedClaim()], calls)
  });

  assert.equal(result.status, 'VALIDATED');
  assert.equal(result.prediction.claims.length, 2);
  assert.equal(result.prediction.claims[0].rawStatement, anchor);
  assert.equal(result.coverageAudit.diagnostics.length, 0);
  assert.deepEqual(calls.map((call) => call.callType), ['full', 'repair']);
  assert.deepEqual(JSON.parse(calls[1].input).faultyClaims.map((item) => item.claimIndex), [1]);
});

test('a malformed repair retains the pre-repair valid sister', async () => {
  const result = await extractProseFragment(extractionInput(), {
    modelAdapter: adapterWith([JSON.stringify(prediction()), '{not json'])
  });

  assert.equal(result.status, 'PARTIALLY_VALIDATED');
  assert.equal(result.prediction.claims.length, 1);
  assert.equal(result.prediction.claims[0].rawStatement, anchor);
  assert.ok(result.diagnostics.some((item) => item.code === 'REPAIR_FAILED'));
});

test('a provider error during repair returns the retained partial result', async () => {
  const calls = [];
  const result = await extractProseFragment(extractionInput(), {
    modelAdapter: adapterWith([JSON.stringify(prediction()), new Error('repair unavailable')], calls)
  });

  assert.equal(result.status, 'PARTIALLY_VALIDATED');
  assert.equal(result.prediction.claims.length, 1);
  assert.ok(result.diagnostics.some((item) => item.code === 'REPAIR_FAILED'));
  assert.deepEqual(calls.map((call) => call.callType), ['full', 'repair']);
});

test('never attempts more than one repair', async () => {
  const calls = [];
  const result = await extractProseFragment(extractionInput(), {
    modelAdapter: adapterWith([JSON.stringify(prediction()), '{not json', repairedClaim()], calls)
  });

  assert.equal(result.status, 'PARTIALLY_VALIDATED');
  assert.deepEqual(calls.map((call) => call.callType), ['full', 'repair']);
  assert.equal(result.usageByCallType.full.calls, 1);
  assert.equal(result.usageByCallType.repair.calls, 1);
});
