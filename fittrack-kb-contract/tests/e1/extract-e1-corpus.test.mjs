import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractE1FromCorpusFiles, extractE1FromText } from '../../tools/extract-e1.mjs';
import { resolveCorpusFile } from '../../tools/resolve-corpus.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../..');
const repoRoot = join(root, '..');

test('F1 line 54 offsets match the golden fragment and reread the file bytes', () => {
  const config = JSON.parse(readFileSync(join(root, 'corpus/corpus-files.config.json'), 'utf8'));
  const f1 = config.files.find((f) => f.corpusFileId === 'corpus.f1.programmation-hypertrophie');
  const hit = resolveCorpusFile(f1, { packageRoot: root, repoRoot, archiveRef: config.archiveRef });
  assert.ok(hit.bytes, `corpus F1 introuvable: ${(hit.tried ?? []).join(', ')}`);

  const fragments = JSON.parse(readFileSync(join(root, 'fragments/fragments.json'), 'utf8')).fragments;
  const golden = fragments.find((f) => f.fragmentId === 'frag.f1.0001');
  const text = hit.bytes.toString('utf8');
  const { candidates } = extractE1FromText({
    corpusFileId: f1.corpusFileId,
    text,
    fragments,
    runId: 'run.e1.test-corpus',
    extractedAt: '2026-08-23T00:00:00.000Z'
  });

  const row = candidates.find((c) => c.payload.startLine === 54);
  assert.ok(row, 'aucune candidate pour F1 L54');
  assert.equal(row.fragmentRef, 'frag.f1.0001');
  assert.equal(row.verbatimSpan.startByte, golden.startByte);
  assert.equal(row.verbatimSpan.endByte, golden.endByte);
  assert.equal(row.verbatimSpan.text, golden.rawText);
  const reread = hit.bytes.subarray(row.verbatimSpan.startByte, row.verbatimSpan.endByte).toString('utf8');
  assert.equal(reread, row.verbatimSpan.text);
  assert.equal(
    row.payload.rawStatement,
    'Plus de séries hebdomadaires produisent en moyenne plus d’hypertrophie, avec rendements décroissants.'
  );
  assert.equal(row.payload.cells.find((c) => c.header === 'Sources principales').links.length, 3);

  const refs = candidates.map((c) => c.fragmentRef);
  assert.equal(refs.length, new Set(refs).size, 'fragmentRef dupliqué dans F1');
});

test('F1+F2 fragment refs stay unique across files', () => {
  const config = JSON.parse(readFileSync(join(root, 'corpus/corpus-files.config.json'), 'utf8'));
  const fragments = JSON.parse(readFileSync(join(root, 'fragments/fragments.json'), 'utf8')).fragments;
  const files = [];
  for (const id of ['corpus.f1.programmation-hypertrophie', 'corpus.f2.anatomie-biomecanique']) {
    const f = config.files.find((x) => x.corpusFileId === id);
    const hit = resolveCorpusFile(f, { packageRoot: root, repoRoot, archiveRef: config.archiveRef });
    assert.ok(hit.bytes, id);
    files.push({ corpusFileId: id, originalFilename: f.originalFilename, bytes: hit.bytes });
  }
  const { candidates, tables, diagnostics } = extractE1FromCorpusFiles({ files, fragments });
  assert.equal(tables, 25);
  assert.equal(candidates.length, 141);
  assert.equal(diagnostics.length, 0);
  const refs = candidates.map((c) => c.fragmentRef);
  assert.equal(refs.length, new Set(refs).size);
  const ids = candidates.map((c) => c.candidateId);
  assert.equal(ids.length, new Set(ids).size);
});
