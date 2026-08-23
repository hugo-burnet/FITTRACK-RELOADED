import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { e2Stats } from '../../tools/extract-e2.mjs';
import { projectE2Document } from '../../tools/project-e2.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../..');

test('E2 projects all 60 E1 claims without dropping any and is idempotent', () => {
  const e1 = JSON.parse(readFileSync(join(root, 'candidates/e1-table-rows.json'), 'utf8'));
  const a = projectE2Document(e1);
  const b = projectE2Document(e1);
  assert.deepEqual(a, b);

  const claimsE1 = e1.candidates.filter((c) => c.targetKind === 'claim');
  assert.equal(claimsE1.length, 60);
  assert.equal(a.claims.length, 60);
  assert.equal(a.assessments.length, 60);
  assert.equal(a.skipped.length, e1.candidates.length - 60);

  const e1ById = new Map(claimsE1.map((c) => [c.candidateId, c]));
  for (const claim of a.claims) {
    const src = e1ById.get(claim.candidateId);
    assert.ok(src, claim.candidateId);
    assert.equal(claim.payload.rawStatement, src.payload.rawStatement);
    assert.deepEqual(claim.payload.cells, src.payload.cells);
    assert.deepEqual(claim.verbatimSpan, src.verbatimSpan);
    assert.equal(claim.payload.confidence, undefined);
    assert.ok(!('high_for_direction_moderate_for_curve' in (claim.payload.e2.confidence ?? {})));
  }

  const volume = a.claims.find((c) => c.payload.startLine === 54);
  assert.ok(volume);
  assert.deepEqual(
    volume.payload.e2.confidence.byAspect.map((x) => `${x.aspect}:${x.confidence}`),
    ['direction:high', 'dose_response_shape:moderate']
  );
  assert.equal(volume.payload.e2.epistemicStatus, 'established_direction');

  const stats = e2Stats(a);
  assert.equal(stats.claimsProjected, 60);
  assert.equal(stats.e1CandidatesRead, e1.candidates.length);
});
