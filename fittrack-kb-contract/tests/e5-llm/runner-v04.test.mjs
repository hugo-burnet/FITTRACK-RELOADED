import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { buildMetrics, evaluateFragments } from '../../tools/e5-llm/evaluate.mjs';
import { loadBenchmarkInputs, STAGE_REQUIREMENTS } from '../../tools/e5-llm/inputs.mjs';
import {
  assertStageApprovals,
  loadPersistedResult,
  persistResult,
  runBenchmark
} from '../../tools/run-e5-llm-benchmark.mjs';

const root = join(import.meta.dirname, '../..');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function tempManifest(body) {
  const directory = mkdtempSync(join(tmpdir(), 'e5-manifest-'));
  const path = join(directory, 'manifest.json');
  writeFileSync(path, `${JSON.stringify(body, null, 2)}\n`, 'utf8');
  return { directory, path };
}

const dev20 = readJson(join(root, 'benchmark/e5/v0/manifests/dev-20.json'));
const holdout30 = readJson(join(root, 'benchmark/e5/v0/manifests/holdout-30.json'));

test('the manifest, not the mode, decides which fragments run', () => {
  const loaded = loadBenchmarkInputs(root, {
    manifestPath: 'benchmark/e5/v0/manifests/dev-20.json',
    expectedCounts: { F2: 10, F3: 10 }
  });
  assert.deepEqual(loaded.orderedIds, dev20.fragmentIds);
  assert.equal(loaded.inputs.length, 20);
  assert.deepEqual(loaded.counts, { F2: 10, F3: 10 });
});

test('the frozen source hashes are checked through line-ending normalization', () => {
  // Les manifestes ont ete geles sur un checkout LF. Hacher les octets bruts ferait
  // echouer tout checkout CRLF, et quelqu un « reparerait » ca en regenerant le
  // manifeste — ce qui detruirait le gel.
  const loaded = loadBenchmarkInputs(root, {
    manifestPath: 'benchmark/e5/v0/manifests/holdout-30.json',
    expectedCounts: { F2: 15, F3: 15 }
  });
  assert.equal(loaded.orderedIds.length, 30);
});

test('a manifest with a duplicate id is refused', () => {
  const { directory, path } = tempManifest({
    ...dev20,
    fragmentIds: [dev20.fragmentIds[0], ...dev20.fragmentIds.slice(0, 19)]
  });
  try {
    assert.throws(
      () => loadBenchmarkInputs(root, { manifestPath: path, expectedCounts: { F2: 10, F3: 10 } }),
      /benchmark_manifest_duplicate_fragment/
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('a manifest naming an unknown fragment is refused', () => {
  const { directory, path } = tempManifest({
    ...dev20,
    fragmentIds: [...dev20.fragmentIds.slice(0, 19), 'frag.f2.does-not-exist']
  });
  try {
    assert.throws(
      () => loadBenchmarkInputs(root, { manifestPath: path, expectedCounts: { F2: 10, F3: 10 } }),
      /benchmark_fragment_missing:frag\.f2\.does-not-exist/
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('a wrong F2/F3 split is refused', () => {
  assert.throws(
    () =>
      loadBenchmarkInputs(root, {
        manifestPath: 'benchmark/e5/v0/manifests/dev-20.json',
        expectedCounts: { F2: 15, F3: 5 }
      }),
    /benchmark_manifest_split_invalid/
  );
});

test('a tampered source hash is refused', () => {
  const { directory, path } = tempManifest({
    ...dev20,
    sourceHashes: { ...dev20.sourceHashes, fragments: 'sha256:0000' }
  });
  try {
    assert.throws(
      () => loadBenchmarkInputs(root, { manifestPath: path, expectedCounts: { F2: 10, F3: 10 } }),
      /benchmark_manifest_source_hash_mismatch:fragments/
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('a holdout overlapping DEV-100 is refused', () => {
  const { directory, path } = tempManifest({
    ...holdout30,
    fragmentIds: [holdout30.excludedDev100Ids[0], ...holdout30.fragmentIds.slice(1)]
  });
  try {
    assert.throws(
      () => loadBenchmarkInputs(root, { manifestPath: path, expectedCounts: { F2: 15, F3: 15 } }),
      /benchmark_manifest_holdout_overlaps_dev100/
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('no measurement stage may select the full 207 candidates', () => {
  // Le plafond protege les etages de MESURE. Une extraction de production peut le
  // depasser, mais seulement en se declarant comme telle et en exigeant son propre
  // drapeau — un benchmark ne peut pas glisser vers une extraction de masse.
  for (const [name, stage] of Object.entries(STAGE_REQUIREMENTS)) {
    if (stage.production) {
      assert.ok(stage.approvals.includes('corpusExtraction'), name);
      assert.ok(stage.fragmentCount < 207, name);
      continue;
    }
    assert.ok(stage.fragmentCount <= 100, name);
    assert.equal(stage.approvals.includes('corpusExtraction'), false, name);
  }
  const { directory, path } = tempManifest({
    schemaVersion: '1.0.0-e5-v04-oversized',
    dataset: 'OVERSIZED',
    fragmentIds: Array.from({ length: 207 }, (_, index) => `frag.f2.${String(index).padStart(4, '0')}`),
    counts: { F2: 207, F3: 0 }
  });
  try {
    assert.throws(
      () =>
        loadBenchmarkInputs(root, { manifestPath: path, expectedCounts: { F2: 207, F3: 0 } }),
      /benchmark_stage_cannot_exceed_100_fragments:207/
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('every paid stage states the approvals it needs', () => {
  assert.deepEqual(STAGE_REQUIREMENTS.DEV_20.approvals, ['approveCost']);
  assert.deepEqual(STAGE_REQUIREMENTS.DEV_100.approvals, ['approveCost', 'dev20Approved']);
  assert.deepEqual(STAGE_REQUIREMENTS.HOLDOUT_30.approvals, [
    'approveCost',
    'dev20Approved',
    'dev100Frozen'
  ]);
});

test('DEV-20 without --approve-cost stops before any provider adapter exists', () => {
  assert.throws(
    () => assertStageApprovals('DEV_20', { approveCost: false }),
    /stage_requires_approval:DEV_20:--approve-cost/
  );
  assert.doesNotThrow(() => assertStageApprovals('DEV_20', { approveCost: true }));
});

test('DEV-100 additionally requires --dev20-approved', () => {
  assert.throws(
    () => assertStageApprovals('DEV_100', { approveCost: true }),
    /stage_requires_approval:DEV_100:--dev20-approved/
  );
  assert.doesNotThrow(() =>
    assertStageApprovals('DEV_100', { approveCost: true, dev20Approved: true })
  );
});

test('HOLDOUT-30 additionally requires --dev100-frozen and validated holdout GOLD', () => {
  assert.throws(
    () => assertStageApprovals('HOLDOUT_30', { approveCost: true, dev20Approved: true }),
    /stage_requires_approval:HOLDOUT_30:--dev100-frozen/
  );
  assert.throws(
    () =>
      assertStageApprovals('HOLDOUT_30', {
        approveCost: true,
        dev20Approved: true,
        dev100Frozen: true
      }),
    /holdout_gold_not_validated/
  );
});

test('a dry-run performs zero API calls and writes the estimate', async () => {
  const result = await runBenchmark([
    '--mode',
    'dry-run',
    '--stage',
    'DEV_20',
    '--manifest',
    'benchmark/e5/v0/manifests/dev-20.json',
    '--config',
    'config.gpt-5.json'
  ]);
  assert.equal(result.dryRun.apiCalls, 0);
  assert.equal(result.dryRun.fragmentCount, 20);
  assert.deepEqual(result.dryRun.split, { F2: 10, F3: 10 });
  assert.equal(result.dryRun.stage, 'DEV_20');
  assert.equal(result.results.length, 0);
  assert.equal(result.dryRun.goldenLeakChecks, 20);
});

test('a paid stage refuses to start without its approvals, before touching the network', async () => {
  await assert.rejects(
    () =>
      runBenchmark([
        '--mode',
        'dev-20',
        '--manifest',
        'benchmark/e5/v0/manifests/dev-20.json',
        '--config',
        'config.gpt-5.json'
      ]),
    /stage_requires_approval:DEV_20:--approve-cost/
  );
});

test('a stage is scored only against the fragments it attempted', () => {
  // Un etage de 20 fragments note contre les 100 annotations GOLD transforme les 80
  // absents en MISSING_PREDICTION, donc en rejets : le rappel s effondre et le run
  // parait catastrophique alors qu il n a rien rate. C est arrive une fois.
  const adjudicated = readJson(join(root, 'golden/e5/adjudication/adjudicated.json'));
  const scoredIds = new Set(dev20.fragmentIds);
  const scored = adjudicated.annotations.filter((item) => scoredIds.has(item.fragmentId));
  assert.equal(scored.length, 20);
  const runRecords = dev20.fragmentIds.map((fragmentId) => ({
    fragmentId,
    status: 'VALIDATED',
    prediction: { annotationPrediction: 'ZERO_CLAIM', claims: [] },
    diagnostics: [],
    claimAudit: { attempted: 0, retained: 0, filtered: 0, claims: [] },
    attempts: []
  }));
  const all = evaluateFragments({ annotations: adjudicated.annotations, runRecords });
  const filtered = evaluateFragments({ annotations: scored, runRecords });
  assert.equal(buildMetrics(all.fragmentResults).GLOBAL.rejectedFragments, 80);
  assert.equal(buildMetrics(filtered.fragmentResults).GLOBAL.rejectedFragments, 0);
});

test('output roots carry the stage and the runId so an audited run is never overwritten', () => {
  const first = STAGE_REQUIREMENTS.DEV_20.outputRoot('run.abc');
  const second = STAGE_REQUIREMENTS.DEV_20.outputRoot('run.def');
  assert.notEqual(first, second);
  assert.ok(first.includes('dev-20'));
  assert.ok(first.includes('run.abc'));
});

test('resume reuses a paid fragment and refuses a half-written one', () => {
  // Une interruption laisse un run a moitie paye. Le runId etant un hash de la
  // configuration, retrouver des artefacts sous ce runId prouve que la config est
  // identique — reprendre ne melange donc pas deux protocoles. Sans ca, il faut
  // repayer les fragments deja obtenus.
  const workspace = mkdtempSync(join(tmpdir(), 'e5-resume-'));
  const safeId = 'frag_f2_0001';
  try {
    assert.equal(loadPersistedResult(workspace, 'frag.f2.0001'), null);

    mkdirSync(join(workspace, 'predictions'), { recursive: true });
    mkdirSync(join(workspace, 'diagnostics'), { recursive: true });
    mkdirSync(join(workspace, 'raw-responses', safeId), { recursive: true });
    writeFileSync(
      join(workspace, 'predictions', `${safeId}.json`),
      JSON.stringify({ fragmentId: 'frag.f2.0001', status: 'VALIDATED', prediction: { claims: [] } })
    );
    writeFileSync(
      join(workspace, 'diagnostics', `${safeId}.json`),
      JSON.stringify({ diagnostics: [], claimAudit: { attempted: 0 }, usageByCallType: {} })
    );
    // Prediction et diagnostics presents mais aucune tentative : fragment a moitie
    // ecrit, il doit etre retraite plutot que rafistole.
    assert.equal(loadPersistedResult(workspace, 'frag.f2.0001'), null);

    writeFileSync(
      join(workspace, 'raw-responses', safeId, 'attempt-0.json'),
      JSON.stringify({ attempt: 0, callType: 'full', rawResponse: '{}' })
    );
    const reused = loadPersistedResult(workspace, 'frag.f2.0001');
    assert.equal(reused.status, 'VALIDATED');
    assert.equal(reused.attempts.length, 1);
    assert.equal(reused.reusedFromInterruptedRun, true);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('persistResult never rewrites a reused fragment', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'e5-resume-'));
  try {
    // Reecrire declencherait la garde anti-ecrasement qu on vient de contourner.
    assert.doesNotThrow(() =>
      persistResult(workspace, { fragmentId: 'frag.f2.0001', reusedFromInterruptedRun: true }, workspace)
    );
    assert.equal(existsSync(join(workspace, 'predictions')), false);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('the 100-fragment cap only lifts on an explicit production declaration', () => {
  // Le deduire des compteurs attendus le rendrait contournable par tout appelant qui
  // passe un grand nombre. Seule la declaration d etage le leve.
  const corpus = readJson(join(root, 'benchmark/e5/v0/manifests/corpus-107.json'));
  assert.throws(
    () =>
      loadBenchmarkInputs(root, {
        manifestPath: 'benchmark/e5/v0/manifests/corpus-107.json',
        expectedCounts: corpus.counts
      }),
    /benchmark_stage_cannot_exceed_100_fragments:107/
  );
  const loaded = loadBenchmarkInputs(root, {
    manifestPath: 'benchmark/e5/v0/manifests/corpus-107.json',
    expectedCounts: corpus.counts,
    production: true
  });
  assert.equal(loaded.inputs.length, 107);
});

test('the corpus manifest records which fragments came from the blind holdout', () => {
  // Utiliser le holdout dans le corpus supprime la validation independante. C est une
  // porte a sens unique : le manifeste garde de quoi la rouvrir.
  const corpus = readJson(join(root, 'benchmark/e5/v0/manifests/corpus-107.json'));
  assert.equal(corpus.holdoutFragmentIds.length, 30);
  assert.equal(
    corpus.holdoutFragmentIds.every((id) => corpus.fragmentIds.includes(id)),
    true
  );
});
