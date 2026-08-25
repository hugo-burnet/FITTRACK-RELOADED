#!/usr/bin/env node
// Verifie un holdout SANS jamais ouvrir une sortie de modele. C est deliberement
// asymetrique : le validateur peut dire « cette GOLD est utilisable », il ne peut
// pas dire « le modele a bien repondu ». Melanger les deux ferait du holdout une
// mesure de l accord modele/annotateur, ce qu il n est pas.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256Manifest } from './scaffold-e5-v04-holdout.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const defaultRoot = join(here, '..');

// Toute cle qui ne peut venir que d une execution de modele. Leur seule presence
// prouve que la GOLD a ete contaminee, quel que soit son contenu.
const MODEL_DERIVED_KEYS = [
  'prediction',
  'predictions',
  'runId',
  'model',
  'modelVersion',
  'prompt',
  'promptInput',
  'promptVersion',
  'rawResponse',
  'providerResponse',
  'annotationPrediction',
  'usage',
  'costUsd'
];

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function assertNoModelData(value, path, where) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoModelData(item, `${path}[${index}]`, where));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const key of Object.keys(value)) {
    if (MODEL_DERIVED_KEYS.includes(key)) {
      throw new Error(`holdout_model_data_leak:${where}:${path}.${key}`);
    }
    assertNoModelData(value[key], `${path}.${key}`, where);
  }
}

function corpusOf(fragmentId, fragmentById) {
  const fragment = fragmentById.get(fragmentId);
  if (!fragment) throw new Error(`holdout_fragment_missing:${fragmentId}`);
  return fragment.corpusFileId.startsWith('corpus.f2.') ? 'F2' : 'F3';
}

function sameIdSet(left, right) {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

export function validateHoldout(holdoutRoot, options = {}) {
  const root = options.root ?? defaultRoot;
  const requireComplete = options.requireComplete ?? true;
  const manifestPath = join(holdoutRoot, 'manifest.json');
  if (!existsSync(manifestPath)) throw new Error(`holdout_manifest_missing:${holdoutRoot}`);
  const manifest = readJson(manifestPath);
  assertNoModelData(manifest, 'manifest', 'manifest.json');

  const selectionManifest = readJson(join(root, manifest.selectionManifestRef));
  const actualHash = sha256Manifest(selectionManifest);
  if (actualHash !== manifest.selectionManifestHash) {
    throw new Error(`holdout_selection_manifest_hash_mismatch:${actualHash}`);
  }

  const fragmentIds = manifest.fragmentIds ?? [];
  if (fragmentIds.length !== 30) throw new Error(`holdout_requires_30_fragments:${fragmentIds.length}`);
  if (new Set(fragmentIds).size !== 30) throw new Error('holdout_duplicate_fragment');
  const excluded = new Set(selectionManifest.excludedDev100Ids ?? []);
  for (const fragmentId of fragmentIds) {
    if (excluded.has(fragmentId)) throw new Error(`holdout_overlaps_dev100:${fragmentId}`);
  }

  const fragmentById = new Map(
    readJson(join(root, 'candidates/e5-prose-fragments.json')).fragments.map((item) => [
      item.fragmentId,
      item
    ])
  );
  const counts = fragmentIds.reduce(
    (acc, fragmentId) => {
      acc[corpusOf(fragmentId, fragmentById)] += 1;
      return acc;
    },
    { F2: 0, F3: 0 }
  );
  if (counts.F2 !== 15 || counts.F3 !== 15) {
    throw new Error(`holdout_split_invalid:${JSON.stringify(counts)}`);
  }

  const primary = readJson(join(holdoutRoot, manifest.primaryAnnotationRef));
  const secondary = readJson(join(holdoutRoot, manifest.secondaryAnnotationRef));
  assertNoModelData(primary, 'primary', manifest.primaryAnnotationRef);
  assertNoModelData(secondary, 'secondary', manifest.secondaryAnnotationRef);
  if (!primary.annotatorId || primary.annotatorId === secondary.annotatorId) {
    throw new Error('holdout_annotators_not_independent');
  }
  for (const [name, document] of [
    [manifest.primaryAnnotationRef, primary],
    [manifest.secondaryAnnotationRef, secondary]
  ]) {
    const ids = document.annotations.map((item) => item.fragmentId);
    if (!sameIdSet(ids, fragmentIds)) {
      throw new Error(`holdout_annotator_fragment_set_mismatch:${name}`);
    }
  }

  const adjudicated = readJson(join(holdoutRoot, manifest.adjudicatedAnnotationRef));
  const disagreements = readJson(join(holdoutRoot, manifest.disagreementRef));
  assertNoModelData(adjudicated, 'adjudicated', manifest.adjudicatedAnnotationRef);
  assertNoModelData(disagreements, 'disagreements', manifest.disagreementRef);

  const pending = [...primary.annotations, ...secondary.annotations].filter(
    (item) => item.annotationStatus === 'pending'
  ).length;
  const complete = pending === 0 && adjudicated.annotations.length === fragmentIds.length;

  if (requireComplete) {
    if (pending > 0) throw new Error(`holdout_annotation_incomplete:${pending}`);
    if (adjudicated.annotations.length !== fragmentIds.length) {
      throw new Error(`holdout_annotation_incomplete:adjudicated:${adjudicated.annotations.length}`);
    }
    const adjudicatedIds = new Set(adjudicated.annotations.map((item) => item.fragmentId));
    // Chaque desaccord doit avoir une decision : un desaccord non arbitre laisserait
    // deux verites concurrentes dans la GOLD.
    for (const item of disagreements.disagreements ?? []) {
      if (!adjudicatedIds.has(item.fragmentId)) {
        throw new Error(`holdout_disagreement_not_adjudicated:${item.fragmentId}`);
      }
    }
    // Les spans et citations arbitres doivent exister dans le fragment et le
    // catalogue : une GOLD qui cite une occurrence absente ne peut pas etre notee.
    const citationsByFragment = new Map();
    for (const citation of readJson(join(root, 'candidates/e5-prose-citation-occurrences.json'))
      .candidates) {
      if (!citationsByFragment.has(citation.fragmentRef)) {
        citationsByFragment.set(citation.fragmentRef, new Set());
      }
      citationsByFragment.get(citation.fragmentRef).add(citation.citationOccurrenceId);
    }
    for (const annotation of adjudicated.annotations) {
      const fragment = fragmentById.get(annotation.fragmentId);
      const byteLength = Buffer.byteLength(fragment.rawText, 'utf8');
      for (const claim of annotation.expectedClaims ?? []) {
        for (const span of claim.supportSpans ?? []) {
          if (
            !Number.isInteger(span.relativeStartByte) ||
            !Number.isInteger(span.relativeEndByte) ||
            span.relativeStartByte < 0 ||
            span.relativeEndByte > byteLength ||
            span.relativeStartByte >= span.relativeEndByte
          ) {
            throw new Error(`holdout_span_out_of_range:${annotation.fragmentId}`);
          }
        }
        const known = citationsByFragment.get(annotation.fragmentId) ?? new Set();
        for (const ref of claim.citationOccurrenceRefs ?? claim.citationOccurrenceIds ?? []) {
          if (!known.has(ref)) {
            throw new Error(`holdout_citation_unknown:${annotation.fragmentId}:${ref}`);
          }
        }
      }
    }
  }

  return {
    status: complete ? 'VALIDATED' : 'AWAITING_INDEPENDENT_ANNOTATION',
    complete,
    fragmentCount: fragmentIds.length,
    counts,
    pendingAnnotations: pending,
    adjudicatedCount: adjudicated.annotations.length
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = process.argv[2];
  if (!target) {
    console.error('usage: validate-e5-v04-holdout.mjs <holdout-root>');
    process.exitCode = 1;
  } else {
    try {
      const result = validateHoldout(target, { requireComplete: true });
      console.log(`Holdout ${result.status} : ${result.fragmentCount} fragments, ${JSON.stringify(result.counts)}`);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  }
}
