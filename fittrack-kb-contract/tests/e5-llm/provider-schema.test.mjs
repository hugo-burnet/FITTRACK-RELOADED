import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import Ajv2020 from 'ajv/dist/2020.js';
import { createE5ProviderPredictionSchema } from '../../tools/e5-llm/provider-dto.mjs';
import { projectProviderSchema } from '../../tools/e5-llm/provider-schema.mjs';

const root = join(import.meta.dirname, '../..');
const canonicalE5Schema = JSON.parse(
  readFileSync(join(root, 'benchmark/e5/v0/prediction.schema.json'), 'utf8')
);

function objectSchema(properties, extra = {}) {
  return {
    type: 'object',
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
    ...extra
  };
}

test('minLength is dropped from provider projection but retained canonically', () => {
  const canonical = objectSchema({ name: { type: 'string', minLength: 1 } });
  const before = structuredClone(canonical);
  const projection = projectProviderSchema(canonical);
  assert.equal(Object.hasOwn(projection.providerSchema.properties.name, 'minLength'), false);
  assert.equal(canonical.properties.name.minLength, 1);
  assert.deepEqual(canonical, before);
});

test('uniqueItems is dropped from provider projection but retained canonically', () => {
  const canonical = objectSchema({ tags: { type: 'array', items: { type: 'string' }, uniqueItems: true } });
  const projection = projectProviderSchema(canonical);
  assert.equal(Object.hasOwn(projection.providerSchema.properties.tags, 'uniqueItems'), false);
  assert.equal(canonical.properties.tags.uniqueItems, true);
});

test('nested objects project recursively with their strict object contract', () => {
  const canonical = objectSchema({
    nested: objectSchema({ value: { type: 'string', minLength: 1 } })
  });
  const { providerSchema } = projectProviderSchema(canonical);
  assert.deepEqual(providerSchema.properties.nested.required, ['value']);
  assert.equal(providerSchema.properties.nested.additionalProperties, false);
  assert.equal(Object.hasOwn(providerSchema.properties.nested.properties.value, 'minLength'), false);
});

test('$defs and local $ref remain coherent after projection', () => {
  const canonical = objectSchema(
    { item: { $ref: '#/$defs/item' } },
    { $defs: { item: objectSchema({ value: { type: 'string' } }) } }
  );
  const projection = projectProviderSchema(canonical);
  assert.equal(projection.providerSchema.properties.item.$ref, '#/$defs/item');
  assert.equal(projection.providerSchema.$defs.item.type, 'object');
  assert.equal(projection.providerSchemaAssertions.refsChecked, 1);
});

test('enum values are preserved exactly', () => {
  const canonical = objectSchema({ state: { enum: ['A', 'B', null] } });
  const { providerSchema } = projectProviderSchema(canonical);
  assert.deepEqual(providerSchema.properties.state.enum, ['A', 'B', null]);
});

test('additionalProperties false is preserved on every object', () => {
  const canonical = objectSchema({ nested: objectSchema({ ok: { type: 'boolean' } }) });
  const projection = projectProviderSchema(canonical);
  assert.equal(projection.providerSchema.additionalProperties, false);
  assert.equal(projection.providerSchema.properties.nested.additionalProperties, false);
  assert.equal(projection.providerSchemaAssertions.passed, true);
});

test('all properties must remain required before any provider request', () => {
  const invalid = {
    type: 'object',
    properties: { requiredValue: { type: 'string' } },
    required: [],
    additionalProperties: false
  };
  assert.throws(
    () => projectProviderSchema(invalid),
    (error) =>
      error.providerSchemaDiagnostic.errors.some(
        (item) => item.code === 'OBJECT_PROPERTIES_MUST_ALL_BE_REQUIRED'
      )
  );
});

test('unknown provider keywords are excluded without changing canonical data', () => {
  const canonical = objectSchema({ value: { type: 'string', futureKeyword: 'local-only' } });
  const projection = projectProviderSchema(canonical);
  assert.equal(Object.hasOwn(projection.providerSchema.properties.value, 'futureKeyword'), false);
  assert.equal(canonical.properties.value.futureKeyword, 'local-only');
});

test('dropped keyword report is deterministic by keyword and path', () => {
  const first = projectProviderSchema(createE5ProviderPredictionSchema(canonicalE5Schema));
  const second = projectProviderSchema(
    createE5ProviderPredictionSchema(structuredClone(canonicalE5Schema))
  );
  assert.deepEqual(first.providerSchemaDroppedKeywords, second.providerSchemaDroppedKeywords);
  assert.deepEqual(
    first.providerSchemaDroppedKeywords.map((item) => item.keyword),
    [...first.providerSchemaDroppedKeywords.map((item) => item.keyword)].sort()
  );
  assert.ok(first.providerSchemaDroppedKeywords.some((item) => item.keyword === 'minLength'));
  assert.ok(first.providerSchemaDroppedKeywords.some((item) => item.keyword === 'uniqueItems'));
});

test('provider-accepted output can still be rejected by canonical validation', () => {
  const canonical = objectSchema({ name: { type: 'string', minLength: 1 } });
  const { providerSchema } = projectProviderSchema(canonical);
  const ajv = new Ajv2020({ strict: false, allErrors: true, allowUnionTypes: true });
  const providerValidator = ajv.compile(providerSchema);
  const canonicalValidator = ajv.compile(canonical);
  assert.equal(providerValidator({ name: '' }), true);
  assert.equal(canonicalValidator({ name: '' }), false);
});

test('shallow E5 Provider DTO passes Azure provider limits and ref assertions', () => {
  const v3 = createE5ProviderPredictionSchema(canonicalE5Schema, {
    dtoVersion: 'e5-provider-prediction-v3'
  });
  const v2 = createE5ProviderPredictionSchema(canonicalE5Schema, {
    dtoVersion: 'e5-provider-prediction-v2'
  });
  const projection = projectProviderSchema(v3);
  assert.equal(projection.providerSchemaAssertions.passed, true);
  assert.ok(projection.providerSchemaAssertions.maxDepth <= 5);
  assert.ok(projection.providerSchemaAssertions.propertyCount <= 5000);
  assert.ok(projection.providerSchemaAssertions.enumValueCount <= 1000);
  assert.ok(projection.providerSchemaAssertions.refsChecked > 0);
  assert.ok(projectProviderSchema(v2).providerSchemaAssertions.maxDepth <= 5);
});

test('root anyOf is rejected locally before provider access', () => {
  assert.throws(
    () => projectProviderSchema({ anyOf: [objectSchema({ ok: { type: 'boolean' } })] }),
    (error) => error.providerSchemaDiagnostic.errors.some((item) => item.code === 'ROOT_MUST_BE_OBJECT')
  );
});

test('enum strings inject type string from values only', () => {
  const projection = projectProviderSchema(objectSchema({ value: { enum: ['alpha', 'beta'] } }));
  assert.equal(projection.providerSchema.properties.value.type, 'string');
  assert.deepEqual(projection.providerEnumTypesInjected, [
    { path: '#/properties/value', inferredType: 'string', enumSize: 2 }
  ]);
});

test('enum booleans inject type boolean', () => {
  const projection = projectProviderSchema(objectSchema({ value: { enum: [true, false] } }));
  assert.equal(projection.providerSchema.properties.value.type, 'boolean');
});

test('enum integers inject type integer', () => {
  const projection = projectProviderSchema(objectSchema({ value: { enum: [0, 1, -2] } }));
  assert.equal(projection.providerSchema.properties.value.type, 'integer');
});

test('enum numbers inject type number when at least one value is non-integer', () => {
  const projection = projectProviderSchema(objectSchema({ value: { enum: [1, 2.5] } }));
  assert.equal(projection.providerSchema.properties.value.type, 'number');
});

test('an explicitly typed enum remains unchanged and is not reported as injected', () => {
  const canonical = objectSchema({ value: { type: 'string', enum: ['A', 'B'] } });
  const projection = projectProviderSchema(canonical);
  assert.equal(projection.providerSchema.properties.value.type, 'string');
  assert.deepEqual(projection.providerEnumTypesInjected, []);
});

test('an incompatible mixed enum is rejected locally', () => {
  assert.throws(
    () => projectProviderSchema(objectSchema({ value: { enum: ['foo', 3] } })),
    (error) =>
      error.providerSchemaDiagnostic.code === 'ENUM_MIXED_TYPES_UNSUPPORTED' &&
      error.providerSchemaDiagnostic.path === '#/properties/value'
  );
});

test('null plus one homogeneous enum type uses the existing nullable union representation', () => {
  const projection = projectProviderSchema(objectSchema({ value: { enum: ['A', null, 'B'] } }));
  assert.deepEqual(projection.providerSchema.properties.value.type, ['string', 'null']);
  assert.deepEqual(projection.providerEnumTypesInjected[0].inferredType, ['string', 'null']);
});

test('enum type inference applies inside $defs', () => {
  const canonical = objectSchema(
    { state: { $ref: '#/$defs/state' } },
    { $defs: { state: { enum: ['READY', 'DONE'] } } }
  );
  const projection = projectProviderSchema(canonical);
  assert.equal(projection.providerSchema.$defs.state.type, 'string');
  assert.equal(projection.providerEnumTypesInjected[0].path, '#/$defs/state');
});

test('enum type inference applies inside array items', () => {
  const canonical = objectSchema({ values: { type: 'array', items: { enum: [true, false] } } });
  const projection = projectProviderSchema(canonical);
  assert.equal(projection.providerSchema.properties.values.items.type, 'boolean');
  assert.equal(projection.providerEnumTypesInjected[0].path, '#/properties/values/items');
});

test('enum projection and diagnostics are identical on two runs', () => {
  const first = projectProviderSchema(createE5ProviderPredictionSchema(canonicalE5Schema));
  const second = projectProviderSchema(
    createE5ProviderPredictionSchema(structuredClone(canonicalE5Schema))
  );
  assert.deepEqual(first.providerSchema, second.providerSchema);
  assert.deepEqual(first.providerEnumTypesInjected, second.providerEnumTypesInjected);
});

test('enum inference leaves the canonical schema unchanged', () => {
  const canonical = objectSchema({ value: { enum: ['A', 'B'] } });
  const before = structuredClone(canonical);
  projectProviderSchema(canonical);
  assert.deepEqual(canonical, before);
  assert.equal(Object.hasOwn(canonical.properties.value, 'type'), false);
});

test('the deep canonical E5 schema is blocked locally instead of being sent to Azure', () => {
  assert.throws(
    () => projectProviderSchema(canonicalE5Schema),
    (error) =>
      error.providerSchemaDiagnostic.errors.some(
        (item) => item.code === 'SCHEMA_DEPTH_LIMIT_EXCEEDED' && item.actual === 8
      )
  );
});
