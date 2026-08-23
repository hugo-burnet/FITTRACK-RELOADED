import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { flattenSchemaFieldPaths } from '../../tools/walk-json.mjs';
import { scanE4FromText } from '../../tools/scan-e4.mjs';
import { resolveCorpusFile } from '../../tools/resolve-corpus.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../..');
const repoRoot = join(root, '..');

test('E4 on real F4 is idempotent, covers the 98 mapped schema fields, and rereads bytes', () => {
  const config = JSON.parse(readFileSync(join(root, 'corpus/corpus-files.config.json'), 'utf8'));
  const f4 = config.files.find((f) => f.corpusFileId === 'corpus.f4.schema-ia-coaching');
  const hit = resolveCorpusFile(f4, { packageRoot: root, repoRoot, archiveRef: config.archiveRef });
  assert.ok(hit.bytes);
  const text = hit.bytes.toString('utf8');
  const fragments = JSON.parse(readFileSync(join(root, 'fragments/fragments.json'), 'utf8')).fragments;
  const a = scanE4FromText(text, { fragments });
  const b = scanE4FromText(text, { fragments });
  assert.deepEqual(
    a.candidates.map((c) => c.candidateId),
    b.candidates.map((c) => c.candidateId)
  );

  const mapping = JSON.parse(readFileSync(join(root, 'mappings/clinical-schema-migration.json'), 'utf8'));
  const mapped = new Set(mapping.mappings.map((m) => m.sourcePath));
  const schema = JSON.parse(text);
  const fields = flattenSchemaFieldPaths(schema);
  assert.equal(fields.length, 98);
  assert.deepEqual([...fields].sort(), [...mapped].sort());
  assert.equal(a.schemaFieldPaths.length, 98);

  const question = a.candidates.find((c) => c.payload.sourcePath === '$defs.redFlag.question');
  assert.ok(question);
  assert.equal(question.payload.logicalKind, 'redFlag');
  const slice = hit.bytes
    .subarray(question.verbatimSpan.startByte, question.verbatimSpan.endByte)
    .toString('utf8');
  assert.equal(slice, question.verbatimSpan.text);
  assert.equal(JSON.parse(slice).type, 'string');

  const status = a.candidates.find((c) => c.payload.sourcePath === '$defs.toleranceDimension.status');
  assert.ok(status);
  assert.equal(Array.isArray(status.payload.value.enum), true);
  assert.equal(status.payload.value.enum.includes('irritating'), true);
  assert.equal(JSON.stringify(status.payload.value).includes('forbidden'), false);
});
