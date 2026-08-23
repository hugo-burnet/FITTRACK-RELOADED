import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { e3Stats, scanE3Document } from '../../tools/scan-e3.mjs';
import { resolveCorpusFile } from '../../tools/resolve-corpus.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../..');
const repoRoot = join(root, '..');

test('E3 on real F1/F2 is idempotent and rereads Pelland L54 from corpus bytes', () => {
  const e1 = JSON.parse(readFileSync(join(root, 'candidates/e1-table-rows.json'), 'utf8'));
  const e2 = JSON.parse(readFileSync(join(root, 'candidates/e2-projections.json'), 'utf8'));
  const a = scanE3Document(e1, { e2Doc: e2 });
  const b = scanE3Document(e1, { e2Doc: e2 });
  assert.deepEqual(a, b);

  const pelland = a.occurrences.find(
    (o) =>
      o.payload.rawLabel === 'Pelland et al., 2026' &&
      o.corpusFileRef === 'corpus.f1.programmation-hypertrophie' &&
      e1.candidates.find((c) => c.candidateId === o.payload.parentCandidateId)?.payload.startLine === 54
  );
  assert.ok(pelland, 'occurrence Pelland L54 absente');
  assert.equal(pelland.payload.resolvesToSourceRef, null);
  assert.equal(pelland.payload.year, undefined);

  const config = JSON.parse(readFileSync(join(root, 'corpus/corpus-files.config.json'), 'utf8'));
  const f1 = config.files.find((f) => f.corpusFileId === 'corpus.f1.programmation-hypertrophie');
  const hit = resolveCorpusFile(f1, { packageRoot: root, repoRoot, archiveRef: config.archiveRef });
  assert.ok(hit.bytes);
  const slice = hit.bytes
    .subarray(pelland.payload.startByte, pelland.payload.endByte)
    .toString('utf8');
  assert.equal(slice, pelland.payload.markdown);
  assert.equal(slice, `[${pelland.payload.rawLabel}](${pelland.payload.rawUrl})`);

  const stats = e3Stats({
    occurrences: a.occurrences,
    diagnostics: a.diagnostics,
    e1Count: e1.candidates.length
  });
  assert.equal(stats.markdownLinksDetected, stats.occurrencesCreated);
  assert.ok(stats.occurrencesCreated > 0);
});
