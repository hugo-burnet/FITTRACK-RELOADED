#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createOpenRouterAdapter } from './e5-llm/adapters.mjs';
import {
  createE5ProviderPredictionSchema,
  providerPredictionToCanonical,
  PROVIDER_DTO_VERSION
} from './e5-llm/provider-dto.mjs';
import {
  DEFAULT_RUN_CONFIG_FILE,
  loadRunConfig
} from './e5-llm/run-config.mjs';
import { createPredictionValidator } from './e5-llm/validate.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const benchmarkRoot = join(root, 'benchmark/e5/v0');

function writeArtifact(artifactPath, value) {
  mkdirSync(dirname(artifactPath), { recursive: true });
  if (existsSync(artifactPath)) throw new Error(`probe_artifact_exists:${artifactPath}`);
  writeFileSync(artifactPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function configFileOf(argv) {
  if (argv.length === 0) return DEFAULT_RUN_CONFIG_FILE;
  if (argv.length === 2 && argv[0] === '--config') return argv[1];
  throw new Error(`invalid_probe_arguments:${argv.join(',')}`);
}

async function probe(argv = process.argv.slice(2)) {
  const { config, configFile } = loadRunConfig(benchmarkRoot, configFileOf(argv));
  const artifactPath = join(
    benchmarkRoot,
    'pilot',
    `provider-schema-probe.${config.runVariant}.reasoning-${config.reasoningEffort}.json`
  );
  const canonicalSchema = JSON.parse(
    readFileSync(join(benchmarkRoot, 'prediction.schema.json'), 'utf8')
  );
  const providerPredictionSchema = createE5ProviderPredictionSchema(canonicalSchema);
  if (config.provider !== 'openrouter') throw new Error(`unsupported_provider:${config.provider}`);
  const apiKey = process.env.OPENROUTER_API_KEY?.trim() || null;
  const adapter = createOpenRouterAdapter({ apiKey, baseURL: config.baseURL });
  try {
    const result = await adapter.generate({
      systemPrompt: 'Return only JSON matching the supplied schema. Do not add claims.',
      input: 'Return annotationPrediction ZERO_CLAIM and claims empty.',
      outputSchema: providerPredictionSchema,
      runConfig: {
        model: config.model,
        maxOutputTokens: 128,
        reasoningEffort: config.reasoningEffort,
        temperature: config.temperature,
        topP: config.topP,
        seed: config.seed
      }
    });
    const providerPrediction = JSON.parse(result.rawResponse);
    const providerValidator = createPredictionValidator(providerPredictionSchema);
    if (!providerValidator(providerPrediction)) throw new Error('probe_output_failed_provider_dto_schema');
    const probeFragment = {
      fragmentId: 'frag.f2.0001',
      corpusFileId: 'corpus.f2.biomechanics',
      rawText: 'Technical provider DTO probe.',
      startByte: 0
    };
    const parsed = providerPredictionToCanonical(providerPrediction, probeFragment, []);
    const canonicalValidator = createPredictionValidator(canonicalSchema);
    if (!canonicalValidator(parsed)) throw new Error('probe_output_failed_canonical_schema');
    if (
      parsed.fragmentId !== 'frag.f2.0001' ||
      parsed.annotationPrediction !== 'ZERO_CLAIM' ||
      parsed.claims.length !== 0
    ) throw new Error('probe_output_did_not_match_expected_zero_claim');
    const artifact = {
      status: 'PASS',
      provider: config.provider,
      baseURL: config.baseURL,
      runVariant: config.runVariant,
      configFile,
      requestedModel: config.model,
      reasoningEffortRequested: config.reasoningEffort,
      observedModel: result.modelVersion,
      responseId: result.responseId,
      usage: result.usage,
      reasoningTokens: result.usage?.completion_tokens_details?.reasoning_tokens ?? null,
      costUsd: result.usage?.cost ?? null,
      providerDtoVersion: PROVIDER_DTO_VERSION,
      providerSchemaDroppedKeywords: result.providerSchemaDroppedKeywords,
      providerEnumTypesInjected: result.providerEnumTypesInjected,
      providerSchemaAssertions: result.providerSchemaAssertions,
      providerDtoSchemaValidated: true,
      structuredOutputValidated: true,
      canonicalSchemaValidated: true
    };
    writeArtifact(artifactPath, artifact);
    console.log(JSON.stringify(artifact));
  } catch (error) {
    const artifact = {
      status: 'FAIL',
      provider: config.provider,
      baseURL: config.baseURL,
      runVariant: config.runVariant,
      configFile,
      requestedModel: config.model,
      reasoningEffortRequested: config.reasoningEffort,
      providerDiagnostic:
        error instanceof Error && 'providerDiagnostic' in error
          ? error.providerDiagnostic
          : {
              message: error instanceof Error ? error.message : String(error),
              providerSchemaDiagnostic:
                error instanceof Error && 'providerSchemaDiagnostic' in error
                  ? error.providerSchemaDiagnostic
                  : null
            }
    };
    writeArtifact(artifactPath, artifact);
    console.error(JSON.stringify(artifact));
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  probe();
}
