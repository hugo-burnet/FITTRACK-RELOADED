import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function readJson(root, relativePath) {
  return JSON.parse(readFileSync(join(root, relativePath), 'utf8'));
}

function vocabularyTerms(root, name) {
  return readJson(root, `vocabularies/${name}.vocab.json`).terms.map((item) => item.term);
}

export function loadBenchmarkInputs(root) {
  const selection = readJson(root, 'candidates/e5-prose-golden-manifest.json');
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
  const orderedIds = selection.fragments.map((item) => item.fragmentId);
  if (orderedIds.length !== 100 || new Set(orderedIds).size !== 100) {
    throw new Error(`benchmark_manifest_must_contain_exactly_100_unique_fragments:${orderedIds.length}`);
  }
  const inputs = orderedIds.map((fragmentId) => {
    const fragment = fragmentById.get(fragmentId);
    if (!fragment) throw new Error(`benchmark_fragment_missing:${fragmentId}`);
    return {
      fragment,
      citationCatalog: citationsByFragment.get(fragmentId) ?? []
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
  if (counts.F2 !== 50 || counts.F3 !== 50) {
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
