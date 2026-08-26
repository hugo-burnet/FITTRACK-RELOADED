#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createGrokCliAdapter,
  createLlamaCppAdapter,
  createOpenRouterAdapter
} from './e5-llm/adapters.mjs';
import { extractProseFragment } from './e5-llm/extractor.mjs';
import {
  APPROVAL_FLAGS,
  loadBenchmarkInputs,
  PILOT_FRAGMENT_IDS,
  STAGE_REQUIREMENTS
} from './e5-llm/inputs.mjs';
import {
  createE5ProviderPredictionSchema,
  createE5AnchorRepairSchema,
  ANCHOR_REPAIR_DTO_VERSION,
  PROVIDER_DTO_VERSION
} from './e5-llm/provider-dto.mjs';
import { projectProviderSchema } from './e5-llm/provider-schema.mjs';
import {
  DEFAULT_RUN_CONFIG_FILE,
  loadRunConfig
} from './e5-llm/run-config.mjs';
import {
  assertNoGoldenLeak,
  buildPromptInput,
  E5_SYSTEM_PROMPT,
  PROMPT_VERSION,
  sha256Text
} from './e5-llm/prompt.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const repositoryRoot = resolve(root, '..');
const benchmarkRoot = join(root, 'benchmark/e5/v0');
const miniComparisonRoot = join(benchmarkRoot, 'mini-comparison');
const miniManifestPath = join(miniComparisonRoot, 'manifest.json');

function createProviderAdapter(base, apiKey) {
  if (base.provider === 'openrouter') {
    return createOpenRouterAdapter({ apiKey, baseURL: base.baseURL });
  }
  if (base.provider === 'llamacpp') {
    return createLlamaCppAdapter({ baseURL: base.baseURL });
  }
  // La CLI Grok est locale : aucune clé à lire, mais un binaire à localiser.
  // GROK_BIN existe parce que l'exécutable n'est pas toujours dans le PATH du
  // processus qui lance le banc, même quand il l'est dans celui de l'opérateur.
  if (base.provider === 'grok-cli') {
    return createGrokCliAdapter({ binaryPath: process.env.GROK_BIN ?? 'grok' });
  }
  throw new Error(`unsupported_provider:${base.provider}`);
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function tokenCount(usage, ...names) {
  for (const name of names) {
    if (Number.isFinite(usage?.[name])) return usage[name];
  }
  return 0;
}

function actualResponseCost(response, runConfig) {
  const usage = response.usage ?? {};
  if (Number.isFinite(usage.cost)) return Number(usage.cost.toFixed(8));
  const inputTokens = tokenCount(usage, 'prompt_tokens', 'input_tokens');
  const outputTokens = tokenCount(usage, 'completion_tokens', 'output_tokens');
  const rates = runConfig.pricingUsdPerMillionTokens;
  return Number(
    (
      (inputTokens / 1_000_000) * rates.input +
      (outputTokens / 1_000_000) * rates.output
    ).toFixed(8)
  );
}

export function conservativeCallCost({ systemPrompt, input, runConfig }) {
  const approximateInputTokens = Math.ceil(
    Buffer.byteLength(`${systemPrompt}\n${input}`, 'utf8') / 4
  );
  const maximumOutputTokens = runConfig.maxOutputTokens;
  const rates = runConfig.pricingUsdPerMillionTokens;
  return {
    approximateInputTokens,
    maximumOutputTokens,
    estimateUsd: Number(
      (
        (approximateInputTokens / 1_000_000) * rates.input +
        (maximumOutputTokens / 1_000_000) * rates.output
      ).toFixed(8)
    )
  };
}

export function createBudgetedAdapter(adapter, runConfig, onLedgerChange) {
  const ledger = {
    schemaVersion: '1.0.0-e5-llm-budget-ledger',
    capUsd: runConfig.maxRunCostUsd,
    actualCostUsd: 0,
    stoppedBeforeCall: null,
    calls: []
  };
  onLedgerChange(ledger);
  return {
    ledger,
    adapter: {
      async generate(request) {
        const conservative = conservativeCallCost(request);
        const projectedUsd = Number(
          (ledger.actualCostUsd + conservative.estimateUsd).toFixed(8)
        );
        const preflight = {
          sequence: ledger.calls.length + 1,
          fragmentId: request.fragmentId,
          callType: request.callType,
          attempt: request.attempt,
          actualCostBeforeUsd: ledger.actualCostUsd,
          conservativeNextCallEstimateUsd: conservative.estimateUsd,
          projectedCostUsd: projectedUsd,
          budgetRemainingBeforeUsd: Number(
            (ledger.capUsd - ledger.actualCostUsd).toFixed(8)
          ),
          approximateInputTokens: conservative.approximateInputTokens,
          maximumOutputTokens: conservative.maximumOutputTokens,
          allowed: projectedUsd <= ledger.capUsd
        };
        if (!preflight.allowed) {
          ledger.stoppedBeforeCall = preflight;
          onLedgerChange(ledger);
          const error = new Error(
            `budget_stop_before_call:${ledger.actualCostUsd}:${conservative.estimateUsd}:${ledger.capUsd}`
          );
          error.budgetStop = true;
          error.budgetPreflight = preflight;
          throw error;
        }
        const response = await adapter.generate(request);
        const actualCallCostUsd = actualResponseCost(response, request.runConfig);
        ledger.actualCostUsd = Number(
          (ledger.actualCostUsd + actualCallCostUsd).toFixed(8)
        );
        ledger.calls.push({
          ...preflight,
          actualCallCostUsd,
          actualCostAfterUsd: ledger.actualCostUsd,
          budgetRemainingAfterUsd: Number(
            (ledger.capUsd - ledger.actualCostUsd).toFixed(8)
          )
        });
        onLedgerChange(ledger);
        return response;
      }
    }
  };
}

const STAGE_BY_MODE = {
  'dev-20': 'DEV_20',
  'dev-100': 'DEV_100',
  'holdout-30': 'HOLDOUT_30',
  'corpus-107': 'CORPUS_107'
};

function argsOf(argv) {
  const args = {
    mode: 'dry-run',
    configFile: DEFAULT_RUN_CONFIG_FILE,
    approveCost: false,
    pilotApproved: false,
    dev20Approved: false,
    dev100Frozen: false,
    stage: null,
    manifest: null,
    resume: false,
    corpusExtraction: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--mode') args.mode = argv[++index];
    else if (argv[index] === '--config') args.configFile = argv[++index];
    else if (argv[index] === '--stage') args.stage = argv[++index];
    else if (argv[index] === '--manifest') args.manifest = argv[++index];
    else if (argv[index] === '--approve-cost') args.approveCost = true;
    else if (argv[index] === '--pilot-approved') args.pilotApproved = true;
    else if (argv[index] === '--dev20-approved') args.dev20Approved = true;
    else if (argv[index] === '--dev100-frozen') args.dev100Frozen = true;
    else if (argv[index] === '--resume') args.resume = true;
    else if (argv[index] === '--corpus-extraction') args.corpusExtraction = true;
    else throw new Error(`unknown_argument:${argv[index]}`);
  }
  const modes = ['dry-run', 'pilot', 'mini', 'full', 'dev-20', 'dev-100', 'holdout-30', 'corpus-107'];
  if (!modes.includes(args.mode)) throw new Error(`invalid_mode:${args.mode}`);
  if (!args.stage) args.stage = STAGE_BY_MODE[args.mode] ?? null;
  return args;
}

function holdoutGoldValidated(benchmarkRootPath) {
  const marker = join(benchmarkRootPath, 'holdout-30', 'validation.json');
  if (!existsSync(marker)) return false;
  try {
    return JSON.parse(readFileSync(marker, 'utf8')).status === 'VALIDATED';
  } catch {
    return false;
  }
}

// Toutes les approbations sont verifiees AVANT la construction de l adaptateur
// provider : un etage non approuve ne doit pas pouvoir echouer apres avoir deja
// depense un appel.
export function assertStageApprovals(stage, args, benchmarkRootPath = benchmarkRoot) {
  const requirements = STAGE_REQUIREMENTS[stage];
  if (!requirements) throw new Error(`unknown_benchmark_stage:${stage}`);
  for (const approval of requirements.approvals) {
    if (!args[approval]) {
      throw new Error(`stage_requires_approval:${stage}:${APPROVAL_FLAGS[approval]}`);
    }
  }
  if (stage === 'HOLDOUT_30' && !holdoutGoldValidated(benchmarkRootPath)) {
    throw new Error('holdout_gold_not_validated');
  }
  return true;
}

function loadMiniComparisonInputs(benchmark) {
  const manifest = JSON.parse(readFileSync(miniManifestPath, 'utf8'));
  if (manifest.selectionState !== 'FROZEN_BEFORE_FIRST_MODEL_CALL') {
    throw new Error('mini_manifest_not_frozen');
  }
  if (
    manifest.promptVersion !== PROMPT_VERSION ||
    manifest.providerDtoVersion !== PROVIDER_DTO_VERSION
  ) {
    throw new Error('mini_manifest_protocol_mismatch');
  }
  if (
    manifest.fragmentIds.length !== 5 ||
    new Set(manifest.fragmentIds).size !== 5 ||
    manifest.cases.length !== 5
  ) {
    throw new Error('mini_manifest_requires_exactly_five_unique_fragments');
  }
  const caseById = new Map(manifest.cases.map((item) => [item.fragmentId, item]));
  const selectedInputs = manifest.fragmentIds.map((id) => {
    const input = benchmark.inputs.find((item) => item.fragment.fragmentId === id);
    const manifestCase = caseById.get(id);
    if (!input || !manifestCase) throw new Error(`mini_manifest_fragment_missing:${id}`);
    if (sha256Text(input.fragment.rawText) !== manifestCase.rawTextHash) {
      throw new Error(`mini_manifest_fragment_hash_mismatch:${id}`);
    }
    if (sha256Text(JSON.stringify(input.citationCatalog)) !== manifestCase.citationCatalogHash) {
      throw new Error(`mini_manifest_citation_hash_mismatch:${id}`);
    }
    return input;
  });
  return { manifest, selectedInputs };
}

function stableHash(value) {
  return createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
}

function codeCommit() {
  return execFileSync(
    'git',
    ['-c', `safe.directory=${repositoryRoot}`, 'rev-parse', 'HEAD'],
    { cwd: repositoryRoot, encoding: 'utf8', windowsHide: true }
  ).trim();
}

function buildRunConfig(base, configFile, benchmark, inputs, mode, providerProjection, repairProjection) {
  if (base.promptVersion !== PROMPT_VERSION) {
    throw new Error(`prompt_version_mismatch:${base.promptVersion}:${PROMPT_VERSION}`);
  }
  const orderedIds = inputs.map((item) => item.fragment.fragmentId);
  const currentCodeCommit = codeCommit();
  const runHash = stableHash({
    benchmarkVersion: base.benchmarkVersion,
    extractorVersion: base.extractorVersion,
    provider: base.provider,
    runVariant: base.runVariant,
    model: base.model,
    codeCommit: currentCodeCommit,
    configFile,
    promptVersion: base.promptVersion,
    promptHash: sha256Text(E5_SYSTEM_PROMPT),
    outputSchemaHash: sha256Text(JSON.stringify(benchmark.predictionSchema)),
    providerSchemaHash: sha256Text(JSON.stringify(providerProjection.providerSchema)),
    providerDtoVersion: PROVIDER_DTO_VERSION,
    anchorRepairDtoVersion: ANCHOR_REPAIR_DTO_VERSION,
    anchorRepairSchemaHash: sha256Text(JSON.stringify(repairProjection.providerSchema)),
    temperature: base.temperature,
    topP: base.topP,
    topK: base.topK,
    minP: base.minP,
    presencePenalty: base.presencePenalty,
    enableThinking: base.enableThinking,
    maxOutputTokens: base.maxOutputTokens,
    maxRepairOutputTokens: base.maxRepairOutputTokens,
    maxFullRetries: base.maxFullRetries,
    maxAnchorRepairRetries: base.maxAnchorRepairRetries,
    seed: base.seed,
    reasoningEffort: base.reasoningEffort,
    fragmentIds: orderedIds
  }).slice(0, 16);
  return {
    ...base,
    configFile,
    codeCommit: currentCodeCommit,
    runId: `run.e5-llm-v0.${runHash}`,
    mode,
    fragmentCount: inputs.length,
    fragmentIds: orderedIds,
    promptSystem: E5_SYSTEM_PROMPT,
    promptHash: sha256Text(E5_SYSTEM_PROMPT),
    outputSchemaHash: sha256Text(JSON.stringify(benchmark.predictionSchema)),
    providerSchemaHash: sha256Text(JSON.stringify(providerProjection.providerSchema)),
    providerDtoVersion: PROVIDER_DTO_VERSION,
    anchorRepairDtoVersion: ANCHOR_REPAIR_DTO_VERSION,
    anchorRepairSchemaHash: sha256Text(JSON.stringify(repairProjection.providerSchema)),
    providerSchemaDroppedKeywords: providerProjection.providerSchemaDroppedKeywords,
    providerEnumTypesInjected: providerProjection.providerEnumTypesInjected,
    providerSchemaAssertions: providerProjection.providerSchemaAssertions,
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

// Relit un fragment déjà persisté sous ce runId. Renvoie null si l'un des trois
// artefacts manque — un fragment à moitié écrit est retraité, jamais rafistolé.
export function loadPersistedResult(outputRoot, fragmentId) {
  const safeId = fragmentId.replaceAll('.', '_');
  const predictionPath = join(outputRoot, 'predictions', `${safeId}.json`);
  const diagnosticPath = join(outputRoot, 'diagnostics', `${safeId}.json`);
  const attemptDirectory = join(outputRoot, 'raw-responses', safeId);
  if (!existsSync(predictionPath) || !existsSync(diagnosticPath) || !existsSync(attemptDirectory)) {
    return null;
  }
  const prediction = JSON.parse(readFileSync(predictionPath, 'utf8'));
  const diagnostics = JSON.parse(readFileSync(diagnosticPath, 'utf8'));
  const attempts = readdirSync(attemptDirectory)
    .filter((name) => /^attempt-\d+\.json$/.test(name))
    .sort()
    .map((name) => JSON.parse(readFileSync(join(attemptDirectory, name), 'utf8')));
  if (attempts.length === 0) return null;
  return {
    fragmentId,
    status: prediction.status,
    prediction: prediction.prediction,
    diagnostics: diagnostics.diagnostics,
    claimAudit: diagnostics.claimAudit ?? null,
    coverageAudit: diagnostics.coverageAudit ?? null,
    partialAudit: diagnostics.partialAudit ?? null,
    attempts,
    usageByCallType: diagnostics.usageByCallType,
    reusedFromInterruptedRun: true
  };
}

export function persistResult(outputRoot, result, allowedRoot = benchmarkRoot) {
  // Un fragment relu depuis le disque est déjà persisté : le réécrire déclencherait
  // la garde anti-écrasement qu'on vient précisément de contourner en le relisant.
  if (result.reusedFromInterruptedRun) return;
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
      callType: attempt.callType,
      promptInput: attempt.promptInput,
      rawResponse: attempt.rawResponse,
      providerResponse: attempt.providerResponse,
      responseId: attempt.responseId,
      modelVersion: attempt.modelVersion,
      usage: attempt.usage,
      latencyMs: attempt.latencyMs,
      localMetrics: attempt.localMetrics ?? null,
      providerSchemaDroppedKeywords: attempt.providerSchemaDroppedKeywords ?? null,
      providerEnumTypesInjected: attempt.providerEnumTypesInjected ?? null,
      providerSchemaAssertions: attempt.providerSchemaAssertions ?? null,
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
    partialAudit: result.partialAudit ?? null,
    // Sans l'audit ici, l'évaluation ne peut pas retrouver les claims filtrées :
    // elles ne sont dans aucune prédiction, et le dénominateur de sécurité s'effondre.
    claimAudit: result.claimAudit ?? null,
    coverageAudit: result.coverageAudit ?? null,
    fullCallCount: result.attempts.filter((attempt) => attempt.callType === 'full').length,
    repairCallCount: result.attempts.filter((attempt) => attempt.callType === 'repair').length,
    usageByCallType: result.usageByCallType
  });
}

function emptyUsage() {
  return {
    calls: 0,
    inputTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    totalTokens: 0,
    costUsd: 0
  };
}

function aggregateUsage(results) {
  const summary = { full: emptyUsage(), repair: emptyUsage(), total: emptyUsage() };
  for (const result of results) {
    for (const category of ['full', 'repair', 'total']) {
      const usage = result.usageByCallType?.[category] ?? emptyUsage();
      for (const key of [
        'calls',
        'inputTokens',
        'outputTokens',
        'reasoningTokens',
        'totalTokens',
        'costUsd'
      ]) {
        summary[category][key] += usage[key];
      }
      summary[category].costUsd = Number(summary[category].costUsd.toFixed(8));
    }
  }
  return summary;
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
  const { config: base, configFile } = loadRunConfig(benchmarkRoot, args.configFile);
  const stageRequirements = args.stage ? STAGE_REQUIREMENTS[args.stage] : null;
  if (args.stage && !stageRequirements) throw new Error(`unknown_benchmark_stage:${args.stage}`);
  const benchmark = loadBenchmarkInputs(
    root,
    stageRequirements
      ? {
          manifestPath: args.manifest ?? stageRequirements.manifest,
          expectedCounts: stageRequirements.counts,
          production: stageRequirements.production === true
        }
      : {}
  );
  // Le prompt et le DTO du code font foi. Une config qui en epingle d autres a ete
  // ecrite pour une autre version de l extracteur : la laisser passer produirait un
  // run dont on ne saurait plus dire quel protocole il mesure.
  if (base.promptVersion && base.promptVersion !== PROMPT_VERSION) {
    throw new Error(`config_prompt_version_mismatch:${base.promptVersion}:${PROMPT_VERSION}`);
  }
  if (base.providerDtoVersion && base.providerDtoVersion !== PROVIDER_DTO_VERSION) {
    throw new Error(
      `config_provider_dto_version_mismatch:${base.providerDtoVersion}:${PROVIDER_DTO_VERSION}`
    );
  }
  const providerPredictionSchema = createE5ProviderPredictionSchema(benchmark.predictionSchema);
  const providerProjection = projectProviderSchema(providerPredictionSchema);
  const anchorRepairSchema = createE5AnchorRepairSchema();
  const repairProjection = projectProviderSchema(anchorRepairSchema);
  const mini = args.mode === 'mini' ? loadMiniComparisonInputs(benchmark) : null;
  // Le manifeste decide, pas le mode : un etage ne peut pas elargir sa selection.
  const selectedInputs = stageRequirements
    ? benchmark.inputs
    : args.mode === 'pilot'
      ? PILOT_FRAGMENT_IDS.map((id) => benchmark.inputs.find((item) => item.fragment.fragmentId === id))
      : mini?.selectedInputs ?? benchmark.inputs;
  if (selectedInputs.some((item) => !item)) throw new Error('pilot_fragment_missing');
  const promptInputs = selectedInputs.map((item) => {
    const prompt = buildPromptInput({
      fragment: item.fragment,
      citationCatalog: item.citationCatalog,
      vocabularies: benchmark.vocabularies,
      coverageUnits: item.coverageUnits
    });
    assertNoGoldenLeak(`${E5_SYSTEM_PROMPT}\n${prompt}`);
    return prompt;
  });
  const runConfig = buildRunConfig(
    base,
    configFile,
    benchmark,
    selectedInputs,
    args.mode,
    providerProjection,
    repairProjection
  );
  const costEstimate = estimateCost(runConfig, promptInputs);
  const dryRun = {
    status: costEstimate.expectedCostUsd <= runConfig.maxRunCostUsd ? 'PASS' : 'STOP',
    stage: args.stage ?? null,
    manifestPath: stageRequirements ? benchmark.manifestPath : null,
    fragmentCount: selectedInputs.length,
    split: stageRequirements
      ? benchmark.counts
      : args.mode === 'pilot'
      ? { F2: 2, F3: 1 }
      : args.mode === 'mini'
        ? selectedInputs.reduce(
            (counts, item) => {
              counts[item.fragment.corpusFileId.startsWith('corpus.f2.') ? 'F2' : 'F3'] += 1;
              return counts;
            },
            { F2: 0, F3: 0 }
          )
        : benchmark.counts,
    goldenLeakChecks: promptInputs.length,
    apiCalls: 0,
    repairPolicy: {
      maxFullRetries: runConfig.maxFullRetries,
      maxAnchorRepairRetries: runConfig.maxAnchorRepairRetries,
      maxRepairOutputTokens: runConfig.maxRepairOutputTokens
    },
    costEstimate,
    maxRunCostUsd: runConfig.maxRunCostUsd
  };
  // La racine porte l etage et le runId : un run audite n est jamais ecrase par le
  // suivant, et persistResult refuse deja d ecrire sur un artefact existant.
  const outputRoot = stageRequirements && args.mode !== 'dry-run'
    ? join(benchmarkRoot, stageRequirements.outputRoot(runConfig.runId))
    : args.mode === 'pilot'
      ? join(benchmarkRoot, 'pilot', runConfig.runVariant)
      : args.mode === 'mini'
        ? join(miniComparisonRoot, 'runs', runConfig.runVariant)
        : args.mode === 'full'
          ? join(benchmarkRoot, 'runs', runConfig.runVariant)
          : benchmarkRoot;
  const dryRunPath = args.mode === 'dry-run'
    ? join(
        benchmarkRoot,
        `dry-run.${args.stage ? `${args.stage}.` : ''}${runConfig.runVariant}.${PROMPT_VERSION}.json`
      )
    : join(outputRoot, 'dry-run.json');
  writeJson(dryRunPath, dryRun);
  console.log(`Dry-run PASS: ${selectedInputs.length} fragments; aucune fuite GOLD; 0 appel API`);
  console.log(
    `Estimation configurée: $${costEstimate.expectedCostUsd} attendus; plafond théorique $${costEstimate.maximumConfiguredCostUsd}`
  );
  console.log(`Plafond autorisé: $${runConfig.maxRunCostUsd}`);
  if (dryRun.status === 'STOP') {
    const error = new Error(
      `estimated_cost_exceeds_limit:${costEstimate.expectedCostUsd}:${runConfig.maxRunCostUsd}`
    );
    // L'estimation est déjà écrite sur disque, mais la configuration qui l'a produite
    // ne l'est pas. Sans elle, on sait que ça dépasse et pas avec quels réglages.
    error.runConfig = runConfig;
    error.dryRun = dryRun;
    throw error;
  }
  if (args.mode === 'dry-run') return { runConfig, dryRun, results: [] };
  if (args.mode === 'full' && (!args.approveCost || !args.pilotApproved)) {
    throw new Error('full_run_requires_--approve-cost_and_--pilot-approved');
  }
  if (stageRequirements) assertStageApprovals(args.stage, args);
  runConfig.configuredConcurrency = runConfig.concurrency;
  runConfig.executionConcurrency = args.mode === 'full' ? 1 : runConfig.concurrency;
  const apiKey = base.provider === 'openrouter'
    ? process.env.OPENROUTER_API_KEY?.trim() || null
    : null;
  const providerAdapter = createProviderAdapter(base, apiKey);
  assertOutputScope(outputRoot);
  writeJson(join(outputRoot, 'config.json'), { ...runConfig, costEstimate });
  const budget = createBudgetedAdapter(providerAdapter, runConfig, (ledger) => {
    writeJson(join(outputRoot, 'budget-ledger.json'), ledger);
  });
  async function runOne(item, index) {
    console.log(`[${index + 1}/${selectedInputs.length}] ${item.fragment.fragmentId}`);
    // Reprise explicite après une interruption. Le runId est un hash de la
    // configuration : retrouver des artefacts sous ce runId prouve que la config est
    // identique au bit près, donc reprendre ne mélange pas deux protocoles. Chaque
    // fragment reçoit de toute façon un appel complet et un seul.
    if (args.resume) {
      const stored = loadPersistedResult(outputRoot, item.fragment.fragmentId);
      if (stored) {
        console.log(`      déjà payé, réutilisé (${stored.status})`);
        return stored;
      }
    }
    try {
      const result = await extractProseFragment(
        {
          ...item,
          vocabularies: benchmark.vocabularies,
          predictionSchema: benchmark.predictionSchema,
          providerPredictionSchema,
          runConfig
        },
        { modelAdapter: budget.adapter }
      );
      persistResult(outputRoot, result);
      return result;
    } catch (error) {
      if (error && typeof error === 'object' && error.budgetStop === true) throw error;
      const message = error instanceof Error ? error.message : String(error);
      const providerDiagnostic =
        error instanceof Error && 'providerDiagnostic' in error
          ? error.providerDiagnostic
          : null;
      const failedUsage = emptyUsage();
      failedUsage.calls = 1;
      const failed = {
        fragmentId: item.fragment.fragmentId,
        status: 'REJECTED',
        prediction: null,
        partialAudit: null,
        diagnostics: [
          {
            code: 'PROVIDER_ERROR',
            critical: true,
            retryable: false,
            message,
            providerDiagnostic
          }
        ],
        attempts: [
          {
            attempt: 0,
            callType: 'full',
            promptInput: null,
            rawResponse: '',
            providerResponse: null,
            responseId: null,
            modelVersion: null,
            usage: null,
            latencyMs: null,
            validation: {
              accepted: false,
              retryable: false,
              diagnostics: [{ code: 'PROVIDER_ERROR', message, providerDiagnostic }],
              partialAudit: null
            }
          }
        ],
        usageByCallType: {
          full: { ...failedUsage },
          repair: emptyUsage(),
          total: { ...failedUsage }
        }
      };
      persistResult(outputRoot, failed);
      return failed;
    }
  }
  const results = [];
  let budgetStop = null;
  if (args.mode === 'full') {
    for (let index = 0; index < selectedInputs.length; index += 1) {
      try {
        results.push(await runOne(selectedInputs[index], index));
      } catch (error) {
        if (!(error && typeof error === 'object' && error.budgetStop === true)) throw error;
        budgetStop = error.budgetPreflight ?? { message: error.message };
        console.log(`STOP budget avant fragment ${selectedInputs[index].fragment.fragmentId}`);
        break;
      }
    }
  } else {
    results.push(
      ...(await runWithConcurrency(
        selectedInputs,
        runConfig.executionConcurrency,
        runOne
      ))
    );
  }
  runConfig.completedAt = new Date().toISOString();
  const usageByCallType = aggregateUsage(results);
  const summary = {
    runId: runConfig.runId,
    requestedFragmentCount: selectedInputs.length,
    fragmentCount: results.length,
    validated: results.filter((item) => item.status === 'VALIDATED').length,
    rejected: results.filter((item) => item.status === 'REJECTED').length,
    fullCalls: usageByCallType.full.calls,
    repairCalls: usageByCallType.repair.calls,
    retries: usageByCallType.repair.calls,
    rejectedResponses: results.reduce(
      (sum, item) => sum + item.attempts.filter((attempt) => !attempt.validation.accepted).length,
      0
    ),
    budgetStop,
    budget: budget.ledger,
    usageByCallType,
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
