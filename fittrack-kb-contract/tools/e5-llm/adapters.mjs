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
      if (runConfig.reasoningEffort !== null && runConfig.reasoningEffort !== undefined) {
        body.reasoning = { effort: runConfig.reasoningEffort };
      }
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

export function createLlamaCppAdapter({
  fetchImpl = globalThis.fetch,
  baseURL = 'http://127.0.0.1:8080/v1'
} = {}) {
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
        max_tokens: runConfig.maxOutputTokens,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: callType === 'repair' ? 'e5_llm_anchor_repair' : 'e5_llm_benchmark_prediction',
            strict: true,
            schema: projection.providerSchema
          }
        },
        chat_template_kwargs: {
          enable_thinking: runConfig.enableThinking ?? false
        }
      };
      if (runConfig.temperature !== null && runConfig.temperature !== undefined) {
        body.temperature = runConfig.temperature;
      }
      if (runConfig.topP !== null && runConfig.topP !== undefined) body.top_p = runConfig.topP;
      if (runConfig.topK !== null && runConfig.topK !== undefined) body.top_k = runConfig.topK;
      if (runConfig.minP !== null && runConfig.minP !== undefined) body.min_p = runConfig.minP;
      if (runConfig.presencePenalty !== null && runConfig.presencePenalty !== undefined) {
        body.presence_penalty = runConfig.presencePenalty;
      }
      if (runConfig.seed !== null && runConfig.seed !== undefined) body.seed = runConfig.seed;
      const httpResponse = await fetchImpl(
        `${baseURL.replace(/\/$/u, '')}/chat/completions`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        }
      );
      const providerResponse = await readJsonResponse(httpResponse);
      if (!httpResponse.ok) {
        const message = providerResponse?.error?.message ?? `HTTP ${httpResponse.status}`;
        throw new Error(`llamacpp_response_error:${httpResponse.status}:${message}`);
      }
      const usage = providerResponse.usage ?? {
        prompt_tokens: providerResponse.timings?.prompt_n ?? 0,
        completion_tokens: providerResponse.timings?.predicted_n ?? 0,
        total_tokens:
          (providerResponse.timings?.prompt_n ?? 0) +
          (providerResponse.timings?.predicted_n ?? 0),
        cost: 0
      };
      return {
        rawResponse: extractChatCompletionText(providerResponse),
        providerResponse,
        responseId: providerResponse.id ?? null,
        modelVersion: providerResponse.model ?? runConfig.model,
        usage: { ...usage, cost: 0 },
        latencyMs: Date.now() - started,
        localMetrics: providerResponse.timings ?? null,
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

// Grok en ligne de commande, installé localement (`grok.exe`).
//
// Ce n'est pas un endpoint de complétion mais un agent : sans précaution, chaque
// appel traîne ~15 500 tokens d'entrée de contexte d'outillage, mesurés sur une
// question triviale. Trois options les suppriment, et elles ne sont pas
// optionnelles : `--system-prompt-override` remplace le prompt de l'agent par le
// nôtre, `--tools ''` retire les outils intégrés, `--disable-web-search` coupe
// le reste. Un extracteur qui peut aller chercher sur le web n'extrait plus, il
// complète — et c'est précisément ce que tout le contrat sert à empêcher.
//
// Le prompt passe par un fichier : un fragment de prose dépasse largement la
// longueur d'argument que Windows accepte, et `--prompt-file` existe pour ça.
export function createGrokCliAdapter({
  binaryPath = 'grok',
  execFileImpl,
  tempDir
} = {}) {
  return {
    async generate({ systemPrompt, input, outputSchema, runConfig, callType = 'full' }) {
      const started = Date.now();
      const projection = projectProviderSchema(outputSchema);
      const { execFile } = await import('node:child_process');
      const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
      const { join } = await import('node:path');
      const { tmpdir } = await import('node:os');
      const run = execFileImpl ?? ((file, args, options) =>
        new Promise((resolve, reject) => {
          execFile(file, args, options, (error, stdout, stderr) => {
            if (error) {
              error.stdout = stdout;
              error.stderr = stderr;
              reject(error);
              return;
            }
            resolve({ stdout, stderr });
          });
        }));

      const directory = mkdtempSync(join(tempDir ?? tmpdir(), 'e5-grok-'));
      const promptFile = join(directory, 'prompt.txt');
      writeFileSync(promptFile, input, 'utf8');
      try {
        const args = [
          '--prompt-file', promptFile,
          '--system-prompt-override', systemPrompt,
          '--json-schema', JSON.stringify(projection.providerSchema),
          '--output-format', 'json',
          '--max-turns', '1',
          '--tools', '',
          '--disable-web-search'
        ];
        if (runConfig.model) args.push('--model', runConfig.model);
        const { stdout } = await run(binaryPath, args, {
          encoding: 'utf8',
          maxBuffer: 64 * 1024 * 1024,
          timeout: runConfig.requestTimeoutMs ?? 600000
        });
        const providerResponse = JSON.parse(stdout);
        // `structuredOutput` est déjà l'objet contraint par le schéma. On
        // renvoie tout de même sa forme texte : le validateur canonique du
        // contrat parse lui-même, et lui donner l'objet court-circuiterait une
        // vérification qu'on veut garder.
        const rawResponse = providerResponse.structuredOutput === undefined
          ? providerResponse.text
          : JSON.stringify(providerResponse.structuredOutput);
        const usage = providerResponse.usage ?? {};
        return {
          rawResponse,
          providerResponse,
          responseId: providerResponse.requestId ?? providerResponse.sessionId ?? null,
          modelVersion: Object.keys(providerResponse.modelUsage ?? {})[0] ?? runConfig.model,
          usage: {
            inputTokens: usage.input_tokens ?? 0,
            outputTokens: (usage.output_tokens ?? 0) + (usage.reasoning_tokens ?? 0),
            // Le coût est rapporté par la CLI elle-même : on ne le remodélise
            // pas à partir d'une grille tarifaire qui dériverait en silence.
            cost: providerResponse.total_cost_usd ?? 0
          },
          latencyMs: Date.now() - started,
          callType,
          providerSchemaDroppedKeywords: projection.providerSchemaDroppedKeywords,
          providerEnumTypesInjected: projection.providerEnumTypesInjected,
          providerSchemaAssertions: projection.providerSchemaAssertions
        };
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    }
  };
}
