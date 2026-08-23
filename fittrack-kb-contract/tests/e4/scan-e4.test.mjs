import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { flattenSchemaFieldPaths } from '../../tools/walk-json.mjs';
import { scanE4FromText, sourcePathFromPointer } from '../../tools/scan-e4.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../..');

test('E4 candidates keep raw JSON values and stable ids', () => {
  const text = '{"flag":true,"n":1}';
  const a = scanE4FromText(text);
  const b = scanE4FromText(text);
  assert.deepEqual(
    a.candidates.map((c) => c.candidateId),
    b.candidates.map((c) => c.candidateId)
  );
  const n = a.candidates.find((c) => c.payload.jsonPointer === '/n');
  assert.equal(n.payload.value, 1);
  assert.equal(n.extraction.method, 'deterministic_json_path');
  assert.match(n.candidateId, /^cand\.e4\.[0-9a-f]{8,}$/);
});

test('E4 candidates validate against extraction-candidate.schema.json', () => {
  const ajv = new Ajv2020({ strict: false, allErrors: true, allowUnionTypes: true });
  addFormats(ajv);
  ajv.addSchema(JSON.parse(readFileSync(join(root, 'schemas/common/vocab.schema.json'), 'utf8')));
  const validate = ajv.compile(
    JSON.parse(readFileSync(join(root, 'extraction-contract/extraction-candidate.schema.json'), 'utf8'))
  );
  const { candidates } = scanE4FromText('{"a":null}');
  for (const c of candidates) {
    assert.equal(validate(c), true, ajv.errorsText(validate.errors));
  }
});

test('invalid JSON yields a diagnostic and no candidates', () => {
  const out = scanE4FromText('{');
  assert.equal(out.candidates.length, 0);
  assert.equal(out.diagnostics[0].type, 'invalid_json');
});

test('embedded F4 source defs are json_path candidates, not curated Source', () => {
  const { candidates } = scanE4FromText('{"$defs":{"source":{"type":"object"}}}');
  const src = candidates.find((c) => c.payload.jsonPointer === '/$defs/source');
  assert.equal(src.targetKind, 'json_path');
  assert.equal(src.payload.logicalKind, 'source');
  assert.equal(src.payload.resolvesToSourceRef, undefined);
});

test('pointer /properties/globalSafetyRules/properties/redFlags maps to schema field path', () => {
  assert.equal(
    sourcePathFromPointer('/properties/globalSafetyRules/properties/redFlags'),
    'globalSafetyRules.redFlags'
  );
  assert.equal(sourcePathFromPointer('/$defs/redFlag/properties/question'), '$defs.redFlag.question');
});
