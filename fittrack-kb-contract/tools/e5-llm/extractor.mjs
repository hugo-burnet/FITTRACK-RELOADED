import {
  createE5AnchorRepairSchema,
  mergeAnchorRepairs,
  ProviderDtoError
} from './provider-dto.mjs';
import {
  assertNoGoldenLeak,
  buildAnchorRepairPrompt,
  buildPromptInput,
  E5_ANCHOR_REPAIR_SYSTEM_PROMPT,
  E5_SYSTEM_PROMPT
} from './prompt.mjs';
import { createPredictionValidator, validateProviderAndMaterialize } from './validate.mjs';

function tokenCount(usage, ...names) {
  for (const name of names) {
    if (Number.isFinite(usage?.[name])) return usage[name];
  }
  return 0;
}

function usageForAttempt(attempt, runConfig) {
  const inputTokens = tokenCount(attempt.usage, 'prompt_tokens', 'input_tokens');
  const outputTokens = tokenCount(attempt.usage, 'completion_tokens', 'output_tokens');
  const totalTokens = tokenCount(attempt.usage, 'total_tokens') || inputTokens + outputTokens;
  const reportedCost = attempt.usage?.cost;
  const rates = runConfig.pricingUsdPerMillionTokens ?? { input: 0, output: 0 };
  const estimatedCost =
    (inputTokens / 1_000_000) * rates.input +
    (outputTokens / 1_000_000) * rates.output;
  return {
    calls: 1,
    inputTokens,
    outputTokens,
    totalTokens,
    costUsd: Number((Number.isFinite(reportedCost) ? reportedCost : estimatedCost).toFixed(8))
  };
}

function emptyUsage() {
  return { calls: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0 };
}

function addUsage(target, value) {
  for (const key of ['calls', 'inputTokens', 'outputTokens', 'totalTokens', 'costUsd']) {
    target[key] += value[key];
  }
  target.costUsd = Number(target.costUsd.toFixed(8));
}

export function summarizeAttemptUsage(attempts, runConfig) {
  const summary = { full: emptyUsage(), repair: emptyUsage(), total: emptyUsage() };
  for (const attempt of attempts) {
    const value = usageForAttempt(attempt, runConfig);
    addUsage(summary[attempt.callType], value);
    addUsage(summary.total, value);
  }
  return summary;
}

function attemptRecord({ attempt, callType, promptInput, response, validation }) {
  return {
    attempt,
    callType,
    promptInput,
    rawResponse: response.rawResponse,
    providerResponse: response.providerResponse ?? null,
    responseId: response.responseId ?? null,
    modelVersion: response.modelVersion ?? null,
    usage: response.usage ?? null,
    latencyMs: response.latencyMs ?? null,
    providerSchemaDroppedKeywords: response.providerSchemaDroppedKeywords ?? null,
    providerEnumTypesInjected: response.providerEnumTypesInjected ?? null,
    providerSchemaAssertions: response.providerSchemaAssertions ?? null,
    validation: {
      accepted: validation.accepted,
      retryable: validation.retryable,
      diagnostics: validation.diagnostics
    }
  };
}

function invalidRepair(code, message, detail = {}) {
  return {
    accepted: false,
    prediction: null,
    diagnostics: [{ code, message, critical: true, retryable: false, ...detail }],
    retryable: false
  };
}

function parseAndMergeRepair({
  rawResponse,
  repairSchemaValidator,
  providerPrediction,
  repairableClaimIndexes
}) {
  let repairPrediction;
  try {
    repairPrediction = JSON.parse(rawResponse);
  } catch (error) {
    return invalidRepair('ANCHOR_REPAIR_INVALID_JSON', 'Réparation non JSON', {
      detail: error instanceof Error ? error.message : String(error)
    });
  }
  if (!repairSchemaValidator(repairPrediction)) {
    return invalidRepair('ANCHOR_REPAIR_SCHEMA_FAILURE', 'Réparation non conforme au petit DTO', {
      schemaErrors: structuredClone(repairSchemaValidator.errors ?? [])
    });
  }
  try {
    return {
      accepted: true,
      mergedProviderPrediction: mergeAnchorRepairs(
        providerPrediction,
        repairPrediction,
        repairableClaimIndexes
      ),
      diagnostics: [],
      retryable: false
    };
  } catch (error) {
    const detail = error instanceof ProviderDtoError
      ? error.providerDtoDiagnostic
      : { message: error instanceof Error ? error.message : String(error) };
    return invalidRepair(detail.code ?? 'ANCHOR_REPAIR_SCHEMA_FAILURE', 'Réparation hors scope', {
      detail
    });
  }
}

function resultOf(fragmentId, validation, attempts, runConfig) {
  return {
    fragmentId,
    status: validation.accepted ? 'VALIDATED' : 'REJECTED',
    prediction: validation.accepted ? validation.prediction : null,
    diagnostics: validation.diagnostics,
    attempts,
    usageByCallType: summarizeAttemptUsage(attempts, runConfig)
  };
}

// Deep module interface: one semantic generation, deterministic anchor
// materialization, and at most one anchor-only repair stay behind this seam.
export async function extractProseFragment(input, { modelAdapter }) {
  const {
    fragment,
    citationCatalog,
    vocabularies,
    predictionSchema,
    providerPredictionSchema,
    runConfig
  } = input;
  const canonicalSchemaValidator = createPredictionValidator(predictionSchema);
  const providerSchemaValidator = createPredictionValidator(providerPredictionSchema);
  const repairSchema = createE5AnchorRepairSchema();
  const repairSchemaValidator = createPredictionValidator(repairSchema);
  const fullPromptInput = buildPromptInput({ fragment, citationCatalog, vocabularies });
  assertNoGoldenLeak(`${E5_SYSTEM_PROMPT}\n${fullPromptInput}`);

  const attempts = [];
  const fullResponse = await modelAdapter.generate({
    systemPrompt: E5_SYSTEM_PROMPT,
    input: fullPromptInput,
    outputSchema: providerPredictionSchema,
    runConfig,
    fragmentId: fragment.fragmentId,
    attempt: 0,
    callType: 'full'
  });
  const fullValidation = validateProviderAndMaterialize({
    rawResponse: fullResponse.rawResponse,
    expectedFragment: fragment,
    citationCatalog,
    providerSchemaValidator,
    canonicalSchemaValidator,
    runConfig
  });
  attempts.push(attemptRecord({
    attempt: 0,
    callType: 'full',
    promptInput: fullPromptInput,
    response: fullResponse,
    validation: fullValidation
  }));
  if (fullValidation.accepted || !fullValidation.retryable) {
    return resultOf(fragment.fragmentId, fullValidation, attempts, runConfig);
  }

  const repairLimit = Math.min(1, runConfig.maxAnchorRepairRetries ?? 1);
  if (repairLimit === 0) {
    return resultOf(fragment.fragmentId, fullValidation, attempts, runConfig);
  }
  const repairPromptInput = buildAnchorRepairPrompt({
    fragment,
    providerPrediction: fullValidation.providerPrediction,
    diagnostics: fullValidation.diagnostics
  });
  assertNoGoldenLeak(`${E5_ANCHOR_REPAIR_SYSTEM_PROMPT}\n${repairPromptInput}`);
  const repairRunConfig = {
    ...runConfig,
    maxOutputTokens: runConfig.maxRepairOutputTokens ?? Math.min(1000, runConfig.maxOutputTokens)
  };
  let repairResponse;
  try {
    repairResponse = await modelAdapter.generate({
      systemPrompt: E5_ANCHOR_REPAIR_SYSTEM_PROMPT,
      input: repairPromptInput,
      outputSchema: repairSchema,
      runConfig: repairRunConfig,
      fragmentId: fragment.fragmentId,
      attempt: 1,
      callType: 'repair'
    });
  } catch (error) {
    const providerDiagnostic =
      error instanceof Error && 'providerDiagnostic' in error
        ? error.providerDiagnostic
        : null;
    const validation = invalidRepair(
      'PROVIDER_ERROR',
      error instanceof Error ? error.message : String(error),
      { providerDiagnostic }
    );
    attempts.push(attemptRecord({
      attempt: 1,
      callType: 'repair',
      promptInput: repairPromptInput,
      response: { rawResponse: '', providerResponse: null, usage: null },
      validation
    }));
    return resultOf(fragment.fragmentId, validation, attempts, runConfig);
  }
  const repair = parseAndMergeRepair({
    rawResponse: repairResponse.rawResponse,
    repairSchemaValidator,
    providerPrediction: fullValidation.providerPrediction,
    repairableClaimIndexes: fullValidation.repairableClaimIndexes
  });
  const finalValidation = repair.accepted
    ? validateProviderAndMaterialize({
        rawResponse: JSON.stringify(repair.mergedProviderPrediction),
        expectedFragment: fragment,
        citationCatalog,
        providerSchemaValidator,
        canonicalSchemaValidator,
        runConfig
      })
    : repair;
  attempts.push(attemptRecord({
    attempt: 1,
    callType: 'repair',
    promptInput: repairPromptInput,
    response: repairResponse,
    validation: finalValidation
  }));
  return resultOf(fragment.fragmentId, finalValidation, attempts, runConfig);
}
