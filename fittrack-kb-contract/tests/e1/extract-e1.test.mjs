import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { extractE1FromText, lineByteStarts, sha256 } from '../../tools/extract-e1.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../..');

const RUN = {
  extractorVersion: '0.1.0-e1',
  runId: 'run.e1.test',
  extractedAt: '2026-08-23T00:00:00.000Z'
};

function extract(text, extra = {}) {
  return extractE1FromText({
    corpusFileId: 'corpus.f1.programmation-hypertrophie',
    text,
    fragments: extra.fragments ?? [],
    ...RUN
  });
}

function claimTable(dataRows) {
  return [
    '| Affirmation principale | Confiance | Sources principales |',
    '|---|---|---|',
    ...dataRows
  ].join('\n');
}

test('extracts a simple claim row as a candidate, not curated', () => {
  const { candidates, diagnostics } = extract(
    claimTable(['| Plus de séries. | Élevé | [Pelland](https://ex.example) |'])
  );
  assert.equal(diagnostics.length, 0);
  assert.equal(candidates.length, 1);
  const c = candidates[0];
  assert.equal(c.targetKind, 'claim');
  assert.equal(c.extraction.method, 'deterministic_table_row');
  assert.equal(c.reviewState, 'pending_human_review');
  assert.equal(c.payload.rawStatement, 'Plus de séries.');
  assert.equal(c.promotedToEntityId, undefined);
  assert.equal(c.payload.id, undefined);
  assert.equal(c.payload.revision, undefined);
  assert.equal(c.payload.knowledgeType, undefined);
  assert.equal(c.payload.confidence, undefined);
});

test('keeps several links inside a cell without turning them into source ids', () => {
  const { candidates } = extract(
    claimTable([
      '| A | B | [Un](https://a.example); [Deux](https://b.example) |'
    ])
  );
  const sources = candidates[0].payload.cells.find((cell) => cell.header === 'Sources principales');
  assert.deepEqual(sources.links, [
    { label: 'Un', url: 'https://a.example' },
    { label: 'Deux', url: 'https://b.example' }
  ]);
  assert.equal(candidates[0].payload.sourceRefs, undefined);
});

test('keeps inline markdown in rawStatement and raw cells', () => {
  const { candidates } = extract(claimTable(['| *Dose-response* **établi**. | B | C |']));
  assert.equal(candidates[0].payload.rawStatement, '*Dose-response* **établi**.');
  assert.equal(candidates[0].payload.cells[0].raw, '*Dose-response* **établi**.');
});

test('preserves empty cells as empty raw values', () => {
  const { candidates } = extract(claimTable(['| Affirmation seule. |  |  |']));
  assert.equal(candidates[0].payload.cells[1].raw, '');
  assert.equal(candidates[0].payload.cells[2].raw, '');
});

test('preserves french unicode in rawStatement', () => {
  const row = '| Plus d’hypertrophie, « sans seuil ». | Modéré |  |';
  const { candidates } = extract(claimTable([row]));
  assert.equal(candidates[0].payload.rawStatement, 'Plus d’hypertrophie, « sans seuil ».');
});

test('does not invent a fused confidence field from a composite cell', () => {
  const { candidates } = extract(
    claimTable(['| X. | Élevé pour la direction; modéré pour la forme de la courbe |  |'])
  );
  assert.equal(
    candidates[0].payload.cells.find((cell) => cell.header === 'Confiance').raw,
    'Élevé pour la direction; modéré pour la forme de la courbe'
  );
  assert.equal(candidates[0].payload.confidence, undefined);
  assert.equal(candidates[0].payload.epistemicStatus, undefined);
});

test('records a diagnostic for a column-count mismatch without aborting', () => {
  const { candidates, diagnostics } = extract(
    claimTable(['| trop court |'])
  );
  assert.equal(candidates.length, 1);
  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0].type, 'column_count_mismatch');
  assert.equal(diagnostics[0].corpusFileId, 'corpus.f1.programmation-hypertrophie');
  assert.equal(typeof diagnostics[0].startLine, 'number');
  assert.ok(diagnostics[0].value.includes('trop court'));
});

test('rawStatement is exactly the affirmation cell, never a paraphrase', () => {
  const source = 'Plus de séries hebdomadaires produisent en moyenne plus d’hypertrophie.';
  const { candidates } = extract(claimTable([`| ${source} | Élevé |  |`]));
  assert.equal(candidates[0].payload.rawStatement, source);
});

test('byte offsets reread the exact row from the source bytes', () => {
  const text = claimTable(['| Café — hypertrophie. | Élevé |  |']);
  const { candidates } = extract(text);
  const bytes = Buffer.from(text, 'utf8');
  const c = candidates[0];
  const slice = bytes.subarray(c.verbatimSpan.startByte, c.verbatimSpan.endByte).toString('utf8');
  assert.equal(slice, c.verbatimSpan.text);
  assert.equal(slice, c.payload.rawRow);
  assert.equal(c.verbatimSpan.text, '| Café — hypertrophie. | Élevé |  |');
});

test('same input yields the same candidateId and payload', () => {
  const text = claimTable(['| Une affirmation. | Modéré |  |']);
  const a = extract(text);
  const b = extract(text);
  assert.deepEqual(a.candidates, b.candidates);
  assert.match(a.candidates[0].candidateId, /^cand\.[a-z0-9-]+\.[0-9a-f]{8,}$/);
});

test('reuses an existing golden fragment id for the same line', () => {
  const text = claimTable(['| Une affirmation. | Modéré |  |']);
  const { candidates } = extract(text, {
    fragments: [
      {
        fragmentId: 'frag.f1.0001',
        corpusFileId: 'corpus.f1.programmation-hypertrophie',
        startLine: 3,
        endLine: 3,
        blockType: 'table_row'
      }
    ]
  });
  assert.equal(candidates[0].fragmentRef, 'frag.f1.0001');
});

test('skips header and separator rows', () => {
  const text = claimTable(['| Une affirmation. | Modéré |  |']);
  const { candidates } = extract(text);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].payload.startLine, 3);
});

test('classifies a bibliography table as source candidates', () => {
  const text = [
    '| Publication | DOI | PMID | URL |',
    '|---|---|---|---|',
    '| *Dose* | 10.1000/x | 123 | [PubMed](https://pubmed.ncbi.nlm.nih.gov/123) |'
  ].join('\n');
  const { candidates } = extract(text);
  assert.equal(candidates[0].targetKind, 'source');
  assert.equal(candidates[0].payload.rawStatement, undefined);
});

test('lineByteStarts counts utf-8 bytes, not characters', () => {
  const text = 'é\ncafé';
  const starts = lineByteStarts(text);
  assert.deepEqual(starts, [0, Buffer.byteLength('é\n', 'utf8')]);
  assert.equal(sha256('x').startsWith('sha256:'), true);
});

test('candidates validate against extraction-candidate.schema.json', () => {
  const ajv = new Ajv2020({ strict: false, allErrors: true, allowUnionTypes: true });
  addFormats(ajv);
  const schema = JSON.parse(
    readFileSync(join(root, 'extraction-contract/extraction-candidate.schema.json'), 'utf8')
  );
  const vocab = JSON.parse(readFileSync(join(root, 'schemas/common/vocab.schema.json'), 'utf8'));
  ajv.addSchema(vocab);
  const validate = ajv.compile(schema);
  const { candidates } = extract(
    claimTable(['| Plus de séries. | Élevé | [Pelland](https://ex.example) |'])
  );
  assert.equal(validate(candidates[0]), true, ajv.errorsText(validate.errors));
});
