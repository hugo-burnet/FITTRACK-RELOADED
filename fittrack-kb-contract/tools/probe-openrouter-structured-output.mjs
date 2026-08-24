#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createOpenRouterAdapter } from './e5-llm/adapters.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const benchmarkRoot = join(root, 'benchmark/e5/v0');
const artifactPath = join(benchmarkRoot, 'pilot/provider-probe.json');

function writeArtifact(value) {
  mkdirSync(dirname(artifactPath), { recursive: true });
  if (existsSync(artifactPath)) throw new Error(`probe_artifact_exists:${artifactPath}`);
  writeFileSync(artifactPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function probe() {
  const config = JSON.parse(readFileSync(join(benchmarkRoot, 'config.base.json'), 'utf8'));
  if (config.provider !== 'openrouter') throw new Error(`unsupported_provider:${config.provider}`);
  const apiKey = process.env.OPENROUTER_API_KEY?.trim() || null;
  const adapter = createOpenRouterAdapter({ apiKey, baseURL: config.baseURL });
  try {
    const result = await adapter.generate({
      systemPrompt: 'Return only the structured JSON requested by the user.',
      input: 'Set ok to true.',
      outputSchema: {
        type: 'object',
        properties: { ok: { type: 'boolean' } },
        required: ['ok'],
        additionalProperties: false
      },
      runConfig: {
        model: config.model,
        maxOutputTokens: 32,
        reasoningEffort: config.reasoningEffort,
        temperature: config.temperature,
        topP: config.topP,
        seed: config.seed
      }
    });
    const parsed = JSON.parse(result.rawResponse);
    if (parsed.ok !== true || Object.keys(parsed).length !== 1) {
      throw new Error('probe_output_did_not_match_expected_schema');
    }
    const artifact = {
      status: 'PASS',
      provider: config.provider,
      baseURL: config.baseURL,
      requestedModel: config.model,
      observedModel: result.modelVersion,
      responseId: result.responseId,
      usage: result.usage,
      structuredOutputValidated: true
    };
    writeArtifact(artifact);
    console.log(JSON.stringify(artifact));
  } catch (error) {
    const artifact = {
      status: 'FAIL',
      provider: config.provider,
      baseURL: config.baseURL,
      requestedModel: config.model,
      providerDiagnostic:
        error instanceof Error && 'providerDiagnostic' in error
          ? error.providerDiagnostic
          : { message: error instanceof Error ? error.message : String(error) }
    };
    writeArtifact(artifact);
    console.error(JSON.stringify(artifact));
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  probe();
}
