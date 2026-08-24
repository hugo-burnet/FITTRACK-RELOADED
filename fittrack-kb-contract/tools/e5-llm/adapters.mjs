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

export function createOpenAIAdapter({ apiKey, fetchImpl = globalThis.fetch, endpoint = 'https://api.openai.com/v1/responses' }) {
  if (!apiKey) throw new Error('OPENAI_API_KEY is required for provider=openai');
  if (typeof fetchImpl !== 'function') throw new Error('fetch implementation is required');
  return {
    async generate({ systemPrompt, input, outputSchema, runConfig }) {
      const started = Date.now();
      const {
        $schema: _schemaDialect,
        $id: _schemaId,
        title: _schemaTitle,
        ...providerSchema
      } = outputSchema;
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
            name: 'e5_llm_benchmark_prediction',
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
      const providerResponse = await httpResponse.json();
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
