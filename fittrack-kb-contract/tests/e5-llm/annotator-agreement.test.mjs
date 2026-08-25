import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  agreementCeiling,
  annotationsAsRunRecords,
  claimsSharingSpans,
  measureAnnotatorAgreement
} from '../../tools/measure-e5-annotator-agreement.mjs';

const root = join(import.meta.dirname, '../..');
const readJson = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'));
const doubleAnnotated = readJson('golden/e5/source/double-annotation-fragments.json').fragmentIds;

test('the instrument is exact against the adjudicated GOLD, which is what scores the model', () => {
  // Controle : sans ce test, un plafond bas pourrait venir d un defaut du
  // comparateur plutot que d un vrai desaccord humain. La GOLD arbitree est la
  // reference du modele, donc c est SON plancher qui doit etre parfait.
  const ids = readJson('golden/e5/adjudication/adjudicated.json').annotations.map(
    (item) => item.fragmentId
  );
  const result = measureAnnotatorAgreement({
    root,
    primaryPath: 'golden/e5/adjudication/adjudicated.json',
    secondaryPath: 'golden/e5/adjudication/adjudicated.json',
    fragmentIds: ids
  });
  assert.equal(result.fragmentCount, 100);
  assert.equal(result.forward.claims.precision, 1);
  assert.equal(result.forward.claims.recall, 1);
  assert.equal(result.forward.classification.knowledgeTypeAccuracy, 1);
  assert.equal(result.forward.classification.epistemicStatusAccuracy, 1);
  // Le taux de sur-fusion du modele est donc reel, pas un artefact de mesure.
  assert.equal(result.forward.claims.mergedClaimRate, 0);
  assert.equal(result.forward.claims.overFragmentationRate, 0);
  assert.equal(result.forward.rejectedFragments, 0);
});

test('annotator B stacks several claims on one identical span, which floors the merge metric', () => {
  // Propriete connue de la donnee, pas un bug : dans frag.e5f3.00000822, B pose six
  // claims sur le meme span [78,298]. La detection de fusion est purement spatiale,
  // donc aucune prediction ne peut couvrir ce span sans recouvrir plusieurs claims.
  // Epingle ici pour qu on ne reprenne pas ce bruit pour du desaccord humain.
  const b = readJson('golden/e5/annotations/annotator-b.json').annotations;
  const shared = claimsSharingSpans(b);
  assert.ok(shared.some((item) => item.fragmentId === 'frag.e5f3.00000822'));
  const adjudicated = readJson('golden/e5/adjudication/adjudicated.json').annotations;
  assert.deepEqual(claimsSharingSpans(adjudicated), []);
  const floor = measureAnnotatorAgreement({
    root,
    primaryPath: 'golden/e5/annotations/annotator-b.json',
    secondaryPath: 'golden/e5/annotations/annotator-b.json',
    fragmentIds: doubleAnnotated
  }).forward;
  assert.ok(floor.claims.mergedClaimRate > 0.03);
});

test('claim F1 is symmetric, so it can serve as the agreement number', () => {
  const result = measureAnnotatorAgreement({
    root,
    primaryPath: 'golden/e5/annotations/annotator-a.json',
    secondaryPath: 'golden/e5/annotations/annotator-b.json',
    fragmentIds: doubleAnnotated
  });
  // Precision et rappel s echangent quand on inverse les roles ; F1 ne bouge pas.
  assert.ok(Math.abs(result.forward.claims.f1 - result.reverse.claims.f1) < 1e-9);
  assert.ok(Math.abs(result.forward.claims.precision - result.reverse.claims.recall) < 1e-9);
});

test('two humans do not reach the thresholds the gates demand of the model', () => {
  const result = measureAnnotatorAgreement({
    root,
    primaryPath: 'golden/e5/annotations/annotator-a.json',
    secondaryPath: 'golden/e5/annotations/annotator-b.json',
    fragmentIds: doubleAnnotated
  });
  const ceiling = agreementCeiling(result);
  assert.equal(ceiling.fragmentCount, 30);
  for (const axis of Object.keys(ceiling.axes)) {
    const item = ceiling.axes[axis];
    assert.ok(item.observed !== undefined, `${axis} sans mesure`);
    assert.ok(typeof item.threshold === 'number', `${axis} sans seuil`);
  }
  // Le point du chantier : au moins un axe gate est hors de portee de deux humains.
  const unreachable = Object.values(ceiling.axes).filter((item) => item.reachedByHumans === false);
  assert.ok(unreachable.length > 0);
});

test('only the doubly annotated fragments are compared', () => {
  const subset = doubleAnnotated.slice(0, 5);
  const result = measureAnnotatorAgreement({
    root,
    primaryPath: 'golden/e5/annotations/annotator-a.json',
    secondaryPath: 'golden/e5/annotations/annotator-b.json',
    fragmentIds: subset
  });
  assert.equal(result.fragmentCount, 5);
});

test('comparing a fragment the secondary annotator never saw is refused', () => {
  assert.throws(
    () =>
      measureAnnotatorAgreement({
        root,
        primaryPath: 'golden/e5/annotations/annotator-a.json',
        secondaryPath: 'golden/e5/annotations/annotator-b.json',
        fragmentIds: ['frag.f2.0001', 'frag.f2.0002', 'frag.f2.0003']
      }),
    /annotator_did_not_annotate_fragment/
  );
});

test('an annotation converts to a run record without inventing model data', () => {
  const annotations = readJson('golden/e5/annotations/annotator-b.json').annotations.slice(0, 3);
  const records = annotationsAsRunRecords(annotations);
  assert.equal(records.length, 3);
  for (const record of records) {
    assert.equal(record.status, 'VALIDATED');
    assert.deepEqual(record.attempts, []);
    assert.equal(record.claimAudit.filtered, 0);
    assert.equal('rawResponse' in record, false);
    assert.equal('runId' in record, false);
  }
});
