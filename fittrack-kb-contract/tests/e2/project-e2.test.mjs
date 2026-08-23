import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {
  projectConfidence,
  projectEvidenceTypes,
  projectListCell,
  projectPopulation,
  projectE2Candidate
} from '../../tools/project-e2.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../..');

function claimCandidate(cells, extra = {}) {
  return {
    candidateId: extra.candidateId ?? 'cand.e1.aaaaaaaa',
    targetKind: extra.targetKind ?? 'claim',
    fragmentRef: 'frag.f1.0001',
    corpusFileRef: 'corpus.f1.programmation-hypertrophie',
    extraction: {
      method: 'deterministic_table_row',
      runId: 'run.e1.test',
      extractedAt: '2026-08-23T00:00:00.000Z',
      extractorVersion: '0.1.0-e1'
    },
    payload: {
      rawStatement: extra.rawStatement ?? 'Plus de séries.',
      rawRow: extra.rawRow ?? '| Plus de séries. | x |',
      startLine: 54,
      endLine: 54,
      headingPath: ['2. Volume'],
      tableHeaderCells: cells.map((c) => c.header),
      cells,
      columnCount: cells.length,
      expectedColumnCount: cells.length
    },
    verbatimSpan: extra.verbatimSpan ?? { text: '| Plus de séries. | x |', startByte: 10, endByte: 40 },
    reviewState: 'pending_human_review'
  };
}

test('maps a simple Élevé confidence without inventing an aspect', () => {
  const out = projectConfidence('Élevé');
  assert.equal(out.simple, 'high');
  assert.deepEqual(out.byAspect, []);
  assert.equal(out.range, null);
  assert.deepEqual(out.unresolved, []);
});

test('maps a simple Modéré confidence', () => {
  assert.equal(projectConfidence('Modéré').simple, 'moderate');
});

test('does not flatten a range to a single level', () => {
  const out = projectConfidence('Faible à modéré');
  assert.equal(out.simple, null);
  assert.deepEqual(out.range, { from: 'low', to: 'moderate' });
  assert.deepEqual(out.byAspect, []);
});

test('splits a two-aspect composite without a fused field', () => {
  const out = projectConfidence('Élevé pour la direction; modéré pour la forme de la courbe');
  assert.equal(out.simple, null);
  assert.equal(out.confidence, undefined);
  assert.deepEqual(
    out.byAspect.map((x) => ({ aspect: x.aspect, confidence: x.confidence })),
    [
      { aspect: 'direction', confidence: 'high' },
      { aspect: 'dose_response_shape', confidence: 'moderate' }
    ]
  );
});

test('keeps unknown aspect phrases unresolved instead of guessing', () => {
  const out = projectConfidence('Élevé qualitativement; faible pour algorithmes exacts');
  assert.equal(out.simple, null);
  assert.deepEqual(out.byAspect, []);
  assert.ok(out.unresolved.length >= 1);
  assert.ok(out.unresolved.every((u) => u.rawValue));
});

test('unknown whole-cell confidence is unresolved, not nearest-neighbour', () => {
  const out = projectConfidence('plausible selon les coachs');
  assert.equal(out.simple, null);
  assert.deepEqual(out.byAspect, []);
  assert.equal(out.unresolved[0].reason, 'unknown_confidence_expression');
  assert.equal(out.unresolved[0].rawValue, 'plausible selon les coachs');
});

test('splits several limitations on semicolons without rewriting', () => {
  const out = projectListCell('Courtes durées; peu de femmes; volumes élevés rares');
  assert.deepEqual(
    out.items.map((i) => i.rawValue),
    ['Courtes durées', 'peu de femmes', 'volumes élevés rares']
  );
  assert.equal(out.raw, 'Courtes durées; peu de femmes; volumes élevés rares');
});

test('splits cannotConclude items without turning them into opposite claims', () => {
  const raw =
    'Pas de « meilleur » nombre universel; pas de preuve que toujours plus est mieux; pas de seuil exact de surentraînement.';
  const out = projectListCell(raw);
  assert.deepEqual(
    out.items.map((i) => i.rawValue),
    [
      'Pas de « meilleur » nombre universel',
      'pas de preuve que toujours plus est mieux',
      'pas de seuil exact de surentraînement.'
    ]
  );
});

test('keeps a nuance cell raw and does not resolve the contradiction', () => {
  const candidate = claimCandidate([
    { header: 'Affirmation principale', raw: 'A.', links: [] },
    {
      header: 'Sources contradictoires / nuances',
      raw: 'Certaines comparaisons haut vs modéré ([Baz](https://ex.example)).',
      links: [{ label: 'Baz', url: 'https://ex.example' }]
    }
  ]);
  const { claim } = projectE2Candidate(candidate);
  assert.equal(
    claim.payload.e2.nuance.raw,
    'Certaines comparaisons haut vs modéré ([Baz](https://ex.example)).'
  );
  assert.deepEqual(claim.payload.e2.nuance.links, [{ label: 'Baz', url: 'https://ex.example' }]);
  assert.equal(claim.payload.e2.exceptions, undefined);
});

test('qualified population stays raw and does not become young_men_only', () => {
  const out = projectPopulation('Principalement jeunes hommes entraînés');
  assert.equal(out.rawDescription, 'Principalement jeunes hommes entraînés');
  assert.equal(out.ageBand, undefined);
  assert.ok((out.generalizationWarnings ?? []).length >= 1);
  assert.ok(out.trainingStatus?.includes('trained'));
});

test('E2 never rewrites rawStatement, cells or offsets', () => {
  const src = claimCandidate(
    [
      { header: 'Affirmation principale', raw: 'Plus d’hypertrophie.', links: [] },
      { header: 'Confiance', raw: 'Élevé', links: [] }
    ],
    {
      rawStatement: 'Plus d’hypertrophie.',
      verbatimSpan: { text: '| Plus d’hypertrophie. | Élevé |', startByte: 8916, endByte: 9000 }
    }
  );
  const cellsBefore = JSON.stringify(src.payload.cells);
  const { claim } = projectE2Candidate(src);
  assert.equal(claim.payload.rawStatement, 'Plus d’hypertrophie.');
  assert.equal(JSON.stringify(claim.payload.cells), cellsBefore);
  assert.deepEqual(claim.verbatimSpan, src.verbatimSpan);
  assert.equal(claim.extraction.method, 'deterministic_table_row');
  assert.equal(claim.payload.confidence, undefined);
});

test('E2 is idempotent and keeps projection order stable', () => {
  const src = claimCandidate([
    { header: 'Affirmation principale', raw: 'X.', links: [] },
    { header: 'Confiance', raw: 'Élevé pour la direction; modéré pour la forme de la courbe', links: [] },
    { header: 'Type de preuve', raw: 'Position stand; méta-régressions', links: [] }
  ]);
  const a = projectE2Candidate(src);
  const b = projectE2Candidate(src);
  assert.deepEqual(a, b);
  assert.deepEqual(
    a.claim.payload.e2.confidence.byAspect.map((x) => x.aspect),
    ['direction', 'dose_response_shape']
  );
  assert.deepEqual(
    a.claim.payload.e2.evidenceTypes.mapped.map((x) => x.term),
    ['position_stand', 'meta_regression']
  );
});

test('a malformed E1 candidate is diagnosed instead of throwing', () => {
  const out = projectE2Candidate({ not: 'a candidate' });
  assert.equal(out.claim, null);
  assert.equal(out.diagnostics[0].type, 'invalid_e1_candidate');
});

test('assessment draft uses deterministic_table_cell and does not embed into the claim', () => {
  const src = claimCandidate([
    { header: 'Affirmation principale', raw: 'X.', links: [] },
    { header: 'Confiance', raw: 'Élevé pour la direction; modéré pour la forme de la courbe', links: [] }
  ]);
  const { claim, assessment } = projectE2Candidate(src);
  assert.equal(assessment.extraction.method, 'deterministic_table_cell');
  assert.equal(assessment.targetKind, 'evidence-assessment');
  assert.equal(assessment.payload.claimCandidateId, claim.candidateId);
  assert.equal(claim.payload.assessmentRefs, undefined);
  assert.equal(claim.payload.e2.assessmentCandidateId, assessment.candidateId);
});

test('E2 claim candidates still validate against extraction-candidate.schema.json', () => {
  const ajv = new Ajv2020({ strict: false, allErrors: true, allowUnionTypes: true });
  addFormats(ajv);
  const schema = JSON.parse(
    readFileSync(join(root, 'extraction-contract/extraction-candidate.schema.json'), 'utf8')
  );
  const vocab = JSON.parse(readFileSync(join(root, 'schemas/common/vocab.schema.json'), 'utf8'));
  ajv.addSchema(vocab);
  const validate = ajv.compile(schema);
  const src = claimCandidate([
    { header: 'Affirmation principale', raw: 'X.', links: [] },
    { header: 'Confiance', raw: 'Modéré', links: [] },
    { header: 'Ce qu’on ne peut PAS conclure', raw: 'Pas de seuil.', links: [] }
  ]);
  const { claim, assessment } = projectE2Candidate(src);
  assert.equal(validate(claim), true, ajv.errorsText(validate.errors));
  assert.equal(validate(assessment), true, ajv.errorsText(validate.errors));
});
