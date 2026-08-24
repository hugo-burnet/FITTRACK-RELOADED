import { projectProviderSchema } from './provider-schema.mjs';

function extractOutputText(response) {
  if (typeof response.output_text === 'string') return response.output_text;
  const parts = [];
  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === 'output_text' && typeof content.text === 'string') parts.push(content.text);
    }
  }
  return parts.join('');
}

function extractChatCompletionText(response) {
  const content = response?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((part) => part?.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join('');
}

function redactString(value) {
  return value
    .replace(/sk-or-v1-[A-Za-z0-9._~-]+/gu, '[REDACTED_OPENROUTER_KEY]')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/giu, 'Bearer [REDACTED]')
    .slice(0, 4000);
}

function redactProviderValue(value, depth = 0) {
  if (depth > 8) return '[REDACTED_DEPTH_LIMIT]';
  if (typeof value === 'string') return redactString(value);
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => redactProviderValue(item, depth + 1));
  }
  if (!value || typeof value !== 'object') return String(value);
  const output = {};
  for (const [key, item] of Object.entries(value)) {
    if (/authorization|api.?key|headers?|messages?|prompts?|request.?body|input/iu.test(key)) {
      output[key] = '[REDACTED]';
    } else {
      output[key] = redactProviderValue(item, depth + 1);
    }
  }
  return output;
}

async function readJsonResponse(httpResponse) {
  if (typeof httpResponse.text === 'function') {
    const body = await httpResponse.text();
    if (!body) return {};
    try {
      return JSON.parse(body);
    } catch {
      return { error: { message: redactString(body), type: 'non_json_response' } };
    }
  }
  return httpResponse.json();
}

function responseHeader(httpResponse, name) {
  return typeof httpResponse.headers?.get === 'function'
    ? httpResponse.headers.get(name)
    : null;
}

function openRouterErrorDiagnostic(httpResponse, providerResponse) {
  const error = providerResponse?.error ?? {};
  return {
    provider: 'openrouter',
    status: httpResponse.status,
    message: redactProviderValue(error.message ?? `HTTP ${httpResponse.status}`),
    code: redactProviderValue(error.code ?? null),
    type: redactProviderValue(error.type ?? null),
    metadata: redactProviderValue(error.metadata ?? providerResponse?.metadata ?? null),
    providerDetail: redactProviderValue(
      error.provider ?? error.upstream ?? providerResponse?.provider ?? null
    ),
    requestId: redactProviderValue(
      responseHeader(httpResponse, 'x-request-id') ??
        responseHeader(httpResponse, 'x-openrouter-request-id') ??
        providerResponse?.request_id ??
        null
    ),
    responseId: redactProviderValue(providerResponse?.id ?? null)
  };
}

export class OpenRouterHttpError extends Error {
  constructor(diagnostic) {
    super(
      `openrouter_response_error:${diagnostic.status}:${diagnostic.code ?? diagnostic.type ?? 'unknown'}:${diagnostic.message}`
    );
    this.name = 'OpenRouterHttpError';
    this.providerDiagnostic = diagnostic;
  }
}

export function createOpenAIAdapter({ apiKey, fetchImpl = globalThis.fetch, endpoint = 'https://api.openai.com/v1/responses' }) {
  if (!apiKey) throw new Error('OPENAI_API_KEY is required for provider=openai');
  if (typeof fetchImpl !== 'function') throw new Error('fetch implementation is required');
  return {
    async generate({ systemPrompt, input, outputSchema, runConfig, callType = 'full' }) {
      const started = Date.now();
      const { providerSchema } = projectProviderSchema(outputSchema);
      const body = {
        model: runConfig.model,
        instructions: systemPrompt,
        input,
        temperature: runConfig.temperature,
        top_p: runConfig.topP,
        max_output_tokens: runConfig.maxOutputTokens,
        store: false,
        text: {
          format: {
            type: 'json_schema',
            name: callType === 'repair' ? 'e5_llm_anchor_repair' : 'e5_llm_benchmark_prediction',
            strict: true,
            schema: providerSchema
          }
        }
      };
      if (runConfig.seed !== null && runConfig.seed !== undefined) body.seed = runConfig.seed;
      const httpResponse = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      const providerResponse = await readJsonResponse(httpResponse);
      if (!httpResponse.ok) {
        const safeMessage = providerResponse?.error?.message ?? `HTTP ${httpResponse.status}`;
        throw new Error(`openai_response_error:${httpResponse.status}:${safeMessage}`);
      }
      const rawResponse = extractOutputText(providerResponse);
      return {
        rawResponse,
        providerResponse,
        responseId: providerResponse.id ?? null,
        modelVersion: providerResponse.model ?? runConfig.model,
        usage: providerResponse.usage ?? null,
        latencyMs: Date.now() - started
      };
    }
  };
}

export function createOpenRouterAdapter({
  apiKey,
  fetchImpl = globalThis.fetch,
  baseURL = 'https://openrouter.ai/api/v1'
}) {
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is required for provider=openrouter');
  if (typeof fetchImpl !== 'function') throw new Error('fetch implementation is required');
  return {
    async generate({ systemPrompt, input, outputSchema, runConfig, callType = 'full' }) {
      const started = Date.now();
      const projection = projectProviderSchema(outputSchema);
      const body = {
        model: runConfig.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: input }
        ],
        max_completion_tokens: runConfig.maxOutputTokens,
        reasoning: {
          effort: runConfig.reasoningEffort
        },
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: callType === 'repair' ? 'e5_llm_anchor_repair' : 'e5_llm_benchmark_prediction',
            strict: true,
            schema: projection.providerSchema
          }
        },
        provider: {
          require_parameters: true
        }
      };
      if (runConfig.temperature !== null && runConfig.temperature !== undefined) {
        body.temperature = runConfig.temperature;
      }
      if (runConfig.topP !== null && runConfig.topP !== undefined) body.top_p = runConfig.topP;
      if (runConfig.seed !== null && runConfig.seed !== undefined) body.seed = runConfig.seed;
      const httpResponse = await fetchImpl(`${baseURL.replace(/\/$/u, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'X-OpenRouter-Metadata': 'enabled'
        },
        body: JSON.stringify(body)
      });
      const providerResponse = await readJsonResponse(httpResponse);
      if (!httpResponse.ok) {
        const diagnostic = openRouterErrorDiagnostic(httpResponse, providerResponse);
        diagnostic.providerSchemaDroppedKeywords = projection.providerSchemaDroppedKeywords;
        diagnostic.providerEnumTypesInjected = projection.providerEnumTypesInjected;
        diagnostic.providerSchemaAssertions = projection.providerSchemaAssertions;
        throw new OpenRouterHttpError(diagnostic);
      }
      return {
        rawResponse: extractChatCompletionText(providerResponse),
        providerResponse,
        responseId: providerResponse.id ?? null,
        modelVersion: providerResponse.model ?? runConfig.model,
        usage: providerResponse.usage ?? null,
        latencyMs: Date.now() - started,
        providerSchemaDroppedKeywords: projection.providerSchemaDroppedKeywords,
        providerEnumTypesInjected: projection.providerEnumTypesInjected,
        providerSchemaAssertions: projection.providerSchemaAssertions
      };
    }
  };
}

export function createReplayAdapter(responsesByFragment) {
  const cursors = new Map();
  return {
    async generate({ fragmentId }) {
      const list = responsesByFragment.get(fragmentId) ?? [];
      const cursor = cursors.get(fragmentId) ?? 0;
      const response = list[cursor];
      if (!response) throw new Error(`replay_response_missing:${fragmentId}:attempt-${cursor}`);
      cursors.set(fragmentId, cursor + 1);
      return typeof response === 'string' ? { rawResponse: response } : structuredClone(response);
    }
  };
}
