import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { createReplayAdapter } from '../../tools/e5-llm/adapters.mjs';
import { extractProseFragment } from '../../tools/e5-llm/extractor.mjs';
import { loadBenchmarkInputs } from '../../tools/e5-llm/inputs.mjs';
import {
  canonicalPredictionToProvider,
  createE5ProviderPredictionSchema,
  mergeAnchorRepairs,
  providerPredictionToCanonical,
  PROVIDER_DTO_VERSION
} from '../../tools/e5-llm/provider-dto.mjs';
import { E5_SYSTEM_PROMPT, PROMPT_VERSION } from '../../tools/e5-llm/prompt.mjs';
import {
  createPredictionValidator,
  validateProviderAndMaterialize
} from '../../tools/e5-llm/validate.mjs';

const root = join(import.meta.dirname, '../..');
const benchmark = loadBenchmarkInputs(root);
const sample = benchmark.inputs.find((item) => item.fragment.fragmentId === 'frag.f2.0001');
const anchor = "une différence d'amplitude EMG entre deux exercices";
const providerSchema = createE5ProviderPredictionSchema(benchmark.predictionSchema);
const providerSchemaValidator = createPredictionValidator(providerSchema);
const canonicalSchemaValidator = createPredictionValidator(benchmark.predictionSchema);
const runConfig = {
  schemaVersion: '1.0.0-e5-llm-benchmark-prediction',
  runId: 'run.e5-v03.test',
  maxAnchorRepairRetries: 1,
  maxRepairOutputTokens: 200,
  maxOutputTokens: 1000,
  pricingUsdPerMillionTokens: { input: 1.25, output: 10 }
};

function resolution(state, value = null, reason = null) {
  return { state, value, reason };
}

function canonicalClaim(text = anchor, overrides = {}) {
  return {
    technicalClaimRef: 'tmp.claim.01',
    rawStatement: text,
    supportSpans: [{ text, occurrence: 1 }],
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

function providerFor(text = anchor, overrides = {}) {
  const canonical = {
    fragmentId: sample.fragment.fragmentId,
    annotationPrediction: 'CLAIMS',
    claims: [canonicalClaim(text)]
  };
  const provider = canonicalPredictionToProvider(canonical, {
    ...sample.fragment,
    rawText: text === anchor ? sample.fragment.rawText : text
  });
  Object.assign(provider.claims[0], overrides);
  return provider;
}

function fragmentWith(rawText, startByte = 17) {
  return { ...sample.fragment, rawText, startByte };
}

function providerDiagnostic(provider, fragment) {
  try {
    providerPredictionToCanonical(provider, fragment, []);
  } catch (error) {
    return error.providerDtoDiagnostic;
  }
  throw new Error('expected_provider_dto_error');
}

function validateProvider(provider, fragment = sample.fragment, citationCatalog = []) {
  return validateProviderAndMaterialize({
    rawResponse: JSON.stringify(provider),
    expectedFragment: fragment,
    citationCatalog,
    providerSchemaValidator,
    canonicalSchemaValidator,
    runConfig
  });
}

function extractionInput() {
  return {
    ...sample,
    vocabularies: benchmark.vocabularies,
    predictionSchema: benchmark.predictionSchema,
    providerPredictionSchema: providerSchema,
    runConfig
  };
}

test('1. an ASCII anchor is resolved when it is exact and unique', () => {
  const canonical = providerPredictionToCanonical(providerFor(), sample.fragment, []);
  assert.deepEqual(canonical.claims[0].supportSpans, [{ text: anchor, occurrence: 1 }]);
});

test('2. a Unicode anchor produces exact UTF-8 offsets', () => {
  const rawText = 'Préface — élévation à 30° mesurée.';
  const unicodeAnchor = 'élévation à 30°';
  const fragment = fragmentWith(rawText, 101);
  const provider = providerFor(unicodeAnchor);
  const result = validateProvider(provider, fragment);
  const span = result.prediction.claims[0].supportSpans[0];
  const expectedStart = Buffer.byteLength('Préface — ', 'utf8');
  assert.equal(span.relativeStartByte, expectedStart);
  assert.equal(span.relativeEndByte, expectedStart + Buffer.byteLength(unicodeAnchor, 'utf8'));
  assert.equal(span.absoluteStartByte, 101 + expectedStart);
  assert.equal(
    Buffer.from(rawText, 'utf8').subarray(span.relativeStartByte, span.relativeEndByte).toString('utf8'),
    unicodeAnchor
  );
});

test('3. a missing anchor raises ANCHOR_NOT_FOUND', () => {
  const provider = providerFor(anchor, { supportAnchors: ['absent du fragment'] });
  const detail = providerDiagnostic(provider, sample.fragment);
  assert.equal(detail.diagnostics[0].code, 'ANCHOR_NOT_FOUND');
});

test('4. a repeated anchor raises AMBIGUOUS_SUPPORT_ANCHOR', () => {
  const fragment = fragmentWith('même texte, puis même texte');
  const provider = providerFor(anchor, { supportAnchors: ['même texte'] });
  const detail = providerDiagnostic(provider, fragment);
  assert.equal(detail.diagnostics[0].code, 'AMBIGUOUS_SUPPORT_ANCHOR');
});

test('5. extending a repeated anchor can make it uniquely resolvable', () => {
  const fragment = fragmentWith('même texte, puis même texte final');
  const provider = providerFor(anchor, { supportAnchors: ['même texte final'] });
  const canonical = providerPredictionToCanonical(provider, fragment, []);
  assert.equal(canonical.claims[0].rawStatement, 'même texte final');
});

test('6. several anchors are reconstructed in document order', () => {
  const fragment = fragmentWith('premier support puis second support');
  const provider = providerFor(anchor, {
    supportAnchors: ['second support', 'premier support'],
    rawStatementAnchorIndex: 1
  });
  const canonical = providerPredictionToCanonical(provider, fragment, []);
  assert.deepEqual(canonical.claims[0].supportSpans.map((item) => item.text), [
    'premier support',
    'second support'
  ]);
  assert.equal(canonical.claims[0].rawStatement, 'premier support');
});

test('7. overlapping anchors are rejected', () => {
  const detail = providerDiagnostic(
    providerFor(anchor, { supportAnchors: ['abcd', 'cdef'] }),
    fragmentWith('abcdef')
  );
  assert.equal(detail.code, 'OVERLAPPING_SUPPORT_ANCHORS');
});

test('8. an anchor may contain inline Markdown verbatim', () => {
  const markdown = '**charge externe**';
  const canonical = providerPredictionToCanonical(providerFor(anchor, { supportAnchors: [markdown] }), fragmentWith(`Mesure de ${markdown}.`), []);
  assert.equal(canonical.claims[0].rawStatement, markdown);
});

test('9. an anchor may contain a Markdown citation verbatim', () => {
  const markdown = '[Essai contrôlé](https://example.test/essai)';
  const canonical = providerPredictionToCanonical(providerFor(anchor, { supportAnchors: [markdown] }), fragmentWith(`Selon ${markdown}, le résultat varie.`), []);
  assert.equal(canonical.claims[0].rawStatement, markdown);
});

test('10. closed citations are reconstructed without invention', () => {
  const citationId = 'cand.e5-citation.1111111111111111';
  const catalog = [{ candidateId: citationId, fragmentRef: sample.fragment.fragmentId }];
  const provider = providerFor(anchor, {
    citationOccurrenceRefs: [citationId],
    citationAttributionState: 'ATTACHED'
  });
  const canonical = providerPredictionToCanonical(provider, sample.fragment, catalog);
  assert.deepEqual(canonical.claims[0].citationOccurrenceRefs, [citationId]);
  provider.claims[0].citationOccurrenceRefs = ['cand.e5-citation.2222222222222222'];
  assert.equal(providerDiagnostic(provider, sample.fragment).code, 'INVENTED_CITATION');
});

test('11. the canonical schema remains byte-for-byte unchanged', () => {
  const path = join(root, 'benchmark/e5/v0/prediction.schema.json');
  const before = createHash('sha256').update(readFileSync(path)).digest('hex');
  createE5ProviderPredictionSchema(JSON.parse(readFileSync(path, 'utf8')));
  assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'), before);
});

test('12. GOLD remains byte-for-byte unchanged', () => {
  const path = join(root, 'golden/e5/adjudication/adjudicated.json');
  const before = createHash('sha256').update(readFileSync(path)).digest('hex');
  providerPredictionToCanonical(providerFor(), sample.fragment, []);
  assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'), before);
});

test('13. reconstruction is deterministic across two runs', () => {
  const provider = providerFor();
  assert.deepEqual(
    providerPredictionToCanonical(provider, sample.fragment, []),
    providerPredictionToCanonical(structuredClone(provider), sample.fragment, [])
  );
});

test('14. the model DTO requests anchors and no generated offsets', () => {
  assert.equal(PROVIDER_DTO_VERSION, 'e5-provider-prediction-v2');
  assert.match(JSON.stringify(providerSchema), /supportAnchors/u);
  assert.doesNotMatch(JSON.stringify(providerSchema), /supportSpanStartBytes|supportSpanEndBytes/u);
  assert.doesNotMatch(E5_SYSTEM_PROMPT, /offset/iu);
});

test('15. the general prompt distinguishes DEFINITION from PRODUCT_POLICY', () => {
  assert.match(E5_SYSTEM_PROMPT, /DEFINITION décrit un protocole, un seuil, une convention ou un modèle rapporté/u);
  assert.match(E5_SYSTEM_PROMPT, /PRODUCT_POLICY concerne exclusivement une règle du produit FitTrack/u);
});

test('16. uncertain remains distinct from absence_of_evidence', () => {
  assert.match(E5_SYSTEM_PROMPT, /absence_of_evidence exige/u);
  assert.match(E5_SYSTEM_PROMPT, /relève de uncertain/u);
  assert.match(E5_SYSTEM_PROMPT, /n'est pas automatiquement absence_of_evidence/u);
});

test('17. local anchor repair preserves cannotConclude and classifications', () => {
  const original = providerFor(anchor, {
    supportAnchors: ['absent'],
    cannotConclude: ["Le résultat ne permet pas de conclure à l'équivalence."],
    epistemicStatus: 'uncertain'
  });
  const repaired = mergeAnchorRepairs(original, {
    repairs: [{ claimIndex: 0, supportAnchors: [anchor], rawStatementAnchorIndex: 0 }]
  }, [0]);
  assert.deepEqual(repaired.claims[0].cannotConclude, original.claims[0].cannotConclude);
  assert.equal(repaired.claims[0].epistemicStatus, 'uncertain');
  assert.match(E5_SYSTEM_PROMPT, /doit être conservée dans cannotConclude/u);
});

test('18. at most one targeted repair is attempted', async () => {
  const ambiguous = providerFor(anchor, { supportAnchors: ['de'] });
  const adapter = createReplayAdapter(new Map([[sample.fragment.fragmentId, [
    JSON.stringify(ambiguous),
    JSON.stringify({ repairs: [{ claimIndex: 0, supportAnchors: ['de'], rawStatementAnchorIndex: 0 }] })
  ]]]));
  const result = await extractProseFragment(extractionInput(), { modelAdapter: adapter });
  assert.equal(result.status, 'REJECTED');
  assert.deepEqual(result.attempts.map((item) => item.callType), ['full', 'repair']);
});

test('19. a locally resolvable anchor never triggers full regeneration', async () => {
  const adapter = createReplayAdapter(new Map([[sample.fragment.fragmentId, [JSON.stringify(providerFor())]]]));
  const result = await extractProseFragment(extractionInput(), { modelAdapter: adapter });
  assert.equal(result.status, 'VALIDATED');
  assert.deepEqual(result.attempts.map((item) => item.callType), ['full']);
});

test('20. full and repair calls journal tokens and costs separately', async () => {
  const ambiguous = providerFor(anchor, { supportAnchors: ['de'] });
  const adapter = createReplayAdapter(new Map([[sample.fragment.fragmentId, [
    { rawResponse: JSON.stringify(ambiguous), usage: { prompt_tokens: 100, completion_tokens: 20, cost: 0.01 } },
    { rawResponse: JSON.stringify({ repairs: [{ claimIndex: 0, supportAnchors: [anchor], rawStatementAnchorIndex: 0 }] }), usage: { prompt_tokens: 30, completion_tokens: 10, cost: 0.002 } }
  ]]]));
  const result = await extractProseFragment(extractionInput(), { modelAdapter: adapter });
  assert.equal(result.status, 'VALIDATED');
  assert.deepEqual(result.usageByCallType.full, {
    calls: 1,
    inputTokens: 100,
    outputTokens: 20,
    reasoningTokens: 0,
    totalTokens: 120,
    costUsd: 0.01
  });
  assert.deepEqual(result.usageByCallType.repair, {
    calls: 1,
    inputTokens: 30,
    outputTokens: 10,
    reasoningTokens: 0,
    totalTokens: 40,
    costUsd: 0.002
  });
  assert.equal(result.usageByCallType.total.costUsd, 0.012);
});

test('v0.3 version is explicit', () => {
  assert.equal(PROMPT_VERSION, 'e5-llm-v0.3.0');
});
