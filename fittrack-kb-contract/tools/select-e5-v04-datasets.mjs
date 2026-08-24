#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateFragments } from './e5-llm/evaluate.mjs';
import { selectDev20, selectHoldout30 } from './e5-llm/v04-selection.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifestDirectory = join(root, 'benchmark/e5/v0/manifests');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function sha256File(path) {
  return `sha256:${createHash('sha256').update(readFileSync(path)).digest('hex')}`;
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function runRecords(runDirectory, config) {
  return config.fragmentIds.map((fragmentId) => {
    const safeId = fragmentId.replaceAll('.', '_');
    const prediction = readJson(join(runDirectory, 'predictions', `${safeId}.json`));
    const diagnostics = readJson(join(runDirectory, 'diagnostics', `${safeId}.json`));
    const rawDirectory = join(runDirectory, 'raw-responses', safeId);
    const attempts = readdirSync(rawDirectory)
      .filter((name) => /^attempt-\d+\.json$/u.test(name))
      .sort()
      .map((name) => readJson(join(rawDirectory, name)));
    return {
      fragmentId,
      status: prediction.status,
      prediction: prediction.prediction,
      diagnostics: diagnostics.diagnostics,
      partialAudit: diagnostics.partialAudit ?? null,
      attempts
    };
  });
}

function writeManifest(name, manifest) {
  mkdirSync(manifestDirectory, { recursive: true });
  writeFileSync(join(manifestDirectory, name), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

export function generateV04Datasets(runDirectory) {
  const resolvedRun = resolve(runDirectory);
  const configPath = join(resolvedRun, 'config.json');
  const errorsPath = join(resolvedRun, 'errors.json');
  const auditPath = join(resolvedRun, 'audit-summary.json');
  const config = readJson(configPath);
  const errors = readJson(errorsPath).errors;
  const audit = readJson(auditPath);
  const fragmentsPath = join(root, 'candidates/e5-prose-fragments.json');
  const citationsPath = join(root, 'candidates/e5-prose-citation-occurrences.json');
  const annotationsPath = join(root, 'golden/e5/adjudication/adjudicated.json');
  const selectionPath = join(root, 'candidates/e5-prose-golden-manifest.json');
  const fragments = readJson(fragmentsPath).fragments;
  const citationCandidates = readJson(citationsPath).candidates;
  const annotations = readJson(annotationsPath).annotations;
  const evaluated = evaluateFragments({ annotations, runRecords: runRecords(resolvedRun, config) });
  const partialAudits = new Map(audit.partialRejections.fragments.map((item) => [item.fragmentId, item]));
  const fragmentResults = evaluated.fragmentResults.map((item) => ({
    ...item,
    partialAudit: partialAudits.get(item.fragmentId) ?? null,
    individuallyValidClaimCount: partialAudits.get(item.fragmentId)?.individuallyValidClaimCount ?? 0
  }));
  const sourceHashes = {
    fragments: sha256File(fragmentsPath),
    citationCandidates: sha256File(citationsPath),
    dev100: sha256File(selectionPath),
    v03Config: sha256File(configPath),
    v03Errors: sha256File(errorsPath),
    v03AuditSummary: sha256File(auditPath),
    annotations: sha256File(annotationsPath)
  };
  const holdout = selectHoldout30({
    fragments,
    citationCandidates,
    dev100Ids: config.fragmentIds,
    corpusCommit: config.corpusCommit,
    sourceHashes
  });
  const dev = selectDev20({ annotations, fragmentResults, errors, sourceHashes });
  writeManifest('holdout-30.json', holdout);
  writeManifest('dev-20.json', dev);
  return { holdout, dev };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const runDirectory = argumentValue('--v03-run');
  if (!runDirectory) {
    console.error('usage: node tools/select-e5-v04-datasets.mjs --v03-run <directory>');
    process.exitCode = 1;
  } else {
    try {
      const { holdout, dev } = generateV04Datasets(runDirectory);
      console.log(`HOLDOUT-30 frozen ${holdout.counts.F2} F2/${holdout.counts.F3} F3`);
      console.log(`DEV-20 frozen ${dev.counts.F2} F2/${dev.counts.F3} F3`);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  }
}
