import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { scanE3Candidate, scanE3Document } from '../../tools/scan-e3.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../..');

function e1Candidate({ cells, extra = {} }) {
  const rawRow =
    extra.rawRow ??
    `| ${cells.map((c) => c.raw).join(' | ')} |`;
  return {
    candidateId: extra.candidateId ?? 'cand.e1.aaaaaaaa',
    targetKind: extra.targetKind ?? 'claim',
    fragmentRef: extra.fragmentRef ?? 'frag.f1.0001',
    corpusFileRef: extra.corpusFileRef ?? 'corpus.f1.programmation-hypertrophie',
    extraction: {
      method: 'deterministic_table_row',
      runId: 'run.e1.test',
      extractedAt: '2026-08-23T00:00:00.000Z',
      extractorVersion: '0.1.0-e1'
    },
    payload: {
      rawStatement: extra.rawStatement ?? 'Plus de séries.',
      rawRow,
      startLine: extra.startLine ?? 54,
      endLine: extra.startLine ?? 54,
      headingPath: ['2. Volume'],
      tableHeaderCells: cells.map((c) => c.header),
      cells,
      columnCount: cells.length,
      expectedColumnCount: cells.length
    },
    verbatimSpan: extra.verbatimSpan ?? {
      text: rawRow,
      startByte: extra.startByte ?? 100,
      endByte: (extra.startByte ?? 100) + Buffer.byteLength(rawRow, 'utf8')
    },
    reviewState: 'pending_human_review'
  };
}

test('scans a single markdown citation as an occurrence, not a Source', () => {
  const src = e1Candidate({
    cells: [
      { header: 'Affirmation principale', raw: 'A.', links: [] },
      {
        header: 'Sources principales',
        raw: '[Pelland et al., 2026](https://pubmed.ncbi.nlm.nih.gov/41343037/)',
        links: []
      }
    ]
  });
  const { occurrences, diagnostics } = scanE3Candidate(src);
  assert.equal(diagnostics.length, 0);
  assert.equal(occurrences.length, 1);
  const o = occurrences[0];
  assert.equal(o.targetKind, 'citation-occurrence');
  assert.equal(o.extraction.method, 'deterministic_link_scan');
  assert.equal(o.payload.rawLabel, 'Pelland et al., 2026');
  assert.equal(o.payload.rawUrl, 'https://pubmed.ncbi.nlm.nih.gov/41343037/');
  assert.equal(o.payload.resolvesToSourceRef, null);
  assert.equal(o.payload.resolutionStatus, 'partial');
  assert.equal(o.payload.author, undefined);
  assert.equal(o.payload.year, undefined);
  assert.equal(o.payload.documentType, undefined);
  assert.match(o.candidateId, /^cand\.[a-z0-9-]+\.[0-9a-f]{8,}$/);
});

test('keeps several links in one cell as distinct ordered occurrences', () => {
  const src = e1Candidate({
    cells: [
      {
        header: 'Sources principales',
        raw: '[Pelland et al., 2026](https://pubmed.ncbi.nlm.nih.gov/41343037/); [Schoenfeld et al., 2017](https://www.tandfonline.com/doi/full/10.1080/02640414.2016.1210197); [ACSM, 2026](https://acsm.org/resistance-training-guidelines-update-2026/)',
        links: []
      }
    ]
  });
  const { occurrences } = scanE3Candidate(src);
  assert.deepEqual(
    occurrences.map((o) => o.payload.rawLabel),
    ['Pelland et al., 2026', 'Schoenfeld et al., 2017', 'ACSM, 2026']
  );
  assert.equal(occurrences[0].payload.occurrenceIndexInCell, 0);
  assert.equal(occurrences[2].payload.occurrenceIndexInCell, 2);
});

test('same URL with different labels stays two occurrences', () => {
  const src = e1Candidate({
    cells: [
      {
        header: 'Sources principales',
        raw: '[Pelland et al., 2026](https://ex.example/a); [méta-régression 2026](https://ex.example/a)',
        links: []
      }
    ]
  });
  const { occurrences } = scanE3Candidate(src);
  assert.equal(occurrences.length, 2);
  assert.notEqual(occurrences[0].candidateId, occurrences[1].candidateId);
  assert.equal(occurrences[0].payload.rawUrl, occurrences[1].payload.rawUrl);
  assert.notEqual(occurrences[0].payload.rawLabel, occurrences[1].payload.rawLabel);
});

test('same label with different URLs stays two occurrences', () => {
  const src = e1Candidate({
    cells: [
      {
        header: 'Sources principales',
        raw: '[ACSM, 2026](https://acsm.org/a); [ACSM, 2026](https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/)',
        links: []
      }
    ]
  });
  const { occurrences } = scanE3Candidate(src);
  assert.equal(occurrences.length, 2);
  assert.notEqual(occurrences[0].payload.rawUrl, occurrences[1].payload.rawUrl);
});

test('the same citation in two fragments yields two occurrences', () => {
  const a = e1Candidate({
    extra: { candidateId: 'cand.e1.aaaa1111', fragmentRef: 'frag.f1.0001', startLine: 54 },
    cells: [
      {
        header: 'Sources principales',
        raw: '[ACSM, 2026](https://acsm.org/x)',
        links: []
      }
    ]
  });
  const b = e1Candidate({
    extra: { candidateId: 'cand.e1.bbbb2222', fragmentRef: 'frag.f1.0019', startLine: 86 },
    cells: [
      {
        header: 'Sources principales',
        raw: '[ACSM, 2026](https://acsm.org/x)',
        links: []
      }
    ]
  });
  const out = scanE3Document({ candidates: [a, b] });
  assert.equal(out.occurrences.length, 2);
  assert.notEqual(out.occurrences[0].candidateId, out.occurrences[1].candidateId);
  assert.equal(out.occurrences[0].payload.fragmentRef, 'frag.f1.0001');
  assert.equal(out.occurrences[1].payload.fragmentRef, 'frag.f1.0019');
});

test('internal markdown links are not treated as bibliographic citations', () => {
  const src = e1Candidate({
    cells: [{ header: 'Notes', raw: '[voir section 5](#section-5)', links: [] }]
  });
  const { occurrences, diagnostics } = scanE3Candidate(src);
  assert.equal(occurrences.length, 1);
  assert.equal(occurrences[0].payload.linkKind, 'internal');
  assert.equal(occurrences[0].payload.resolutionStatus, 'unresolved');
  assert.equal(diagnostics[0].type, 'internal_markdown_link');
});

test('a non-scientific markdown link is still an unresolved occurrence, not a Source', () => {
  const src = e1Candidate({
    cells: [{ header: 'Notes', raw: '[site officiel](https://example.com/about)', links: [] }]
  });
  const { occurrences } = scanE3Candidate(src);
  assert.equal(occurrences[0].payload.rawLabel, 'site officiel');
  assert.equal(occurrences[0].payload.documentType, undefined);
  assert.equal(occurrences[0].payload.resolvesToSourceRef, null);
});

test('UTF-8 labels keep exact characters and byte offsets reread the markdown', () => {
  const raw = '[Bernárdez-Vázquez et al., 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC9302196/)';
  const src = e1Candidate({
    extra: { startByte: 500 },
    cells: [{ header: 'Sources principales', raw, links: [] }]
  });
  const { occurrences } = scanE3Candidate(src);
  const o = occurrences[0];
  assert.equal(o.payload.rawLabel, 'Bernárdez-Vázquez et al., 2022');
  const rowBytes = Buffer.from(src.payload.rawRow, 'utf8');
  const slice = rowBytes.subarray(
    o.payload.startByte - src.verbatimSpan.startByte,
    o.payload.endByte - src.verbatimSpan.startByte
  ).toString('utf8');
  assert.equal(slice, `[${o.payload.rawLabel}](${o.payload.rawUrl})`);
});

test('occurrence ids are stable and the scan is idempotent', () => {
  const src = e1Candidate({
    cells: [
      {
        header: 'Sources principales',
        raw: '[Pelland et al., 2026](https://pubmed.ncbi.nlm.nih.gov/41343037/)',
        links: []
      }
    ]
  });
  const a = scanE3Candidate(src);
  const b = scanE3Candidate(src);
  assert.deepEqual(a, b);
  assert.match(a.occurrences[0].candidateId, /^cand\.e3\.[0-9a-f]{8,}$/);
});

test('E3 does not rewrite E1 rawStatement, cells or offsets', () => {
  const src = e1Candidate({
    extra: { rawStatement: 'Plus d’hypertrophie.' },
    cells: [
      { header: 'Affirmation principale', raw: 'Plus d’hypertrophie.', links: [] },
      {
        header: 'Sources principales',
        raw: '[Pelland et al., 2026](https://pubmed.ncbi.nlm.nih.gov/41343037/)',
        links: []
      }
    ]
  });
  const snapshot = JSON.stringify(src);
  scanE3Candidate(src);
  assert.equal(JSON.stringify(src), snapshot);
});

test('a malformed E1 candidate is diagnosed instead of throwing', () => {
  const out = scanE3Candidate({ not: 'a candidate' });
  assert.equal(out.occurrences.length, 0);
  assert.equal(out.diagnostics[0].type, 'invalid_e1_candidate');
});

test('occurrences validate against extraction-candidate.schema.json', () => {
  const ajv = new Ajv2020({ strict: false, allErrors: true, allowUnionTypes: true });
  addFormats(ajv);
  const schema = JSON.parse(
    readFileSync(join(root, 'extraction-contract/extraction-candidate.schema.json'), 'utf8')
  );
  const vocab = JSON.parse(readFileSync(join(root, 'schemas/common/vocab.schema.json'), 'utf8'));
  ajv.addSchema(vocab);
  const validate = ajv.compile(schema);
  const src = e1Candidate({
    cells: [
      {
        header: 'Sources principales',
        raw: '[Pelland et al., 2026](https://pubmed.ncbi.nlm.nih.gov/41343037/)',
        links: []
      }
    ]
  });
  const { occurrences } = scanE3Candidate(src);
  assert.equal(validate(occurrences[0]), true, ajv.errorsText(validate.errors));
});

test('claim parents are linked without embedding a curated Source on the assessment', () => {
  const src = e1Candidate({
    extra: { candidateId: 'cand.e1.claim01', targetKind: 'claim' },
    cells: [
      {
        header: 'Sources principales',
        raw: '[Pelland et al., 2026](https://pubmed.ncbi.nlm.nih.gov/41343037/)',
        links: []
      }
    ]
  });
  const e2 = {
    candidates: [
      {
        candidateId: 'cand.e1.claim01',
        payload: { e2: { assessmentCandidateId: 'cand.e2.assess01' } }
      }
    ]
  };
  const { occurrences } = scanE3Candidate(src, { e2ByClaimId: new Map([['cand.e1.claim01', 'cand.e2.assess01']]) });
  assert.equal(occurrences[0].payload.claimCandidateId, 'cand.e1.claim01');
  assert.equal(occurrences[0].payload.assessmentCandidateId, 'cand.e2.assess01');
  assert.equal(occurrences[0].payload.sourceRefs, undefined);
  void e2;
});
