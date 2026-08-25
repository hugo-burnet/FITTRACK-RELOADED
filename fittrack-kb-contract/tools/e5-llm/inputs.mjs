import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { buildCoverageUnits } from './coverage.mjs';

const DEFAULT_MANIFEST = 'candidates/e5-prose-golden-manifest.json';
const MAX_STAGE_FRAGMENTS = 100;

// Aucun etage v0.4 ne peut declencher l extraction des 207 candidats : c est la
// sortie de production, elle appartient au second plan et a une approbation
// separee. Le plafond vit ici pour qu un mode ajoute plus tard ne puisse pas le
// contourner en silence.
export const STAGE_REQUIREMENTS = {
  DEV_20: {
    manifest: 'benchmark/e5/v0/manifests/dev-20.json',
    fragmentCount: 20,
    counts: { F2: 10, F3: 10 },
    approvals: ['approveCost'],
    outputRoot: (runId) => join('stages', 'dev-20', runId)
  },
  DEV_100: {
    manifest: DEFAULT_MANIFEST,
    fragmentCount: 100,
    counts: { F2: 50, F3: 50 },
    approvals: ['approveCost', 'dev20Approved'],
    outputRoot: (runId) => join('stages', 'dev-100', runId)
  },
  HOLDOUT_30: {
    manifest: 'benchmark/e5/v0/manifests/holdout-30.json',
    fragmentCount: 30,
    counts: { F2: 15, F3: 15 },
    approvals: ['approveCost', 'dev20Approved', 'dev100Frozen'],
    outputRoot: (runId) => join('stages', 'holdout-30', runId)
  }
};

export const APPROVAL_FLAGS = {
  approveCost: '--approve-cost',
  dev20Approved: '--dev20-approved',
  dev100Frozen: '--dev100-frozen'
};

function readJson(root, relativePath) {
  return JSON.parse(readFileSync(join(root, relativePath), 'utf8'));
}

function vocabularyTerms(root, name) {
  return readJson(root, `vocabularies/${name}.vocab.json`).terms.map((item) => item.term);
}

// Les manifestes ont ete geles depuis un checkout LF. Hacher les octets bruts ferait
// echouer chaque checkout CRLF, et la « reparation » evidente serait de regenerer le
// manifeste — ce qui annulerait le gel qu il est cense garantir.
function sha256Normalized(path) {
  const text = readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
  return `sha256:${createHash('sha256').update(text, 'utf8').digest('hex')}`;
}

function manifestFragmentIds(manifest) {
  if (Array.isArray(manifest.fragmentIds)) return manifest.fragmentIds;
  if (Array.isArray(manifest.fragments)) {
    return manifest.fragments.map((item) => item.fragmentId);
  }
  throw new Error('benchmark_manifest_has_no_fragment_ids');
}

function assertSourceHashes(root, manifest) {
  const paths = {
    fragments: 'candidates/e5-prose-fragments.json',
    citationCandidates: 'candidates/e5-prose-citation-occurrences.json',
    dev100: DEFAULT_MANIFEST,
    annotations: 'golden/e5/adjudication/adjudicated.json'
  };
  for (const [name, expected] of Object.entries(manifest.sourceHashes ?? {})) {
    const relativePath = paths[name];
    if (!relativePath) continue;
    const actual = sha256Normalized(join(root, relativePath));
    if (actual !== expected) {
      throw new Error(`benchmark_manifest_source_hash_mismatch:${name}:${actual}`);
    }
  }
}

export function loadBenchmarkInputs(root, options = {}) {
  const manifestPath = options.manifestPath ?? DEFAULT_MANIFEST;
  const expectedCounts = options.expectedCounts ?? { F2: 50, F3: 50 };
  const manifest = isAbsolute(manifestPath)
    ? JSON.parse(readFileSync(manifestPath, 'utf8'))
    : readJson(root, manifestPath);
  const fragmentDocument = readJson(root, 'candidates/e5-prose-fragments.json');
  const citationDocument = readJson(root, 'candidates/e5-prose-citation-occurrences.json');
  const predictionSchema = readJson(root, 'benchmark/e5/v0/prediction.schema.json');
  const fragmentById = new Map(
    fragmentDocument.fragments.map((fragment) => [fragment.fragmentId, fragment])
  );
  const citationsByFragment = new Map();
  for (const citation of citationDocument.candidates) {
    if (!citationsByFragment.has(citation.fragmentRef)) {
      citationsByFragment.set(citation.fragmentRef, []);
    }
    citationsByFragment.get(citation.fragmentRef).push(citation);
  }

  const orderedIds = manifestFragmentIds(manifest);
  const expectedTotal = expectedCounts.F2 + expectedCounts.F3;
  if (orderedIds.length > MAX_STAGE_FRAGMENTS) {
    throw new Error(`benchmark_stage_cannot_exceed_100_fragments:${orderedIds.length}`);
  }
  const seen = new Set();
  for (const fragmentId of orderedIds) {
    if (seen.has(fragmentId)) {
      throw new Error(`benchmark_manifest_duplicate_fragment:${fragmentId}`);
    }
    seen.add(fragmentId);
  }
  if (orderedIds.length !== expectedTotal) {
    throw new Error(
      `benchmark_manifest_size_invalid:${orderedIds.length}:expected:${expectedTotal}`
    );
  }
  // Un holdout qui recouvre DEV-100 n est plus aveugle : le modele a deja ete
  // mesure sur ces fragments, le score cesse d etre une estimation independante.
  const excluded = new Set(manifest.excludedDev100Ids ?? []);
  for (const fragmentId of orderedIds) {
    if (excluded.has(fragmentId)) {
      throw new Error(`benchmark_manifest_holdout_overlaps_dev100:${fragmentId}`);
    }
  }
  assertSourceHashes(root, manifest);

  const inputs = orderedIds.map((fragmentId) => {
    const fragment = fragmentById.get(fragmentId);
    if (!fragment) throw new Error(`benchmark_fragment_missing:${fragmentId}`);
    return {
      fragment,
      citationCatalog: citationsByFragment.get(fragmentId) ?? [],
      coverageUnits: buildCoverageUnits(fragment)
    };
  });
  const counts = inputs.reduce(
    (acc, item) => {
      if (item.fragment.corpusFileId.startsWith('corpus.f2.')) acc.F2 += 1;
      if (item.fragment.corpusFileId.startsWith('corpus.f3.')) acc.F3 += 1;
      return acc;
    },
    { F2: 0, F3: 0 }
  );
  if (counts.F2 !== expectedCounts.F2 || counts.F3 !== expectedCounts.F3) {
    throw new Error(`benchmark_manifest_split_invalid:${JSON.stringify(counts)}`);
  }
  const vocabularies = Object.fromEntries(
    [
      'knowledge-type',
      'epistemic-status',
      'confidence-aspect',
      'confidence-level',
      'directness',
      'evidence-type',
      'clinical-evidence-level',
      'domain'
    ].map((name) => [name, vocabularyTerms(root, name)])
  );
  return {
    inputs,
    orderedIds,
    counts,
    manifest,
    manifestPath,
    vocabularies,
    predictionSchema,
    sourceHashes: {
      fragments: fragmentDocument.corpusSnapshot.map((item) => ({
        corpusFileId: item.corpusFileId,
        contentHash: item.contentHash
      }))
    }
  };
}

export const PILOT_FRAGMENT_IDS = [
  'frag.e5f2.00033791',
  'frag.f2.0004',
  'frag.f3.0002'
];
