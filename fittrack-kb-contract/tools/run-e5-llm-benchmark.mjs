#!/usr/bin/env node
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createOpenAIAdapter } from './e5-llm/adapters.mjs';
import { extractProseFragment } from './e5-llm/extractor.mjs';
import { loadBenchmarkInputs, PILOT_FRAGMENT_IDS } from './e5-llm/inputs.mjs';
import {
  assertNoGoldenLeak,
  buildPromptInput,
  E5_SYSTEM_PROMPT,
  PROMPT_VERSION,
  sha256Text
} from './e5-llm/prompt.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const benchmarkRoot = join(root, 'benchmark/e5/v0');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function argsOf(argv) {
  const args = { mode: 'dry-run', approveCost: false, pilotApproved: false };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--mode') args.mode = argv[++index];
    else if (argv[index] === '--approve-cost') args.approveCost = true;
    else if (argv[index] === '--pilot-approved') args.pilotApproved = true;
    else throw new Error(`unknown_argument:${argv[index]}`);
  }
  if (!['dry-run', 'pilot', 'full'].includes(args.mode)) throw new Error(`invalid_mode:${args.mode}`);
  return args;
}

function stableHash(value) {
  return createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
}

function buildRunConfig(base, benchmark, inputs, mode) {
  if (base.promptVersion !== PROMPT_VERSION) {
    throw new Error(`prompt_version_mismatch:${base.promptVersion}:${PROMPT_VERSION}`);
  }
  const orderedIds = inputs.map((item) => item.fragment.fragmentId);
  const runHash = stableHash({
    benchmarkVersion: base.benchmarkVersion,
    extractorVersion: base.extractorVersion,
    provider: base.provider,
    model: base.model,
    promptVersion: base.promptVersion,
    promptHash: sha256Text(E5_SYSTEM_PROMPT),
    outputSchemaHash: sha256Text(JSON.stringify(benchmark.predictionSchema)),
    temperature: base.temperature,
    topP: base.topP,
    maxOutputTokens: base.maxOutputTokens,
    seed: base.seed,
    fragmentIds: orderedIds
  }).slice(0, 16);
  return {
    ...base,
    runId: `run.e5-llm-v0.${runHash}`,
    mode,
    fragmentCount: inputs.length,
    fragmentIds: orderedIds,
    promptSystem: E5_SYSTEM_PROMPT,
    promptHash: sha256Text(E5_SYSTEM_PROMPT),
    outputSchemaHash: sha256Text(JSON.stringify(benchmark.predictionSchema)),
    corpusSnapshot: benchmark.sourceHashes.fragments,
    startedAt: new Date().toISOString(),
    completedAt: null
  };
}

function estimateCost(runConfig, promptInputs) {
  const approximateInputTokens = promptInputs.reduce(
    (sum, input) => sum + Math.ceil(Buffer.byteLength(`${E5_SYSTEM_PROMPT}\n${input}`, 'utf8') / 4),
    0
  );
  const expectedOutputTokens =
    promptInputs.length * runConfig.expectedOutputTokensPerFragment;
  const maximumOutputTokens = promptInputs.length * runConfig.maxOutputTokens;
  const inputCost =
    (approximateInputTokens / 1_000_000) * runConfig.pricingUsdPerMillionTokens.input;
  const expectedOutputCost =
    (expectedOutputTokens / 1_000_000) * runConfig.pricingUsdPerMillionTokens.output;
  const maximumOutputCost =
    (maximumOutputTokens / 1_000_000) * runConfig.pricingUsdPerMillionTokens.output;
  return {
    approximationMethod: 'UTF-8 bytes / 4 for input; configured expected and hard maximum output tokens',
    approximateInputTokens,
    expectedOutputTokens,
    maximumOutputTokens,
    configuredRatesUsdPerMillionTokens: runConfig.pricingUsdPerMillionTokens,
    expectedCostUsd: Number((inputCost + expectedOutputCost).toFixed(4)),
    maximumConfiguredCostUsd: Number((inputCost + maximumOutputCost).toFixed(4))
  };
}

function assertOutputScope(path) {
  const resolvedPath = resolve(path);
  const resolvedBenchmark = resolve(benchmarkRoot);
  const rel = relative(resolvedBenchmark, resolvedPath);
  if (rel.startsWith('..') || rel === '' && resolvedPath !== resolvedBenchmark) {
    throw new Error(`benchmark_output_outside_scope:${resolvedPath}`);
  }
  if (resolvedPath.toLocaleLowerCase().includes(`${join(root, 'curated').toLocaleLowerCase()}`)) {
    throw new Error('curated_write_forbidden');
  }
}

export function persistResult(outputRoot, result, allowedRoot = benchmarkRoot) {
  const resolvedOutput = resolve(outputRoot);
  const resolvedAllowed = resolve(allowedRoot);
  const allowedRelative = relative(resolvedAllowed, resolvedOutput);
  if (allowedRelative.startsWith('..')) throw new Error(`audit_output_outside_scope:${resolvedOutput}`);
  if (resolvedAllowed === resolve(benchmarkRoot)) assertOutputScope(outputRoot);
  const safeId = result.fragmentId.replaceAll('.', '_');
  for (const attempt of result.attempts) {
    const path = join(outputRoot, 'raw-responses', safeId, `attempt-${attempt.attempt}.json`);
    if (existsSync(path)) throw new Error(`audit_artifact_exists:${path}`);
    writeJson(path, {
      fragmentId: result.fragmentId,
      attempt: attempt.attempt,
      promptInput: attempt.promptInput,
      rawResponse: attempt.rawResponse,
      providerResponse: attempt.providerResponse,
      responseId: attempt.responseId,
      modelVersion: attempt.modelVersion,
      usage: attempt.usage,
      latencyMs: attempt.latencyMs,
      validation: attempt.validation
    });
  }
  writeJson(join(outputRoot, 'predictions', `${safeId}.json`), {
    fragmentId: result.fragmentId,
    status: result.status,
    prediction: result.prediction
  });
  writeJson(join(outputRoot, 'diagnostics', `${safeId}.json`), {
    fragmentId: result.fragmentId,
    status: result.status,
    diagnostics: result.diagnostics,
    retryCount: Math.max(0, result.attempts.length - 1)
  });
}

async function runWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function next() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => next()));
  return results;
}

export async function runBenchmark(argv = process.argv.slice(2)) {
  const args = argsOf(argv);
  const base = readJson(join(benchmarkRoot, 'config.base.json'));
  const benchmark = loadBenchmarkInputs(root);
  const selectedInputs =
    args.mode === 'pilot'
      ? PILOT_FRAGMENT_IDS.map((id) => benchmark.inputs.find((item) => item.fragment.fragmentId === id))
      : benchmark.inputs;
  if (selectedInputs.some((item) => !item)) throw new Error('pilot_fragment_missing');
  const promptInputs = selectedInputs.map((item) => {
    const prompt = buildPromptInput({
      fragment: item.fragment,
      citationCatalog: item.citationCatalog,
      vocabularies: benchmark.vocabularies
    });
    assertNoGoldenLeak(`${E5_SYSTEM_PROMPT}\n${prompt}`);
    return prompt;
  });
  const runConfig = buildRunConfig(base, benchmark, selectedInputs, args.mode);
  const costEstimate = estimateCost(runConfig, promptInputs);
  const dryRun = {
    status: 'PASS',
    fragmentCount: selectedInputs.length,
    split:
      args.mode === 'pilot'
        ? { F2: 2, F3: 1 }
        : benchmark.counts,
    goldenLeakChecks: promptInputs.length,
    apiCalls: 0,
    costEstimate
  };
  writeJson(join(benchmarkRoot, args.mode === 'pilot' ? 'pilot/dry-run.json' : 'dry-run.json'), dryRun);
  console.log(`Dry-run PASS: ${selectedInputs.length} fragments; aucune fuite GOLD; 0 appel API`);
  console.log(
    `Estimation configurée: $${costEstimate.expectedCostUsd} attendus; plafond théorique $${costEstimate.maximumConfiguredCostUsd}`
  );
  if (args.mode === 'dry-run') return { runConfig, dryRun, results: [] };
  if (args.mode === 'full' && (!args.approveCost || !args.pilotApproved)) {
    throw new Error('full_run_requires_--approve-cost_and_--pilot-approved');
  }
  if (base.provider !== 'openai') throw new Error(`unsupported_provider:${base.provider}`);
  const apiKey = process.env[base.apiKeyEnvironmentVariable];
  const adapter = createOpenAIAdapter({ apiKey });
  const outputRoot = args.mode === 'pilot' ? join(benchmarkRoot, 'pilot') : benchmarkRoot;
  assertOutputScope(outputRoot);
  writeJson(join(outputRoot, 'config.json'), { ...runConfig, costEstimate });
  const results = await runWithConcurrency(
    selectedInputs,
    runConfig.concurrency,
    async (item, index) => {
      console.log(`[${index + 1}/${selectedInputs.length}] ${item.fragment.fragmentId}`);
      try {
        const result = await extractProseFragment(
          {
            ...item,
            vocabularies: benchmark.vocabularies,
            predictionSchema: benchmark.predictionSchema,
            runConfig
          },
          { modelAdapter: adapter }
        );
        persistResult(outputRoot, result);
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const failed = {
          fragmentId: item.fragment.fragmentId,
          status: 'REJECTED',
          prediction: null,
          diagnostics: [
            {
              code: 'PROVIDER_ERROR',
              critical: true,
              retryable: false,
              message
            }
          ],
          attempts: [
            {
              attempt: 0,
              promptInput: buildPromptInput({
                fragment: item.fragment,
                citationCatalog: item.citationCatalog,
                vocabularies: benchmark.vocabularies
              }),
              rawResponse: '',
              providerResponse: null,
              responseId: null,
              modelVersion: null,
              usage: null,
              latencyMs: null,
              validation: {
                accepted: false,
                retryable: false,
                diagnostics: [{ code: 'PROVIDER_ERROR', message }]
              }
            }
          ]
        };
        persistResult(outputRoot, failed);
        return failed;
      }
    }
  );
  runConfig.completedAt = new Date().toISOString();
  const summary = {
    runId: runConfig.runId,
    fragmentCount: results.length,
    validated: results.filter((item) => item.status === 'VALIDATED').length,
    rejected: results.filter((item) => item.status === 'REJECTED').length,
    retries: results.reduce((sum, item) => sum + Math.max(0, item.attempts.length - 1), 0),
    rejectedResponses: results.reduce(
      (sum, item) => sum + item.attempts.filter((attempt) => !attempt.validation.accepted).length,
      0
    ),
    completedAt: runConfig.completedAt
  };
  writeJson(join(outputRoot, 'config.json'), { ...runConfig, costEstimate, summary });
  writeJson(join(outputRoot, 'run-summary.json'), summary);
  console.log(`Run terminé: ${summary.validated} validées, ${summary.rejected} rejetées, ${summary.retries} retries`);
  return { runConfig, dryRun, results, summary };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runBenchmark().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
