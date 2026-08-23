import { test } from 'node:test';
import assert from 'node:assert/strict';
import { walkJsonDocument } from '../../tools/walk-json.mjs';

test('walks a scalar property', () => {
  const { nodes } = walkJsonDocument('{"title":"hello"}');
  const n = nodes.find((x) => x.jsonPointer === '/title');
  assert.equal(n.jsonType, 'string');
  assert.equal(n.value, 'hello');
});

test('walks a nested object', () => {
  const { nodes } = walkJsonDocument('{"a":{"b":1}}');
  assert.ok(nodes.find((x) => x.jsonPointer === '/a' && x.jsonType === 'object'));
  assert.equal(nodes.find((x) => x.jsonPointer === '/a/b').value, 1);
  assert.equal(nodes.find((x) => x.jsonPointer === '/a/b').parentPointer, '/a');
  assert.equal(nodes.find((x) => x.jsonPointer === '/a/b').parentKey, 'b');
});

test('walks a simple array in index order', () => {
  const { nodes } = walkJsonDocument('{"xs":["a","b"]}');
  const items = nodes.filter((x) => x.parentPointer === '/xs' && x.arrayIndex != null);
  assert.deepEqual(items.map((x) => x.value), ['a', 'b']);
  assert.equal(items[0].jsonPointer, '/xs/0');
  assert.equal(items[1].arrayIndex, 1);
});

test('walks an array of objects', () => {
  const { nodes } = walkJsonDocument('{"items":[{"id":"x"},{"id":"y"}]}');
  assert.equal(nodes.find((x) => x.jsonPointer === '/items/0/id').value, 'x');
  assert.equal(nodes.find((x) => x.jsonPointer === '/items/1/id').value, 'y');
});

test('keeps explicit null distinct from an absent field', () => {
  const { nodes } = walkJsonDocument('{"a":null}');
  const a = nodes.find((x) => x.jsonPointer === '/a');
  assert.equal(a.jsonType, 'null');
  assert.equal(a.value, null);
  assert.equal(a.presence, 'explicit_null');
  assert.equal(nodes.some((x) => x.jsonPointer === '/b'), false);
});

test('walks booleans and numbers', () => {
  const { nodes } = walkJsonDocument('{"ok":true,"n":3.5}');
  assert.equal(nodes.find((x) => x.jsonPointer === '/ok').jsonType, 'boolean');
  assert.equal(nodes.find((x) => x.jsonPointer === '/ok').value, true);
  assert.equal(nodes.find((x) => x.jsonPointer === '/n').jsonType, 'number');
  assert.equal(nodes.find((x) => x.jsonPointer === '/n').value, 3.5);
});

test('preserves unicode in strings and byte offsets reread the token', () => {
  const text = '{"label":"élévation"}';
  const { nodes } = walkJsonDocument(text);
  const n = nodes.find((x) => x.jsonPointer === '/label');
  assert.equal(n.value, 'élévation');
  const slice = Buffer.from(text, 'utf8').subarray(n.startByte, n.endByte).toString('utf8');
  assert.equal(JSON.parse(slice), 'élévation');
});

test('walks a complete redFlag object without turning it into a prescription', () => {
  const text = JSON.stringify({
    redFlag: {
      question: 'Douleur thoracique ?',
      positiveExamples: ['irradiation'],
      action: 'stop_and_emergency_assessment',
      urgency: 'emergency_now',
      sourceIds: ['src-1'],
      warning: 'ne pas diagnostiquer'
    }
  });
  const { nodes } = walkJsonDocument(text);
  assert.equal(nodes.find((x) => x.jsonPointer === '/redFlag/question').value, 'Douleur thoracique ?');
  assert.equal(nodes.find((x) => x.jsonPointer === '/redFlag/action').value, 'stop_and_emergency_assessment');
  assert.equal(nodes.find((x) => x.jsonPointer === '/redFlag/forbidden'), undefined);
});

test('walks toleranceDimension fields separately without a global score', () => {
  const text = JSON.stringify({
    loadSensitivity: {
      status: 'irritating',
      basis: 'user_report',
      testedRange: null,
      testedLoad: '20 kg',
      symptomDuring: 3,
      symptomAfter24h: 2,
      notes: 'ok'
    }
  });
  const { nodes } = walkJsonDocument(text);
  assert.equal(nodes.find((x) => x.jsonPointer === '/loadSensitivity/status').value, 'irritating');
  assert.equal(nodes.find((x) => x.jsonPointer === '/loadSensitivity/testedRange').presence, 'explicit_null');
  assert.equal(nodes.some((x) => x.value === 'forbidden'), false);
});

test('walks modification.doseChange without generating a tool call', () => {
  const text = JSON.stringify({
    recommendedModifications: [
      {
        trigger: 'pain > 3',
        action: 'reduce load',
        doseChange: { load: 'decrease', sets: null },
        monitoring: 'RPE',
        stopCriteria: ['red flag'],
        evidence: { level: 'C_low' }
      }
    ]
  });
  const { nodes } = walkJsonDocument(text);
  assert.equal(nodes.find((x) => x.jsonPointer === '/recommendedModifications/0/doseChange/load').value, 'decrease');
  assert.equal(nodes.find((x) => x.jsonPointer === '/recommendedModifications/0/doseChange/sets').presence, 'explicit_null');
  assert.equal(nodes.some((x) => String(x.value).includes('tool call')), false);
});

test('walks a conditionRecord and an embedded source as data, not curated Source', () => {
  const text = JSON.stringify({
    conditionRecords: [
      {
        condition: ' lombalgie ',
        sources: [{ id: 's1', title: 'NICE', url: 'https://example.com' }]
      }
    ]
  });
  const { nodes } = walkJsonDocument(text);
  assert.equal(nodes.find((x) => x.jsonPointer === '/conditionRecords/0/condition').value, ' lombalgie ');
  const src = nodes.find((x) => x.jsonPointer === '/conditionRecords/0/sources/0/title');
  assert.equal(src.value, 'NICE');
});

test('order, JSON Pointer and walk are stable and idempotent', () => {
  const text = '{"z":1,"a":[true,null]}';
  const a = walkJsonDocument(text);
  const b = walkJsonDocument(text);
  assert.deepEqual(
    a.nodes.map((n) => n.jsonPointer),
    b.nodes.map((n) => n.jsonPointer)
  );
  assert.deepEqual(
    a.nodes.map((n) => n.jsonPointer),
    ['', '/z', '/a', '/a/0', '/a/1']
  );
  assert.equal(a.nodes.find((n) => n.jsonPointer === '/a/1').jsonPath, "$['a'][1]");
});

test('invalid JSON is diagnosed instead of throwing', () => {
  const out = walkJsonDocument('{');
  assert.equal(out.nodes.length, 0);
  assert.equal(out.diagnostics[0].type, 'invalid_json');
});
