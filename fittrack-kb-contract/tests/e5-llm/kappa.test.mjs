import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  RELIABILITY_FLOOR,
  cohensKappa,
  collapseConfusionMatrix,
  observedAgreement,
  reliabilityVerdict
} from '../../tools/e5-llm/kappa.mjs';

function matrix(rows) {
  const out = {};
  for (const [gold, pred, count] of rows) {
    out[gold] ??= {};
    out[gold][pred] = (out[gold][pred] ?? 0) + count;
  }
  return out;
}

test('perfect agreement gives kappa 1 and raw agreement 1', () => {
  const m = matrix([
    ['a', 'a', 10],
    ['b', 'b', 10]
  ]);
  assert.equal(observedAgreement(m), 1);
  assert.equal(cohensKappa(m), 1);
});

test('kappa is 0 when agreement is exactly what chance predicts', () => {
  // Deux annotateurs qui repartissent 50/50 independamment tombent d accord une
  // fois sur deux par pur hasard. L accord brut dit 0,50, le kappa dit 0.
  const m = matrix([
    ['a', 'a', 25],
    ['a', 'b', 25],
    ['b', 'a', 25],
    ['b', 'b', 25]
  ]);
  assert.equal(observedAgreement(m), 0.5);
  assert.ok(Math.abs(cohensKappa(m)) < 1e-9);
});

test('kappa punishes agreement inflated by an imbalanced distribution', () => {
  // 90 % des items sont « a » : 0,90 d accord brut n impressionne personne.
  const m = matrix([
    ['a', 'a', 90],
    ['a', 'b', 5],
    ['b', 'a', 5],
    ['b', 'b', 0]
  ]);
  assert.equal(observedAgreement(m), 0.9);
  assert.ok(cohensKappa(m) < 0.5, 'le kappa doit rester bien sous l accord brut');
});

test('kappa goes negative when the two annotators contradict each other', () => {
  const m = matrix([
    ['a', 'b', 20],
    ['b', 'a', 20]
  ]);
  assert.ok(cohensKappa(m) < 0);
});

test('an empty matrix has no kappa rather than a fake zero', () => {
  assert.equal(cohensKappa({}), null);
  assert.equal(observedAgreement({}), null);
});

test('collapsing a scale merges the confusion matrix without losing counts', () => {
  const m = matrix([
    ['established', 'established_direction', 4],
    ['probable', 'uncertain', 3],
    ['refuted', 'refuted', 2]
  ]);
  const mapping = {
    established: 'SOLID',
    established_direction: 'SOLID',
    probable: 'LIMITED',
    uncertain: 'LIMITED',
    refuted: 'REFUTED'
  };
  const collapsed = collapseConfusionMatrix(m, mapping);
  assert.equal(collapsed.SOLID.SOLID, 4);
  assert.equal(collapsed.LIMITED.LIMITED, 3);
  assert.equal(collapsed.REFUTED.REFUTED, 2);
  // Les desaccords a l interieur d un groupe deviennent des accords : c est
  // exactement ce que l on veut mesurer.
  assert.equal(observedAgreement(collapsed), 1);
});

test('an unmapped label is refused rather than silently dropped', () => {
  const m = matrix([['established', 'probable', 1]]);
  assert.throws(
    () => collapseConfusionMatrix(m, { established: 'SOLID' }),
    /unmapped_label:probable/
  );
});

test('the reliability verdict follows the 0.70 / 0.85 rule of thumb', () => {
  assert.equal(RELIABILITY_FLOOR, 0.7);
  assert.equal(reliabilityVerdict(0.9), 'trop_grossier');
  assert.equal(reliabilityVerdict(0.8), 'utilisable');
  assert.equal(reliabilityVerdict(0.72), 'utilisable');
  assert.equal(reliabilityVerdict(0.69), 'bruit');
  assert.equal(reliabilityVerdict(null), 'non_mesurable');
});
