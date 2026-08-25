#!/usr/bin/env node
// Prepare l espace de noms d annotation du holdout aveugle, et rien d autre. Aucune
// sortie de modele n entre ici : si un annotateur voyait une prediction avant
// d ecrire la sienne, le holdout cesserait d etre une estimation independante et
// mesurerait l accord avec le modele plutot que la verite du corpus.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

export const HOLDOUT_SCHEMA_VERSION = '1.0.0-e5-v04-holdout-30';
export const ANNOTATION_SCHEMA_REF = '../e5/annotation.schema.json';

// Le hachage normalise les fins de ligne : les manifestes ont ete geles depuis un
// checkout LF, et un checkout CRLF ne doit pas ressembler a une falsification.
export function sha256Manifest(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return `sha256:${createHash('sha256').update(text.replace(/\r\n/g, '\n'), 'utf8').digest('hex')}`;
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function blankAnnotations(fragmentIds, annotatorId, annotationRole) {
  return {
    schemaVersion: HOLDOUT_SCHEMA_VERSION,
    annotatorId,
    annotationRole,
    annotationSchemaRef: ANNOTATION_SCHEMA_REF,
    annotations: fragmentIds.map((fragmentId) => ({
      fragmentId,
      annotationStatus: 'pending',
      expectedClaims: [],
      ambiguities: []
    }))
  };
}

export function scaffoldHoldout({ freezeManifest, selectionManifest, outputRoot }) {
  if (!freezeManifest) throw new Error('holdout_freeze_manifest_required');
  if (freezeManifest.status !== 'FROZEN_BEFORE_HOLDOUT_ANNOTATION') {
    throw new Error(`holdout_not_frozen:${freezeManifest.status ?? 'missing'}`);
  }
  // Annoter le holdout avant le gel de DEV-100 laisserait le protocole bouger entre
  // les deux mesures : le holdout ne validerait plus le meme extracteur.
  if (freezeManifest.dev100Frozen !== true) throw new Error('holdout_requires_frozen_dev100');
  if (!selectionManifest) throw new Error('holdout_selection_manifest_required');

  const fragmentIds = selectionManifest.fragmentIds ?? [];
  if (fragmentIds.length !== 30) {
    throw new Error(`holdout_requires_30_fragments:${fragmentIds.length}`);
  }
  if (new Set(fragmentIds).size !== 30) throw new Error('holdout_duplicate_fragment');
  const excluded = new Set(selectionManifest.excludedDev100Ids ?? []);
  for (const fragmentId of fragmentIds) {
    if (excluded.has(fragmentId)) throw new Error(`holdout_overlaps_dev100:${fragmentId}`);
  }
  const counts = selectionManifest.counts ?? {};
  if (counts.F2 !== 15 || counts.F3 !== 15) {
    throw new Error(`holdout_split_invalid:${JSON.stringify(counts)}`);
  }

  const manifest = {
    schemaVersion: HOLDOUT_SCHEMA_VERSION,
    status: 'AWAITING_INDEPENDENT_ANNOTATION',
    dataset: 'HOLDOUT-30',
    annotationSchemaRef: ANNOTATION_SCHEMA_REF,
    selectionManifestRef: freezeManifest.selectionManifestRef,
    selectionManifestHash: sha256Manifest(selectionManifest),
    candidateCodeCommit: freezeManifest.candidateCodeCommit ?? null,
    fragmentCount: fragmentIds.length,
    perCorpusFile: counts,
    fragmentIds,
    primaryAnnotationRef: 'annotations/annotator-a.json',
    secondaryAnnotationRef: 'annotations/annotator-b.json',
    adjudicatedAnnotationRef: 'adjudication/adjudicated.json',
    disagreementRef: 'adjudication/disagreements.json'
  };

  writeJson(join(outputRoot, 'manifest.json'), manifest);
  writeJson(
    join(outputRoot, 'annotations/annotator-a.json'),
    blankAnnotations(fragmentIds, 'holdout-annotator-a', 'primary')
  );
  writeJson(
    join(outputRoot, 'annotations/annotator-b.json'),
    blankAnnotations(fragmentIds, 'holdout-annotator-b', 'secondary')
  );
  writeJson(join(outputRoot, 'adjudication/adjudicated.json'), {
    schemaVersion: HOLDOUT_SCHEMA_VERSION,
    annotatorId: 'holdout-adjudicator',
    annotationRole: 'adjudicated',
    annotations: []
  });
  writeJson(join(outputRoot, 'adjudication/disagreements.json'), {
    schemaVersion: HOLDOUT_SCHEMA_VERSION,
    comparedAnnotators: ['holdout-annotator-a', 'holdout-annotator-b'],
    comparisonMethod: 'pending',
    disagreements: []
  });

  return { manifest, fragmentCount: fragmentIds.length, outputRoot };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const freezePath = args[args.indexOf('--freeze') + 1];
  const outputRoot = args[args.indexOf('--output') + 1];
  if (!args.includes('--freeze') || !args.includes('--output')) {
    console.error('usage: scaffold-e5-v04-holdout.mjs --freeze <freeze-manifest.json> --output <dir>');
    process.exitCode = 1;
  } else if (existsSync(join(outputRoot, 'manifest.json'))) {
    console.error(`holdout_namespace_already_exists:${outputRoot}`);
    process.exitCode = 1;
  } else {
    try {
      const freezeManifest = JSON.parse(readFileSync(freezePath, 'utf8'));
      const selectionManifest = JSON.parse(
        readFileSync(join(root, freezeManifest.selectionManifestRef), 'utf8')
      );
      const result = scaffoldHoldout({ freezeManifest, selectionManifest, outputRoot });
      console.log(`Holdout préparé : ${result.fragmentCount} fragments, conteneurs vides, aucune sortie de modèle.`);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  }
}
