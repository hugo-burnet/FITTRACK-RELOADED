import assert from 'node:assert/strict';
import test from 'node:test';
import { auditCoverageLedger, buildCoverageUnits } from '../../tools/e5-llm/coverage.mjs';

test('buildCoverageUnits preserves prose, list items, and UTF-8 byte ranges exactly', () => {
  const rawText = '  Épaule stable.\n« Pacing ? »\n\n- Charge progressive\n  sans douleur\n  \n1. Retour au calme…  ';

  const units = buildCoverageUnits({ rawText });

  assert.deepEqual(units.map((item) => ({ kind: item.kind, text: item.text })), [
    { kind: 'SENTENCE', text: 'Épaule stable.' },
    { kind: 'SENTENCE', text: '« Pacing ? »' },
    { kind: 'LIST_ITEM', text: '- Charge progressive\n  sans douleur' },
    { kind: 'LIST_ITEM', text: '1. Retour au calme…' }
  ]);
  assert.deepEqual(units.map((item) => item.unitIndex), [0, 1, 2, 3]);
  for (const unit of units) {
    assert.equal(
      Buffer.from(rawText, 'utf8').subarray(unit.relativeStartByte, unit.relativeEndByte).toString('utf8'),
      unit.text
    );
  }
});

test('auditCoverageLedger accepts complete coverage and returns covered indexes', () => {
  const coverageUnits = buildCoverageUnits({ rawText: 'Une phrase.\n- Une liste' });

  const result = auditCoverageLedger({
    coverageUnits,
    coverageLedger: [
      { unitIndex: 0, decision: 'CONTEXT_ONLY' },
      { unitIndex: 1, decision: 'CLAIM_CONTENT' }
    ],
    claims: [{ technicalClaimRef: 'tmp.claim.01', coverageUnitIndexes: [1] }]
  });

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.coveredUnitIndexes, [0, 1]);
});

test('auditCoverageLedger reports duplicate and incomplete ledger coverage', () => {
  const result = auditCoverageLedger({
    coverageUnits: buildCoverageUnits({ rawText: 'Première. Deuxième.' }),
    coverageLedger: [
      { unitIndex: 0, decision: 'CONTEXT_ONLY' },
      { unitIndex: 0, decision: 'POLICY_ONLY' }
    ],
    claims: []
  });

  assert.deepEqual(result.diagnostics.map((item) => item.code), [
    'COVERAGE_DUPLICATE_UNIT',
    'COVERAGE_INCOMPLETE'
  ]);
});

test('auditCoverageLedger reports out-of-range indexes and invalid claim references', () => {
  const result = auditCoverageLedger({
    coverageUnits: buildCoverageUnits({ rawText: 'Une phrase.' }),
    coverageLedger: [
      { unitIndex: 0, decision: 'CONTEXT_ONLY' },
      { unitIndex: 4, decision: 'POLICY_ONLY' }
    ],
    claims: [{ technicalClaimRef: 'tmp.claim.01', coverageUnitIndexes: [0, 4] }]
  });

  assert.deepEqual(result.diagnostics.map((item) => item.code), [
    'COVERAGE_UNIT_OUT_OF_RANGE',
    'CLAIM_UNIT_REFERENCE_INVALID',
    'CLAIM_UNIT_REFERENCE_INVALID'
  ]);
});

test('auditCoverageLedger requires a claim reference for every CLAIM_CONTENT unit', () => {
  const result = auditCoverageLedger({
    coverageUnits: buildCoverageUnits({ rawText: 'Une phrase.' }),
    coverageLedger: [{ unitIndex: 0, decision: 'CLAIM_CONTENT' }],
    claims: []
  });

  assert.deepEqual(result.diagnostics.map((item) => item.code), [
    'CLAIM_CONTENT_WITHOUT_CLAIM'
  ]);
});
