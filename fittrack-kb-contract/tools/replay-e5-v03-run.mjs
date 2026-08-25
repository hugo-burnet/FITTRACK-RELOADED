#!/usr/bin/env node
// Preuve hors-ligne du sauvetage claim par claim : on rejoue les reponses v0.3 deja
// payees a travers le validateur v0.4. Aucun appel provider n'est possible ici — le
// seul adaptateur construit est le replay, et c'est ce qui rend la comparaison
// v0.3/v0.4 honnete : le modele, le prompt et les reponses sont identiques, seule la
// validation change.
import { mkdirSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createReplayAdapter } from './e5-llm/adapters.mjs';
import { buildMetrics, errorDistribution, evaluateFragments } from './e5-llm/evaluate.mjs';
import { extractProseFragment } from './e5-llm/extractor.mjs';
import { loadBenchmarkInputs } from './e5-llm/inputs.mjs';
import {
  createE5ProviderPredictionSchema,
  LEGACY_PROVIDER_DTO_VERSION
} from './e5-llm/provider-dto.mjs';
import { PROMPT_VERSION } from './e5-llm/prompt.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const defaultOutputParent = join(root, 'benchmark/e5/v0/replays');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function safeIdOf(fragmentId) {
  return fragmentId.replaceAll('.', '_');
}

// Les tentatives sont rejouees dans l'ordre exact ou elles ont ete payees : un
// replay qui reordonne les reponses ne prouve plus rien.
function loadStoredAttempts(sourceRunRoot, fragmentId) {
  const directory = join(sourceRunRoot, 'raw-responses', safeIdOf(fragmentId));
  if (!existsSync(directory)) throw new Error(`replay_attempts_missing:${fragmentId}`);
  const names = readdirSync(directory)
    .filter((name) => /^attempt-\d+\.json$/.test(name))
    .sort((left, right) => Number(left.match(/\d+/)[0]) - Number(right.match(/\d+/)[0]));
  if (names.length === 0) throw new Error(`replay_attempts_missing:${fragmentId}`);
  return names.map((name) => readJson(join(directory, name)));
}

function replayRunConfig(sourceConfig, fragmentId, storedAttempts) {
  return {
    schemaVersion: '1.0.0-e5-llm-benchmark-prediction',
    runId: `replay.${sourceConfig.runId}`,
    model: sourceConfig.model ?? 'replay',
    temperature: 0,
    topP: 1,
    seed: null,
    maxOutputTokens: sourceConfig.maxOutputTokens ?? 8000,
    maxRepairOutputTokens: sourceConfig.maxRepairOutputTokens ?? 1000,
    // Le replay ne peut reparer que la ou une reponse de reparation a reellement
    // ete payee. Sans cette borne, l'extracteur reclamerait une reponse absente et
    // le fragment tomberait sur un PROVIDER_ERROR qui n'a jamais eu lieu.
    maxAnchorRepairRetries: Math.min(1, Math.max(0, storedAttempts.length - 1)),
    maxFullRetries: 0,
    pricingUsdPerMillionTokens: { input: 0, output: 0 }
  };
}

export async function replayV03Run({ sourceRunRoot, outputRoot, goldenAnnotations = null }) {
  const sourceConfig = readJson(join(sourceRunRoot, 'config.json'));
  const fragmentIds = sourceConfig.fragmentIds ?? [];
  if (fragmentIds.length === 0) throw new Error('replay_source_has_no_fragments');
  const benchmark = loadBenchmarkInputs(root);
  const inputById = new Map(
    benchmark.inputs.map((item) => [item.fragment.fragmentId, item])
  );
  // DTO v2 : le schema provider legacy ne porte pas de ledger de couverture, ce qui
  // desactive les controles de couverture pour ce seul chemin. Les reponses v0.3 ne
  // pouvaient pas les remplir, les exiger inventerait des echecs retroactifs.
  const providerPredictionSchema = createE5ProviderPredictionSchema(benchmark.predictionSchema, {
    dtoVersion: LEGACY_PROVIDER_DTO_VERSION
  });

  const attemptsById = new Map();
  for (const fragmentId of fragmentIds) {
    attemptsById.set(fragmentId, loadStoredAttempts(sourceRunRoot, fragmentId));
  }

  const records = [];
  for (const fragmentId of fragmentIds) {
    const item = inputById.get(fragmentId);
    if (!item) throw new Error(`replay_fragment_not_in_manifest:${fragmentId}`);
    const storedAttempts = attemptsById.get(fragmentId);
    const adapter = createReplayAdapter(
      new Map([[fragmentId, storedAttempts.map((attempt) => attempt.rawResponse)]])
    );
    const runConfig = replayRunConfig(sourceConfig, fragmentId, storedAttempts);
    const result = await extractProseFragment(
      {
        fragment: item.fragment,
        citationCatalog: item.citationCatalog,
        coverageUnits: item.coverageUnits,
        vocabularies: benchmark.vocabularies,
        predictionSchema: benchmark.predictionSchema,
        providerPredictionSchema,
        legacyClaimSalvage: true,
        runConfig
      },
      { modelAdapter: adapter }
    );
    records.push(result);
    const safeId = safeIdOf(fragmentId);
    writeJson(join(outputRoot, 'predictions', `${safeId}.json`), {
      fragmentId,
      status: result.status,
      prediction: result.prediction
    });
    writeJson(join(outputRoot, 'diagnostics', `${safeId}.json`), {
      fragmentId,
      status: result.status,
      diagnostics: result.diagnostics,
      claimAudit: result.claimAudit ?? null,
      coverageAudit: result.coverageAudit ?? null,
      partialAudit: result.partialAudit ?? null
    });
  }

  const statuses = {
    validated: records.filter((item) => item.status === 'VALIDATED').length,
    partiallyValidated: records.filter((item) => item.status === 'PARTIALLY_VALIDATED').length,
    rejected: records.filter((item) => item.status === 'REJECTED').length
  };
  const summary = {
    sourceRunId: sourceConfig.runId,
    sourcePromptVersion: sourceConfig.promptVersion,
    sourceProviderDtoVersion: sourceConfig.providerDtoVersion,
    replayPromptVersion: PROMPT_VERSION,
    fragmentCount: records.length,
    apiCalls: 0,
    costUsd: 0,
    statuses,
    claimAudit: records.reduce(
      (totals, item) => ({
        attempted: totals.attempted + (item.claimAudit?.attempted ?? 0),
        retained: totals.retained + (item.claimAudit?.retained ?? 0),
        filtered: totals.filtered + (item.claimAudit?.filtered ?? 0)
      }),
      { attempted: 0, retained: 0, filtered: 0 }
    )
  };
  writeJson(join(outputRoot, 'config.json'), {
    ...summary,
    runId: `replay.${sourceConfig.runId}`,
    provider: 'replay',
    replay: true,
    stage: 'REPLAY',
    sourceRunRoot: resolve(sourceRunRoot)
  });

  const annotations =
    goldenAnnotations ??
    (existsSync(join(root, 'golden/e5/adjudication/adjudicated.json'))
      ? readJson(join(root, 'golden/e5/adjudication/adjudicated.json')).annotations
      : []);
  const scored = annotations.filter((item) => fragmentIds.includes(item.fragmentId));
  const runRecords = records.map((item) => ({
    fragmentId: item.fragmentId,
    status: item.status,
    prediction: item.prediction,
    diagnostics: item.diagnostics,
    claimAudit: item.claimAudit ?? null,
    coverageAudit: item.coverageAudit ?? null,
    attempts: item.attempts
  }));
  const evaluation = evaluateFragments({ annotations: scored, runRecords });
  const metrics = buildMetrics(evaluation.fragmentResults);
  writeJson(join(outputRoot, 'metrics.json'), metrics);
  writeJson(join(outputRoot, 'errors.json'), {
    schemaVersion: '1.0.0-e5-llm-replay-errors',
    distribution: errorDistribution(evaluation.errors),
    errors: evaluation.errors
  });
  return { summary, metrics, errors: evaluation.errors, records, fragmentResults: evaluation.fragmentResults };
}

function argsOf(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--source-run') args.sourceRun = argv[index + 1];
    if (argv[index] === '--output') args.output = argv[index + 1];
  }
  return args;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = argsOf(process.argv.slice(2));
  if (!args.sourceRun) {
    console.error('usage: replay-e5-v03-run.mjs --source-run <path> [--output <path>]');
    process.exitCode = 1;
  } else {
    const sourceConfig = readJson(join(args.sourceRun, 'config.json'));
    const outputRoot = args.output ?? join(defaultOutputParent, `replay.${sourceConfig.runId}`);
    replayV03Run({ sourceRunRoot: args.sourceRun, outputRoot })
      .then((result) => {
        const g = result.metrics.GLOBAL;
        console.log(`Replay v0.3 -> v0.4: ${result.summary.fragmentCount} fragments, 0 appel API, $0`);
        console.log(
          `Statuts: ${result.summary.statuses.validated} validés / ${result.summary.statuses.partiallyValidated} partiels / ${result.summary.statuses.rejected} rejetés`
        );
        console.log(
          `Claims tentées/retenues/filtrées: ${result.summary.claimAudit.attempted} / ${result.summary.claimAudit.retained} / ${result.summary.claimAudit.filtered}`
        );
        console.log(
          `GOLD appariées: ${g.claims.matched}; rappel global: ${g.claims.recall === null ? 'n/a' : g.claims.recall.toFixed(4)}`
        );
        console.log('Replay : preuve de non-régression, aucun verdict de mise en production.');
      })
      .catch((error) => {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      });
  }
}
