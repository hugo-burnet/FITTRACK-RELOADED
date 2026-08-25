import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { scaffoldHoldout } from '../../tools/scaffold-e5-v04-holdout.mjs';
import { validateHoldout } from '../../tools/validate-e5-v04-holdout.mjs';

const root = join(import.meta.dirname, '../..');
const selectionManifestPath = join(root, 'benchmark/e5/v0/manifests/holdout-30.json');
const selectionManifest = JSON.parse(readFileSync(selectionManifestPath, 'utf8'));

function workspace() {
  return mkdtempSync(join(tmpdir(), 'e5-holdout-'));
}

function freeze(overrides = {}) {
  return {
    schemaVersion: '1.0.0-e5-v04-holdout-freeze',
    status: 'FROZEN_BEFORE_HOLDOUT_ANNOTATION',
    dev100Frozen: true,
    candidateCodeCommit: 'fixture-commit',
    selectionManifestRef: 'benchmark/e5/v0/manifests/holdout-30.json',
    ...overrides
  };
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function scaffoldInto(directory, options = {}) {
  return scaffoldHoldout({
    // `??` avalerait le null que ce test veut justement passer.
    freezeManifest: 'freezeManifest' in options ? options.freezeManifest : freeze(),
    selectionManifest: options.selectionManifest ?? selectionManifest,
    outputRoot: directory
  });
}

test('the scaffold creates blank containers that hold no model output', () => {
  const directory = workspace();
  try {
    const result = scaffoldInto(directory);
    for (const relativePath of [
      'manifest.json',
      'annotations/annotator-a.json',
      'annotations/annotator-b.json',
      'adjudication/adjudicated.json',
      'adjudication/disagreements.json'
    ]) {
      assert.ok(existsSync(join(directory, relativePath)), `missing ${relativePath}`);
    }
    const a = readJson(join(directory, 'annotations/annotator-a.json'));
    const b = readJson(join(directory, 'annotations/annotator-b.json'));
    assert.equal(a.annotations.length, 30);
    assert.equal(b.annotations.length, 30);
    // Un conteneur pre-rempli d une reponse de modele n est plus une annotation
    // independante : l annotateur verrait la prediction avant d ecrire la sienne.
    for (const annotation of [...a.annotations, ...b.annotations]) {
      assert.equal(annotation.annotationStatus, 'pending');
      assert.deepEqual(annotation.expectedClaims, []);
    }
    assert.equal(readJson(join(directory, 'adjudication/adjudicated.json')).annotations.length, 0);
    assert.equal(result.fragmentCount, 30);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('the scaffold points at the shared annotation schema instead of copying it', () => {
  const directory = workspace();
  try {
    scaffoldInto(directory);
    const manifest = readJson(join(directory, 'manifest.json'));
    assert.equal(manifest.annotationSchemaRef, '../e5/annotation.schema.json');
    assert.equal(existsSync(join(directory, 'annotation.schema.json')), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('the scaffold refuses to run without a freeze manifest', () => {
  const directory = workspace();
  try {
    assert.throws(() => scaffoldInto(directory, { freezeManifest: null }), /holdout_freeze_manifest_required/);
    assert.throws(
      () => scaffoldInto(directory, { freezeManifest: freeze({ status: 'DRAFT' }) }),
      /holdout_not_frozen/
    );
    assert.throws(
      () => scaffoldInto(directory, { freezeManifest: freeze({ dev100Frozen: false }) }),
      /holdout_requires_frozen_dev100/
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('the validator rejects any model-derived key', () => {
  const directory = workspace();
  try {
    scaffoldInto(directory);
    for (const key of ['prediction', 'runId', 'model', 'prompt', 'rawResponse']) {
      const path = join(directory, 'annotations/annotator-a.json');
      const document = readJson(path);
      document.annotations[0][key] = 'leaked';
      writeFileSync(path, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
      assert.throws(
        () => validateHoldout(directory, { root, requireComplete: false }),
        new RegExp(`holdout_model_data_leak:.*${key}`),
        `expected ${key} to be refused`
      );
      delete document.annotations[0][key];
      writeFileSync(path, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('a freshly scaffolded holdout validates structurally but is not complete', () => {
  const directory = workspace();
  try {
    scaffoldInto(directory);
    const structural = validateHoldout(directory, { root, requireComplete: false });
    assert.equal(structural.fragmentCount, 30);
    assert.deepEqual(structural.counts, { F2: 15, F3: 15 });
    assert.equal(structural.complete, false);
    assert.throws(
      () => validateHoldout(directory, { root, requireComplete: true }),
      /holdout_annotation_incomplete/
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('the validator refuses a tampered selection-manifest hash', () => {
  const directory = workspace();
  try {
    scaffoldInto(directory);
    const path = join(directory, 'manifest.json');
    const manifest = readJson(path);
    manifest.selectionManifestHash = 'sha256:0000';
    writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    assert.throws(
      () => validateHoldout(directory, { root, requireComplete: false }),
      /holdout_selection_manifest_hash_mismatch/
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('the validator refuses a wrong count, a wrong split, or a DEV-100 overlap', () => {
  const directory = workspace();
  try {
    scaffoldInto(directory);
    const path = join(directory, 'annotations/annotator-a.json');
    const document = readJson(path);
    document.annotations.pop();
    writeFileSync(path, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
    assert.throws(
      () => validateHoldout(directory, { root, requireComplete: false }),
      /holdout_annotator_fragment_set_mismatch/
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }

  const overlapping = workspace();
  try {
    assert.throws(
      () =>
        scaffoldInto(overlapping, {
          selectionManifest: {
            ...selectionManifest,
            fragmentIds: [selectionManifest.excludedDev100Ids[0], ...selectionManifest.fragmentIds.slice(1)]
          }
        }),
      /holdout_overlaps_dev100/
    );
  } finally {
    rmSync(overlapping, { recursive: true, force: true });
  }
});

test('the validator demands two independent annotators and an adjudication per disagreement', () => {
  const directory = workspace();
  try {
    scaffoldInto(directory);
    const path = join(directory, 'annotations/annotator-b.json');
    const document = readJson(path);
    document.annotatorId = readJson(join(directory, 'annotations/annotator-a.json')).annotatorId;
    writeFileSync(path, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
    assert.throws(
      () => validateHoldout(directory, { root, requireComplete: false }),
      /holdout_annotators_not_independent/
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('scaffolding does not create the real holdout namespace', () => {
  // Le vrai espace de noms appartient au second plan, apres le gel de DEV-100.
  assert.equal(existsSync(join(root, 'golden/e5-holdout-30')), false);
});
