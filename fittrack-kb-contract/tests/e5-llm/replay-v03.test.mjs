import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { loadBenchmarkInputs } from '../../tools/e5-llm/inputs.mjs';
import { replayV03Run } from '../../tools/replay-e5-v03-run.mjs';

const root = join(import.meta.dirname, '../..');
const benchmark = loadBenchmarkInputs(root);

function inputFor(fragmentId) {
  const item = benchmark.inputs.find((entry) => entry.fragment.fragmentId === fragmentId);
  assert.ok(item, `fixture fragment missing: ${fragmentId}`);
  return item;
}

// Une ancre reelle prise dans le rawText : le replay ne prouve rien si les ancres
// ne se resolvent pas comme elles se resolvaient en v0.3.
function firstSentence(fragment) {
  const match = fragment.rawText.match(/[^.\n]{40,220}\./u);
  assert.ok(match, `fixture fragment has no usable sentence: ${fragment.fragmentId}`);
  return match[0].trim();
}

function legacyClaim(anchor, overrides = {}) {
  return {
    supportAnchors: [anchor],
    rawStatementAnchorIndex: 0,
    domain: 'biomechanics',
    knowledgeTypeState: 'RESOLVED',
    knowledgeType: 'EVIDENCE',
    knowledgeTypeReason: 'Fixture.',
    epistemicStatusState: 'UNRESOLVED',
    epistemicStatus: null,
    epistemicStatusReason: 'Fixture.',
    confidenceState: 'UNRESOLVED',
    confidenceAspects: null,
    confidenceLevels: null,
    confidenceRationales: null,
    confidenceRaw: null,
    confidenceReason: null,
    directnessState: 'UNRESOLVED',
    directness: null,
    directnessReason: 'Fixture.',
    evidenceTypesState: 'UNRESOLVED',
    evidenceTypes: null,
    evidenceTypesReason: 'Fixture.',
    clinicalEvidenceLevel: null,
    supportsHypertrophySuperiority: false,
    supportsDemonstratedClinicalRisk: false,
    citationOccurrenceRefs: [],
    citationAttributionState: 'NOT_CITED',
    conditions: [],
    limitations: [],
    cannotConclude: [],
    unresolved: [],
    flags: [],
    ...overrides
  };
}

function writeJson(path, value) {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function buildSourceRun(directory, fragments) {
  writeJson(join(directory, 'config.json'), {
    runId: 'run.e5-llm-v0.fixture',
    provider: 'openrouter',
    model: 'openai/gpt-5',
    promptVersion: 'e5-llm-v0.3.0',
    providerDtoVersion: 'e5-provider-prediction-v2',
    fragmentCount: fragments.length,
    fragmentIds: fragments.map((item) => item.fragmentId)
  });
  for (const item of fragments) {
    const safeId = item.fragmentId.replaceAll('.', '_');
    item.attempts.forEach((attempt, index) => {
      writeJson(join(directory, 'raw-responses', safeId, `attempt-${index}.json`), {
        fragmentId: item.fragmentId,
        attempt: index,
        callType: index === 0 ? 'full' : 'repair',
        rawResponse: JSON.stringify(attempt),
        usage: { prompt_tokens: 10, completion_tokens: 10, cost: 0.0001 }
      });
    });
  }
}

function hashTree(directory) {
  const output = [];
  function visit(path) {
    for (const name of readdirSync(path).sort()) {
      const target = join(path, name);
      if (statSync(target).isDirectory()) visit(target);
      else output.push(`${target.slice(directory.length)}:${createHash('sha256').update(readFileSync(target)).digest('hex')}`);
    }
  }
  visit(directory);
  return output;
}

function fixture() {
  const first = inputFor('frag.f2.0001');
  const second = inputFor('frag.f2.0004');
  return [
    {
      fragmentId: first.fragment.fragmentId,
      attempts: [
        {
          annotationPrediction: 'CLAIMS',
          claims: [
            legacyClaim(firstSentence(first.fragment)),
            // Ancre absente du fragment : en v0.3 elle faisait tomber tout le
            // fragment, en v0.4 elle doit tomber seule.
            legacyClaim('cette phrase ne figure nulle part dans le fragment source')
          ]
        }
      ]
    },
    {
      fragmentId: second.fragment.fragmentId,
      attempts: [{ annotationPrediction: 'ZERO_CLAIM', claims: [] }]
    }
  ];
}

test('replay salvages valid sisters without any network call', async () => {
  const workspace = mkdtempSync(join(tmpdir(), 'e5-replay-'));
  const sourceRunRoot = join(workspace, 'source');
  const outputRoot = join(workspace, 'replay');
  buildSourceRun(sourceRunRoot, fixture());
  const realFetch = globalThis.fetch;
  globalThis.fetch = () => {
    throw new Error('replay_must_not_call_the_network');
  };
  try {
    const result = await replayV03Run({ sourceRunRoot, outputRoot });
    assert.equal(result.summary.apiCalls, 0);
    assert.equal(result.summary.fragmentCount, 2);
    const salvaged = result.records.find((item) => item.fragmentId === 'frag.f2.0001');
    assert.equal(salvaged.claimAudit.attempted, 2);
    assert.equal(salvaged.claimAudit.retained, 1);
    assert.equal(salvaged.claimAudit.filtered, 1);
    assert.equal(salvaged.status, 'PARTIALLY_VALIDATED');
    // La claim filtree reste au denominateur : c'est tout l'objet de la tache 8.
    assert.equal(result.metrics.GLOBAL.claims.attempted, 2);
    assert.equal(result.metrics.GLOBAL.claims.filtered, 1);
  } finally {
    globalThis.fetch = realFetch;
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('replay writes nothing outside the supplied output root', async () => {
  const workspace = mkdtempSync(join(tmpdir(), 'e5-replay-'));
  const sourceRunRoot = join(workspace, 'source');
  const outputRoot = join(workspace, 'replay');
  buildSourceRun(sourceRunRoot, fixture());
  const goldenBefore = hashTree(join(root, 'golden'));
  const curatedBefore = hashTree(join(root, 'curated'));
  const sourceBefore = hashTree(sourceRunRoot);
  try {
    await replayV03Run({ sourceRunRoot, outputRoot });
    assert.deepEqual(hashTree(join(root, 'golden')), goldenBefore);
    assert.deepEqual(hashTree(join(root, 'curated')), curatedBefore);
    // Le run source est une piece d'audit deja payee : le replay le lit, jamais l'inverse.
    assert.deepEqual(hashTree(sourceRunRoot), sourceBefore);
    assert.ok(readdirSync(outputRoot).includes('predictions'));
    assert.ok(readdirSync(outputRoot).includes('config.json'));
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('replay refuses a fragment whose stored response is missing', async () => {
  const workspace = mkdtempSync(join(tmpdir(), 'e5-replay-'));
  const sourceRunRoot = join(workspace, 'source');
  buildSourceRun(sourceRunRoot, fixture());
  rmSync(join(sourceRunRoot, 'raw-responses', 'frag_f2_0004'), { recursive: true, force: true });
  try {
    await assert.rejects(
      () => replayV03Run({ sourceRunRoot, outputRoot: join(workspace, 'replay') }),
      /replay_attempts_missing:frag\.f2\.0004/
    );
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('the replay run config carries no provider credential and no release verdict', async () => {
  const workspace = mkdtempSync(join(tmpdir(), 'e5-replay-'));
  const sourceRunRoot = join(workspace, 'source');
  const outputRoot = join(workspace, 'replay');
  buildSourceRun(sourceRunRoot, fixture());
  try {
    await replayV03Run({ sourceRunRoot, outputRoot });
    const config = JSON.parse(readFileSync(join(outputRoot, 'config.json'), 'utf8'));
    assert.equal(config.replay, true);
    assert.equal(config.provider, 'replay');
    assert.equal(config.apiCalls, 0);
    assert.equal(config.costUsd, 0);
    assert.equal(JSON.stringify(config).includes('sk-'), false);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
