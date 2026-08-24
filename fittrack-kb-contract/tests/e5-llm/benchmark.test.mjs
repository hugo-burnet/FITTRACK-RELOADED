import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createOpenRouterAdapter, createReplayAdapter } from '../../tools/e5-llm/adapters.mjs';
import {
  alignPredictionToGolden,
  buildMetrics,
  evaluateFragments
} from '../../tools/e5-llm/evaluate.mjs';
import { extractProseFragment } from '../../tools/e5-llm/extractor.mjs';
import { loadBenchmarkInputs } from '../../tools/e5-llm/inputs.mjs';
import { createE5ProviderPredictionSchema } from '../../tools/e5-llm/provider-dto.mjs';
import {
  assertNoGoldenLeak,
  buildPromptInput,
  E5_SYSTEM_PROMPT,
  PROMPT_VERSION
} from '../../tools/e5-llm/prompt.mjs';
import {
  createPredictionValidator,
  validateAndMaterialize
} from '../../tools/e5-llm/validate.mjs';
import { persistResult, runBenchmark } from '../../tools/run-e5-llm-benchmark.mjs';

const root = join(import.meta.dirname, '../..');
const benchmark = loadBenchmarkInputs(root);
const providerPredictionSchema = createE5ProviderPredictionSchema(benchmark.predictionSchema);
const sample = benchmark.inputs.find((item) => item.fragment.fragmentId === 'frag.f2.0001');
const shortText = "une différence d'amplitude EMG entre deux exercices";
const runConfig = {
  schemaVersion: '1.0.0-e5-llm-benchmark-prediction',
  runId: 'run.e5-llm-v0.test',
  maxRetries: 2,
  model: 'test-model',
  temperature: 0,
  topP: 1,
  maxOutputTokens: 1000,
  seed: null
};

function resolution(state, value = null, reason = null) {
  return { state, value, reason };
}

function validClaim(overrides = {}) {
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

function responseWith(claims = [validClaim()], annotationPrediction = 'CLAIMS', fragmentId = sample.fragment.fragmentId) {
  return JSON.stringify({ fragmentId, annotationPrediction, claims });
}

function validate(rawResponse) {
  return validateAndMaterialize({
    rawResponse,
    expectedFragment: sample.fragment,
    citationCatalog: sample.citationCatalog,
    schemaValidator: createPredictionValidator(benchmark.predictionSchema),
    runConfig
  });
}

function hashTree(directory) {
  const output = [];
  function visit(path) {
    for (const name of readdirSync(path).sort()) {
      const target = join(path, name);
      const stat = statSync(target);
      if (stat.isDirectory()) visit(target);
      else {
        output.push(
          `${target.slice(directory.length)}:${createHash('sha256').update(readFileSync(target)).digest('hex')}`
        );
      }
    }
  }
  visit(directory);
  return output;
}

test('prompt contains no golden answer or adjudication data', () => {
  const prompt = buildPromptInput({
    fragment: sample.fragment,
    citationCatalog: sample.citationCatalog,
    vocabularies: benchmark.vocabularies
  });
  assert.equal(assertNoGoldenLeak(`${E5_SYSTEM_PROMPT}\n${prompt}`), true);
  assert.doesNotMatch(prompt, /expectedClaims|goldenClaimId|zeroClaimReason|adjudicat/i);
});

test('prompt exposes only the closed citation catalog for the current fragment', () => {
  const prompt = JSON.parse(
    buildPromptInput({
      fragment: sample.fragment,
      citationCatalog: sample.citationCatalog,
      vocabularies: benchmark.vocabularies
    })
  );
  assert.deepEqual(
    prompt.citationCatalog.map((item) => item.candidateId),
    sample.citationCatalog.map((item) => item.candidateId)
  );
  assert.ok(prompt.citationCatalog.every((item) => !Object.hasOwn(item, 'resolvesToSourceRef')));
});

test('schema enforcement accepts a valid structured response', () => {
  const result = validate(responseWith());
  assert.equal(result.accepted, true);
  assert.equal(result.prediction.claims.length, 1);
  assert.equal(result.prediction.claims[0].supportSpans[0].text, shortText);
});

test('invalid fragmentId is rejected', () => {
  const result = validate(responseWith([validClaim()], 'CLAIMS', 'frag.f2.9999'));
  assert.equal(result.accepted, false);
  assert.ok(result.diagnostics.some((item) => item.code === 'INVALID_FRAGMENT_ID'));
});

test('invalid citation ID is rejected by the closed catalog', () => {
  const claim = validClaim({
    citationOccurrenceRefs: ['cand.e5-citation.0000000000000000'],
    citationAttributionState: 'ATTACHED'
  });
  const result = validate(responseWith([claim]));
  assert.equal(result.accepted, false);
  assert.ok(result.diagnostics.some((item) => item.code === 'INVENTED_CITATION'));
});

test('out-of-range span occurrence is rejected', () => {
  const result = validate(
    responseWith([validClaim({ supportSpans: [{ text: shortText, occurrence: 999 }] })])
  );
  assert.equal(result.accepted, false);
  assert.ok(result.diagnostics.some((item) => item.code === 'WRONG_SPAN'));
});

test('incorrect span text is rejected as hallucinated', () => {
  const invented = 'ce texte exact n’existe certainement pas dans le fragment';
  const result = validate(
    responseWith([
      validClaim({
        rawStatement: invented,
        supportSpans: [{ text: invented, occurrence: 1 }]
      })
    ])
  );
  assert.equal(result.accepted, false);
  assert.ok(result.diagnostics.some((item) => item.code === 'SPAN_HALLUCINATION'));
});

test('ZERO_CLAIM with an empty claims array is valid', () => {
  const result = validate(responseWith([], 'ZERO_CLAIM'));
  assert.equal(result.accepted, true);
  assert.equal(result.prediction.annotationPrediction, 'ZERO_CLAIM');
});

test('claim without a support span is rejected by schema', () => {
  const result = validate(responseWith([validClaim({ supportSpans: [] })]));
  assert.equal(result.accepted, false);
  assert.ok(result.diagnostics.some((item) => item.code === 'SCHEMA_FAILURE'));
});

test('invented URL is rejected even in a free-text limitation', () => {
  const result = validate(
    responseWith([validClaim({ limitations: ['https://invented.example/source'] })])
  );
  assert.equal(result.accepted, false);
  assert.ok(result.diagnostics.some((item) => item.code === 'INVENTED_SOURCE'));
  assert.equal(result.retryable, false);
});

test('retry count is limited to the configured two retries', async () => {
  const adapter = createReplayAdapter(
    new Map([[sample.fragment.fragmentId, ['{', '{', '{']]])
  );
  const result = await extractProseFragment(
    {
      ...sample,
      vocabularies: benchmark.vocabularies,
      predictionSchema: benchmark.predictionSchema,
      providerPredictionSchema,
      runConfig
    },
    { modelAdapter: adapter }
  );
  assert.equal(result.status, 'REJECTED');
  assert.equal(result.attempts.length, 3);
  assert.deepEqual(result.attempts.map((item) => item.attempt), [0, 1, 2]);
});

test('raw responses and exact prompts are persisted for audit', () => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'e5-llm-audit-'));
  try {
    const result = {
      fragmentId: sample.fragment.fragmentId,
      status: 'REJECTED',
      prediction: null,
      diagnostics: [{ code: 'INVALID_JSON' }],
      attempts: [
        {
          attempt: 0,
          promptInput: 'exact prompt',
          rawResponse: '{raw',
          providerResponse: { id: 'response-test' },
          responseId: 'response-test',
          modelVersion: 'test-model-v1',
          usage: { input_tokens: 1, output_tokens: 1 },
          latencyMs: 5,
          validation: { accepted: false, diagnostics: [{ code: 'INVALID_JSON' }] }
        }
      ]
    };
    persistResult(temporaryRoot, result, temporaryRoot);
    const saved = JSON.parse(
      readFileSync(
        join(temporaryRoot, 'raw-responses', 'frag_f2_0001', 'attempt-0.json'),
        'utf8'
      )
    );
    assert.equal(saved.rawResponse, '{raw');
    assert.equal(saved.promptInput, 'exact prompt');
    assert.equal(saved.providerResponse.id, 'response-test');
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test('benchmark config journals model, prompt, sampling, retries and immutable commits', () => {
  const config = JSON.parse(
    readFileSync(join(root, 'benchmark/e5/v0/config.base.json'), 'utf8')
  );
  assert.equal(config.promptVersion, PROMPT_VERSION);
  assert.equal(config.provider, 'openrouter');
  assert.equal(config.baseURL, 'https://openrouter.ai/api/v1');
  assert.equal(config.model, 'openai/gpt-5.6-sol');
  assert.equal(config.apiKeyEnvironmentVariable, 'OPENROUTER_API_KEY');
  assert.equal(config.temperature, null);
  assert.equal(config.topP, null);
  assert.equal(config.reasoningEffort, 'none');
  assert.equal(config.maxRunCostUsd, 2.5);
  assert.equal(config.maxRetries, 2);
  assert.match(config.goldenCommit, /^[0-9a-f]{40}$/);
  assert.match(config.corpusCommit, /^[0-9a-f]{40}$/);
});

test('OpenRouter adapter sends strict JSON schema without exposing its API key', async () => {
  let request;
  const adapter = createOpenRouterAdapter({
    apiKey: 'secret-test-key',
    fetchImpl: async (endpoint, options) => {
      request = { endpoint, options };
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            id: 'generation-test',
            model: 'openai/gpt-5.6-sol',
            choices: [{ message: { content: '{"annotationPrediction":"ZERO_CLAIM","claims":[]}' } }],
            usage: { prompt_tokens: 10, completion_tokens: 5 }
          };
        }
      };
    }
  });
  const result = await adapter.generate({
    systemPrompt: 'system',
    input: 'input',
    outputSchema: providerPredictionSchema,
    runConfig: {
      ...runConfig,
      model: 'openai/gpt-5.6-sol',
      temperature: null,
      topP: null,
      reasoningEffort: 'none'
    }
  });
  const body = JSON.parse(request.options.body);
  assert.equal(request.endpoint, 'https://openrouter.ai/api/v1/chat/completions');
  assert.equal(request.options.headers.Authorization, 'Bearer secret-test-key');
  assert.equal(body.response_format.type, 'json_schema');
  assert.equal(body.response_format.json_schema.strict, true);
  assert.equal(body.provider.require_parameters, true);
  assert.equal(body.reasoning.effort, 'none');
  assert.equal(body.max_completion_tokens, runConfig.maxOutputTokens);
  assert.equal(Object.hasOwn(body, 'max_tokens'), false);
  assert.equal(Object.hasOwn(body, 'temperature'), false);
  assert.equal(Object.hasOwn(body, 'top_p'), false);
  assert.doesNotMatch(JSON.stringify(body.response_format.json_schema.schema), /uniqueItems/u);
  assert.doesNotMatch(JSON.stringify(body.response_format.json_schema.schema), /minLength/u);
  assert.equal(body.response_format.json_schema.schema.properties.annotationPrediction.type, 'string');
  assert.equal(result.rawResponse, '{"annotationPrediction":"ZERO_CLAIM","claims":[]}');
  assert.ok(result.providerSchemaDroppedKeywords.some((item) => item.keyword === 'minLength'));
  assert.equal(result.providerEnumTypesInjected.length, 0);
  assert.doesNotMatch(JSON.stringify(result.providerResponse), /secret-test-key/u);
});

test('OpenRouter adapter retains useful provider errors while redacting secrets and prompts', async () => {
  const fakeOpenRouterKey = ['sk', 'or', 'v1', 'a'.repeat(24)].join('-');
  const adapter = createOpenRouterAdapter({
    apiKey: 'secret-test-key',
    fetchImpl: async () => ({
      ok: false,
      status: 400,
      headers: { get: (name) => name === 'x-request-id' ? 'request-test' : null },
      async json() {
        return {
          error: {
            message: `Invalid schema; Bearer secret-value ${fakeOpenRouterKey}`,
            code: 'invalid_schema',
            type: 'invalid_request_error',
            metadata: {
              provider_name: 'OpenAI',
              upstream: 'uniqueItems is not permitted',
              messages: [{ content: 'private prompt' }],
              authorization: 'Bearer secret-value'
            }
          }
        };
      }
    })
  });
  await assert.rejects(
    adapter.generate({
      systemPrompt: 'system',
      input: 'input',
      outputSchema: providerPredictionSchema,
      runConfig: {
        ...runConfig,
        model: 'openai/gpt-5.6-sol',
        reasoningEffort: 'none'
      }
    }),
    (error) => {
      assert.equal(error.providerDiagnostic.status, 400);
      assert.equal(error.providerDiagnostic.code, 'invalid_schema');
      assert.equal(error.providerDiagnostic.type, 'invalid_request_error');
      assert.equal(error.providerDiagnostic.requestId, 'request-test');
      assert.equal(error.providerDiagnostic.metadata.provider_name, 'OpenAI');
      assert.equal(error.providerDiagnostic.metadata.messages, '[REDACTED]');
      assert.equal(error.providerDiagnostic.metadata.authorization, '[REDACTED]');
      assert.doesNotMatch(
        JSON.stringify(error.providerDiagnostic),
        new RegExp(`secret-value|${fakeOpenRouterKey}|private prompt`, 'u')
      );
      return true;
    }
  );
});

function metricClaim(start, end, rawStatement, options = {}) {
  return {
    rawStatement,
    supportSpans: [{ text: rawStatement, relativeStartByte: start, relativeEndByte: end }],
    knowledgeType: options.knowledgeType ?? 'EVIDENCE',
    epistemicStatus: options.epistemicStatus ?? 'probable',
    citationOccurrenceRefs: options.citations ?? [],
    citationOccurrenceIds: options.citations ?? [],
    axisResolution: {
      knowledgeType: resolution('RESOLVED', options.knowledgeType ?? 'EVIDENCE'),
      epistemicStatus: resolution('RESOLVED', options.epistemicStatus ?? 'probable'),
      confidenceByAspect: resolution('NOT_STATED'),
      directness: resolution('UNRESOLVED'),
      evidenceTypes: resolution('NOT_STATED')
    }
  };
}

test('deterministic benchmark matching aligns a simple local paraphrase by span', () => {
  const prediction = metricClaim(10, 30, 'résultat local mesuré');
  const golden = metricClaim(8, 32, 'le résultat local est mesuré');
  const aligned = alignPredictionToGolden([prediction], [golden]);
  assert.equal(aligned.pairs.length, 1);
  assert.ok(aligned.pairs[0].overlap > 0.8);
});

test('split and merge matching are classified deterministically', () => {
  const annotations = [
    {
      fragmentId: 'frag.f2.0001',
      annotationStatus: 'annotated',
      expectedClaims: [
        metricClaim(0, 40, 'première affirmation atomique'),
        metricClaim(45, 80, 'deuxième affirmation atomique')
      ]
    }
  ];
  const merged = metricClaim(0, 80, 'première et deuxième affirmations atomiques');
  const evaluated = evaluateFragments({
    annotations,
    runRecords: [
      {
        fragmentId: 'frag.f2.0001',
        status: 'VALIDATED',
        prediction: { annotationPrediction: 'CLAIMS', claims: [merged] },
        diagnostics: [],
        attempts: [{ rawResponse: JSON.stringify({ claims: [merged] }) }]
      }
    ]
  });
  assert.ok(evaluated.errors.some((item) => item.category === 'MERGED_CLAIMS'));
});

test('citation precision and recall use closed claim-occurrence pairs', () => {
  const citation = 'cand.e5-citation.1111111111111111';
  const claim = metricClaim(0, 20, 'résultat cité', { citations: [citation] });
  const evaluated = evaluateFragments({
    annotations: [
      { fragmentId: 'frag.f2.0001', annotationStatus: 'annotated', expectedClaims: [claim] }
    ],
    runRecords: [
      {
        fragmentId: 'frag.f2.0001',
        status: 'VALIDATED',
        prediction: { annotationPrediction: 'CLAIMS', claims: [claim] },
        diagnostics: [],
        attempts: [{ rawResponse: JSON.stringify({ claims: [claim] }) }]
      }
    ]
  });
  const metrics = buildMetrics(evaluated.fragmentResults);
  assert.equal(metrics.GLOBAL.citations.precision, 1);
  assert.equal(metrics.GLOBAL.citations.recall, 1);
  assert.equal(metrics.GLOBAL.citations.f1, 1);
});

test('ZERO_CLAIM metrics distinguish precision, recall and false-positive claims', () => {
  const evaluated = evaluateFragments({
    annotations: [
      { fragmentId: 'frag.f2.0001', annotationStatus: 'zero_claim', expectedClaims: [] },
      { fragmentId: 'frag.f3.0001', annotationStatus: 'annotated', expectedClaims: [metricClaim(0, 10, 'claim utile')] }
    ],
    runRecords: [
      {
        fragmentId: 'frag.f2.0001',
        status: 'VALIDATED',
        prediction: { annotationPrediction: 'ZERO_CLAIM', claims: [] },
        diagnostics: [],
        attempts: [{ rawResponse: '{"claims":[]}' }]
      },
      {
        fragmentId: 'frag.f3.0001',
        status: 'VALIDATED',
        prediction: { annotationPrediction: 'ZERO_CLAIM', claims: [] },
        diagnostics: [],
        attempts: [{ rawResponse: '{"claims":[]}' }]
      }
    ]
  });
  const metrics = buildMetrics(evaluated.fragmentResults);
  assert.equal(metrics.GLOBAL.zeroClaim.precision, 0.5);
  assert.equal(metrics.GLOBAL.zeroClaim.recall, 1);
  assert.equal(metrics.GLOBAL.zeroClaim.accuracy, 0.5);
});

test('important metrics are split into GLOBAL, F2 and F3', () => {
  const claim = metricClaim(0, 10, 'claim locale');
  const evaluated = evaluateFragments({
    annotations: [
      { fragmentId: 'frag.f2.0001', annotationStatus: 'annotated', expectedClaims: [claim] },
      { fragmentId: 'frag.f3.0001', annotationStatus: 'annotated', expectedClaims: [claim] }
    ],
    runRecords: [
      {
        fragmentId: 'frag.f2.0001', status: 'VALIDATED',
        prediction: { annotationPrediction: 'CLAIMS', claims: [claim] }, diagnostics: [],
        attempts: [{ rawResponse: JSON.stringify({ claims: [claim] }) }]
      },
      {
        fragmentId: 'frag.f3.0001', status: 'VALIDATED',
        prediction: { annotationPrediction: 'ZERO_CLAIM', claims: [] }, diagnostics: [],
        attempts: [{ rawResponse: '{"claims":[]}' }]
      }
    ]
  });
  const metrics = buildMetrics(evaluated.fragmentResults);
  assert.equal(metrics.GLOBAL.claims.recall, 0.5);
  assert.equal(metrics.F2.claims.recall, 1);
  assert.equal(metrics.F3.claims.recall, 0);
});

test('EMG to hypertrophy and biomechanics to risk are hard rejections', () => {
  const emg = validClaim({
    knowledgeType: resolution('RESOLVED', 'EMG_OBSERVATION'),
    epistemicStatus: resolution('RESOLVED', 'probable'),
    assessmentDraft: {
      ...validClaim().assessmentDraft,
      directness: resolution('RESOLVED', 'emg_only'),
      supportsHypertrophySuperiority: true
    }
  });
  const emgResult = validate(responseWith([emg]));
  assert.ok(emgResult.diagnostics.some((item) => item.code === 'EMG_HYPERTROPHY_LEAP'));

  const mechanical = validClaim({
    knowledgeType: resolution('RESOLVED', 'BIOMECHANICAL_OBSERVATION'),
    epistemicStatus: resolution('RESOLVED', 'probable'),
    assessmentDraft: {
      ...validClaim().assessmentDraft,
      directness: resolution('RESOLVED', 'biomechanical_only'),
      supportsDemonstratedClinicalRisk: true
    }
  });
  const mechanicalResult = validate(responseWith([mechanical]));
  assert.ok(
    mechanicalResult.diagnostics.some((item) => item.code === 'BIOMECHANICS_RISK_LEAP')
  );
});

test('dry-run covers exactly 100 manifest fragments with no API and writes nothing in curated', async () => {
  const curated = join(root, 'curated');
  const before = hashTree(curated);
  const result = await runBenchmark(['--mode', 'dry-run']);
  const after = hashTree(curated);
  assert.equal(result.dryRun.fragmentCount, 100);
  assert.equal(result.dryRun.apiCalls, 0);
  assert.deepEqual(result.dryRun.split, { F2: 50, F3: 50 });
  assert.deepEqual(after, before);
});
