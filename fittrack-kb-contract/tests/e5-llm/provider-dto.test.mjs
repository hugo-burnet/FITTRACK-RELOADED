import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { loadBenchmarkInputs } from '../../tools/e5-llm/inputs.mjs';
import {
  canonicalPredictionToProvider,
  createE5ProviderPredictionSchema,
  providerPredictionToCanonical
} from '../../tools/e5-llm/provider-dto.mjs';
import { projectProviderSchema } from '../../tools/e5-llm/provider-schema.mjs';
import {
  createPredictionValidator,
  validateProviderAndMaterialize
} from '../../tools/e5-llm/validate.mjs';

const root = join(import.meta.dirname, '../..');
const benchmark = loadBenchmarkInputs(root);
const canonicalSchema = benchmark.predictionSchema;
const providerSchema = createE5ProviderPredictionSchema(canonicalSchema);
const providerProjection = projectProviderSchema(providerSchema);
const providerValidator = createPredictionValidator(providerSchema);
const canonicalValidator = createPredictionValidator(canonicalSchema);
const sample = benchmark.inputs.find((item) => item.fragment.fragmentId === 'frag.f2.0001');
const shortText = "une différence d'amplitude EMG entre deux exercices";
const runConfig = {
  schemaVersion: '1.0.0-e5-llm-benchmark-prediction',
  runId: 'run.e5-provider-dto.test'
};

function resolution(state, value = null, reason = null) {
  return { state, value, reason };
}

function canonicalClaim(overrides = {}) {
  return {
    technicalClaimRef: 'tmp.claim.01',
    rawStatement: shortText,
    supportSpans: [{ text: shortText, occurrence: 1 }],
    domain: 'biomechanics',
    knowledgeType: resolution('RESOLVED', 'MYTH_REFUTATION'),
    epistemicStatus: resolution('RESOLVED', 'refuted'),
    assessmentDraft: {
      confidenceByAspect: { state: 'NOT_STATED', value: null, raw: null, reason: null },
      directness: resolution('UNRESOLVED', null, 'not_explicit'),
      evidenceTypes: resolution('NOT_STATED'),
      clinicalEvidenceLevel: null,
      hierarchyHint: 'biomechanics',
      supportsHypertrophySuperiority: false,
      supportsDemonstratedClinicalRisk: false
    },
    citationOccurrenceRefs: [],
    citationAttributionState: 'NOT_CITED',
    conditions: [],
    limitations: [],
    cannotConclude: [],
    unresolved: [],
    flags: ['emg_content'],
    ...overrides
  };
}

function canonicalPrediction(claims = [canonicalClaim()], annotationPrediction = 'CLAIMS') {
  return { fragmentId: sample.fragment.fragmentId, annotationPrediction, claims };
}

function validateProvider(providerPrediction, input = sample) {
  return validateProviderAndMaterialize({
    rawResponse: JSON.stringify(providerPrediction),
    expectedFragment: input.fragment,
    citationCatalog: input.citationCatalog,
    providerSchemaValidator: createPredictionValidator(providerSchema),
    canonicalSchemaValidator: createPredictionValidator(canonicalSchema),
    runConfig
  });
}

function occurrenceForGoldSpan(fragment, span) {
  const matches = [];
  let from = 0;
  while (from <= fragment.rawText.length) {
    const index = fragment.rawText.indexOf(span.text, from);
    if (index === -1) break;
    const start = Buffer.byteLength(fragment.rawText.slice(0, index), 'utf8');
    if (start === span.relativeStartByte) return matches.length + 1;
    matches.push(index);
    from = index + span.text.length;
  }
  throw new Error(`gold_span_not_found:${fragment.fragmentId}:${span.relativeStartByte}`);
}

function goldAxis(axis, fallback = null) {
  const value = axis.state === 'RESOLVED' ? (axis.value ?? fallback) : null;
  return resolution(axis.state, value, axis.reason ?? null);
}

function goldAnnotationToCanonical(annotation, input) {
  return {
    fragmentId: annotation.fragmentId,
    annotationPrediction: annotation.expectedClaims.length ? 'CLAIMS' : 'ZERO_CLAIM',
    claims: annotation.expectedClaims.map((claim, index) => {
      const confidenceAxis = claim.axisResolution.confidenceByAspect;
      const confidence = goldAxis(
        confidenceAxis,
        claim.assessment?.confidenceByAspect ?? null
      );
      if (confidence.value !== null) {
        confidence.value = confidence.value.map((item) => ({
          aspect: item.aspect,
          confidence: item.confidence,
          rationale: item.rationale ?? null
        }));
      }
      return {
        technicalClaimRef: `tmp.claim.${String(index + 1).padStart(2, '0')}`,
        rawStatement: claim.rawStatement,
        supportSpans: claim.supportSpans.map((span) => ({
          text: span.text,
          occurrence: occurrenceForGoldSpan(input.fragment, span)
        })),
        domain: claim.domain,
        knowledgeType: goldAxis(claim.axisResolution.knowledgeType, claim.knowledgeType ?? null),
        epistemicStatus: goldAxis(
          claim.axisResolution.epistemicStatus,
          claim.epistemicStatus ?? null
        ),
        assessmentDraft: {
          confidenceByAspect: {
            ...confidence,
            raw: confidenceAxis.raw ?? null
          },
          directness: goldAxis(
            claim.axisResolution.directness,
            claim.assessment?.directness ?? null
          ),
          evidenceTypes: goldAxis(
            claim.axisResolution.evidenceTypes,
            claim.assessment?.evidenceTypes ?? null
          ),
          clinicalEvidenceLevel: claim.assessment?.clinicalEvidenceLevel ?? null,
          hierarchyHint: input.fragment.corpusFileId.startsWith('corpus.f2.')
            ? 'biomechanics'
            : 'clinical',
          supportsHypertrophySuperiority:
            claim.assessment?.supportsHypertrophySuperiority ?? false,
          supportsDemonstratedClinicalRisk:
            claim.assessment?.supportsDemonstratedClinicalRisk ?? false
        },
        citationOccurrenceRefs: [...claim.citationOccurrenceIds],
        citationAttributionState: claim.citationAttributionState,
        conditions: [],
        limitations: [...claim.limitations],
        cannotConclude: [...claim.cannotConclude],
        unresolved: [...(claim.ambiguities ?? [])],
        flags: [...(claim.flags ?? [])]
      };
    })
  };
}

test('provider schema maxDepth is at most five', () => {
  assert.equal(providerProjection.providerSchemaAssertions.maxDepth, 5);
  assert.equal(providerProjection.providerSchemaAssertions.maxDepthLimit, 5);
});

test('simple Provider DTO reconstructs a canonical-schema-valid prediction', () => {
  const canonical = canonicalPrediction();
  const provider = canonicalPredictionToProvider(canonical, sample.fragment);
  assert.equal(providerValidator(provider), true);
  assert.deepEqual(providerPredictionToCanonical(provider, sample.fragment, sample.citationCatalog), canonical);
  assert.equal(canonicalValidator(canonical), true);
});

test('ZERO_CLAIM Provider DTO reconstructs a valid canonical prediction', () => {
  const provider = { annotationPrediction: 'ZERO_CLAIM', claims: [] };
  const canonical = providerPredictionToCanonical(provider, sample.fragment, sample.citationCatalog);
  assert.equal(providerValidator(provider), true);
  assert.equal(canonicalValidator(canonical), true);
  assert.deepEqual(canonical.claims, []);
});

test('a multi-span claim survives DTO round-trip', () => {
  const secondText = "L'EMG de surface mesure une activité électrique moyennée et globale";
  const canonical = canonicalPrediction([
    canonicalClaim({
      supportSpans: [
        { text: shortText, occurrence: 1 },
        { text: secondText, occurrence: 1 }
      ]
    })
  ]);
  const provider = canonicalPredictionToProvider(canonical, sample.fragment);
  assert.deepEqual(providerPredictionToCanonical(provider, sample.fragment, []), canonical);
});

test('several closed-catalog citations survive DTO round-trip', () => {
  const input = benchmark.inputs.find((item) => item.citationCatalog.length >= 2);
  const text = input.fragment.rawText.slice(0, 20);
  const canonical = {
    fragmentId: input.fragment.fragmentId,
    annotationPrediction: 'CLAIMS',
    claims: [canonicalClaim({
      rawStatement: text,
      supportSpans: [{ text, occurrence: 1 }],
      citationOccurrenceRefs: input.citationCatalog.slice(0, 2).map((item) => item.candidateId),
      citationAttributionState: 'ATTACHED',
      assessmentDraft: {
        ...canonicalClaim().assessmentDraft,
        hierarchyHint: input.fragment.corpusFileId.startsWith('corpus.f2.') ? 'biomechanics' : 'clinical'
      }
    })]
  };
  const provider = canonicalPredictionToProvider(canonical, input.fragment);
  assert.deepEqual(
    providerPredictionToCanonical(provider, input.fragment, input.citationCatalog),
    canonical
  );
});

test('confidence remains multidimensional across parallel DTO arrays', () => {
  const value = [
    { aspect: 'direction', confidence: 'high', rationale: 'explicit' },
    { aspect: 'dose_response_shape', confidence: 'moderate', rationale: null }
  ];
  const canonical = canonicalPrediction([
    canonicalClaim({
      assessmentDraft: {
        ...canonicalClaim().assessmentDraft,
        confidenceByAspect: { state: 'RESOLVED', value, raw: null, reason: null }
      }
    })
  ]);
  const provider = canonicalPredictionToProvider(canonical, sample.fragment);
  assert.deepEqual(provider.claims[0].confidenceAspects, ['direction', 'dose_response_shape']);
  assert.deepEqual(providerPredictionToCanonical(provider, sample.fragment, []).claims[0], canonical.claims[0]);
});

for (const state of ['UNRESOLVED', 'NOT_STATED', 'NOT_APPLICABLE']) {
  test(`${state} axis state remains representable`, () => {
    const canonical = canonicalPrediction([
      canonicalClaim({ knowledgeType: resolution(state, null, `${state.toLowerCase()}_reason`) })
    ]);
    const provider = canonicalPredictionToProvider(canonical, sample.fragment);
    assert.deepEqual(providerPredictionToCanonical(provider, sample.fragment, []).claims[0].knowledgeType, canonical.claims[0].knowledgeType);
  });
}

test('multiple evidence types remain distinct', () => {
  const value = ['systematic_review', 'randomized_trial'];
  const canonical = canonicalPrediction([
    canonicalClaim({
      assessmentDraft: {
        ...canonicalClaim().assessmentDraft,
        evidenceTypes: resolution('RESOLVED', value)
      }
    })
  ]);
  const provider = canonicalPredictionToProvider(canonical, sample.fragment);
  assert.deepEqual(providerPredictionToCanonical(provider, sample.fragment, []).claims[0].assessmentDraft.evidenceTypes.value, value);
});

test('provider-valid ZERO_CLAIM with a claim is rejected by canonical validation', () => {
  const provider = canonicalPredictionToProvider(canonicalPrediction(), sample.fragment);
  provider.annotationPrediction = 'ZERO_CLAIM';
  assert.equal(providerValidator(provider), true);
  const result = validateProvider(provider);
  assert.equal(result.accepted, false);
  assert.ok(result.diagnostics.some((item) => item.code === 'SCHEMA_FAILURE'));
});

test('unknown citation is rejected without correction', () => {
  const provider = canonicalPredictionToProvider(canonicalPrediction(), sample.fragment);
  provider.claims[0].citationOccurrenceRefs = ['cand.e5-citation.0000000000000000'];
  provider.claims[0].citationAttributionState = 'ATTACHED';
  const result = validateProvider(provider);
  assert.equal(result.accepted, false);
  assert.ok(result.diagnostics.some((item) => item.code === 'INVENTED_CITATION'));
});

test('invalid relative span is rejected before canonical materialization', () => {
  const provider = canonicalPredictionToProvider(canonicalPrediction(), sample.fragment);
  provider.claims[0].supportSpanEndBytes[0] = Buffer.byteLength(sample.fragment.rawText, 'utf8') + 1;
  const result = validateProvider(provider);
  assert.equal(result.accepted, false);
  assert.ok(result.diagnostics.some((item) => item.code === 'WRONG_SPAN'));
});

test('absolute offsets are reconstructed from P0 fragment provenance', () => {
  const provider = canonicalPredictionToProvider(canonicalPrediction(), sample.fragment);
  const result = validateProvider(provider);
  assert.equal(result.accepted, true);
  const span = result.prediction.claims[0].supportSpans[0];
  assert.equal(span.absoluteStartByte, sample.fragment.startByte + span.relativeStartByte);
  assert.equal(span.absoluteEndByte, sample.fragment.startByte + span.relativeEndByte);
});

test('technical IDs and fragmentId are generated outside the LLM DTO', () => {
  const provider = canonicalPredictionToProvider(canonicalPrediction(), sample.fragment);
  assert.equal(Object.hasOwn(provider, 'fragmentId'), false);
  assert.equal(Object.hasOwn(provider.claims[0], 'technicalClaimRef'), false);
  const canonical = providerPredictionToCanonical(provider, sample.fragment, []);
  assert.equal(canonical.fragmentId, sample.fragment.fragmentId);
  assert.equal(canonical.claims[0].technicalClaimRef, 'tmp.claim.01');
});

test('Provider DTO adapter is deterministic', () => {
  const provider = canonicalPredictionToProvider(canonicalPrediction(), sample.fragment);
  const first = providerPredictionToCanonical(provider, sample.fragment, []);
  const second = providerPredictionToCanonical(structuredClone(provider), sample.fragment, []);
  assert.deepEqual(first, second);
});

test('canonical schema bytes remain unchanged by DTO construction and round-trip', () => {
  const raw = readFileSync(join(root, 'benchmark/e5/v0/prediction.schema.json'));
  const hash = createHash('sha256').update(raw).digest('hex');
  createE5ProviderPredictionSchema(JSON.parse(raw.toString('utf8')));
  canonicalPredictionToProvider(canonicalPrediction(), sample.fragment);
  assert.equal(createHash('sha256').update(readFileSync(join(root, 'benchmark/e5/v0/prediction.schema.json'))).digest('hex'), hash);
});

test('GOLD bytes remain unchanged by the offline round-trip', () => {
  const path = join(root, 'golden/e5/adjudication/adjudicated.json');
  const before = createHash('sha256').update(readFileSync(path)).digest('hex');
  const gold = JSON.parse(readFileSync(path, 'utf8'));
  assert.equal(gold.annotations.length, 100);
  assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'), before);
});

test('provider schema construction and projection are deterministic', () => {
  const first = projectProviderSchema(createE5ProviderPredictionSchema(canonicalSchema));
  const second = projectProviderSchema(createE5ProviderPredictionSchema(structuredClone(canonicalSchema)));
  assert.deepEqual(first, second);
});

test('all 186 adjudicated GOLD claims round-trip without benchmark-field loss', () => {
  const gold = JSON.parse(
    readFileSync(join(root, 'golden/e5/adjudication/adjudicated.json'), 'utf8')
  );
  const inputById = new Map(
    benchmark.inputs.map((input) => [input.fragment.fragmentId, input])
  );
  let claimCount = 0;
  for (const annotation of gold.annotations) {
    const input = inputById.get(annotation.fragmentId);
    assert.ok(input, `missing benchmark input for ${annotation.fragmentId}`);
    const canonical = goldAnnotationToCanonical(annotation, input);
    assert.equal(canonicalValidator(canonical), true, JSON.stringify(canonicalValidator.errors));
    const provider = canonicalPredictionToProvider(canonical, input.fragment);
    assert.equal(providerValidator(provider), true, JSON.stringify(providerValidator.errors));
    const reconstructed = providerPredictionToCanonical(
      provider,
      input.fragment,
      input.citationCatalog
    );
    assert.deepEqual(reconstructed, canonical);
    claimCount += canonical.claims.length;
  }
  assert.equal(claimCount, 186);
});
