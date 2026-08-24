import { assertNoGoldenLeak, buildPromptInput, E5_SYSTEM_PROMPT } from './prompt.mjs';
import { createPredictionValidator, validateAndMaterialize } from './validate.mjs';

function retryPrompt(originalInput, diagnostics) {
  const errors = diagnostics.map((item) => ({ code: item.code, message: item.message }));
  return `${originalInput}\n\nERREURS TECHNIQUES DE LA TENTATIVE PRECEDENTE\n${JSON.stringify(
    errors,
    null,
    2
  )}\nCorrige uniquement ces erreurs de JSON, schéma, span, citation ou conformité technique. N'ajoute pas de claim pour améliorer le contenu et ne cherche pas à deviner une réponse attendue.`;
}

// Interface profonde unique : construction du prompt, retries techniques,
// validation, offsets UTF-8, guardrails et matérialisation restent derrière ce seam.
export async function extractProseFragment(input, { modelAdapter }) {
  const { fragment, citationCatalog, vocabularies, predictionSchema, runConfig } = input;
  const schemaValidator = createPredictionValidator(predictionSchema);
  const initialInput = buildPromptInput({ fragment, citationCatalog, vocabularies });
  assertNoGoldenLeak(`${E5_SYSTEM_PROMPT}\n${initialInput}`);
  const attempts = [];
  let promptInput = initialInput;
  for (let attempt = 0; attempt <= runConfig.maxRetries; attempt += 1) {
    const response = await modelAdapter.generate({
      systemPrompt: E5_SYSTEM_PROMPT,
      input: promptInput,
      outputSchema: predictionSchema,
      runConfig,
      fragmentId: fragment.fragmentId,
      attempt
    });
    const validation = validateAndMaterialize({
      rawResponse: response.rawResponse,
      expectedFragment: fragment,
      citationCatalog,
      schemaValidator,
      runConfig
    });
    attempts.push({
      attempt,
      promptInput,
      rawResponse: response.rawResponse,
      providerResponse: response.providerResponse ?? null,
      responseId: response.responseId ?? null,
      modelVersion: response.modelVersion ?? null,
      usage: response.usage ?? null,
      latencyMs: response.latencyMs ?? null,
      validation: {
        accepted: validation.accepted,
        retryable: validation.retryable,
        diagnostics: validation.diagnostics
      }
    });
    if (validation.accepted) {
      return {
        fragmentId: fragment.fragmentId,
        status: 'VALIDATED',
        prediction: validation.prediction,
        diagnostics: validation.diagnostics,
        attempts
      };
    }
    if (!validation.retryable || attempt === runConfig.maxRetries) {
      return {
        fragmentId: fragment.fragmentId,
        status: 'REJECTED',
        prediction: null,
        diagnostics: validation.diagnostics,
        attempts
      };
    }
    promptInput = retryPrompt(initialInput, validation.diagnostics);
    assertNoGoldenLeak(`${E5_SYSTEM_PROMPT}\n${promptInput}`);
  }
  throw new Error('unreachable_retry_state');
}
