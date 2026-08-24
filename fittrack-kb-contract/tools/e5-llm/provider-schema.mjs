const PROVIDER_KEYWORDS = new Set([
  '$defs',
  '$ref',
  'additionalProperties',
  'anyOf',
  'const',
  'description',
  'enum',
  'items',
  'properties',
  'required',
  'type'
]);

const LIMITS = Object.freeze({
  maxDepth: 5,
  maxProperties: 5000,
  maxEnumValues: 1000,
  maxSchemaStringLength: 120_000,
  maxLargeEnumStringLength: 15_000,
  largeEnumThreshold: 250
});

function pointerSegment(value) {
  return value.replaceAll('~', '~0').replaceAll('/', '~1');
}

function cloneJson(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function addDropped(dropped, keyword, path) {
  const paths = dropped.get(keyword) ?? new Set();
  paths.add(`${path}/${pointerSegment(keyword)}`);
  dropped.set(keyword, paths);
}

function jsonValueType(value) {
  if (value === null) return 'null';
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
  return typeof value;
}

function enumValueMatchesType(value, schemaType) {
  const valueType = jsonValueType(value);
  if (schemaType === 'number') return valueType === 'number' || valueType === 'integer';
  return valueType === schemaType;
}

function enumValuesMatchType(values, schemaType) {
  const allowedTypes = Array.isArray(schemaType) ? schemaType : [schemaType];
  return values.every((value) => allowedTypes.some((type) => enumValueMatchesType(value, type)));
}

function inferEnumType(values, path) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new ProviderSchemaProjectionError('provider_schema_enum_must_be_nonempty_array', {
      code: 'ENUM_MUST_BE_NONEMPTY_ARRAY',
      path
    });
  }
  const nonNullValues = values.filter((value) => value !== null);
  if (nonNullValues.length === 0) {
    throw new ProviderSchemaProjectionError('provider_schema_enum_type_inference_failed', {
      code: 'ENUM_NULL_ONLY_TYPE_UNSUPPORTED',
      path,
      enumSize: values.length,
      valueTypes: ['null']
    });
  }
  const nonNullTypes = new Set(nonNullValues.map(jsonValueType));
  let inferredType = null;
  if ([...nonNullTypes].every((type) => type === 'integer')) {
    inferredType = 'integer';
  } else if ([...nonNullTypes].every((type) => type === 'integer' || type === 'number')) {
    inferredType = 'number';
  } else if (nonNullTypes.size === 1 && ['string', 'boolean'].includes([...nonNullTypes][0])) {
    inferredType = [...nonNullTypes][0];
  }
  if (!inferredType) {
    throw new ProviderSchemaProjectionError('provider_schema_enum_type_inference_failed', {
      code: 'ENUM_MIXED_TYPES_UNSUPPORTED',
      path,
      enumSize: values.length,
      valueTypes: [...new Set(values.map(jsonValueType))].sort()
    });
  }
  return values.includes(null) ? [inferredType, 'null'] : inferredType;
}

function projectNode(node, path, dropped, enumTypesInjected) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    throw new ProviderSchemaProjectionError('provider_schema_node_must_be_object', { path });
  }
  const projected = {};
  for (const [keyword, value] of Object.entries(node)) {
    if (!PROVIDER_KEYWORDS.has(keyword)) {
      addDropped(dropped, keyword, path);
      continue;
    }
    if (keyword === 'properties' || keyword === '$defs') {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new ProviderSchemaProjectionError(`provider_schema_${keyword}_must_be_object`, {
          path
        });
      }
      projected[keyword] = {};
      for (const [name, child] of Object.entries(value)) {
        projected[keyword][name] = projectNode(
          child,
          `${path}/${pointerSegment(keyword)}/${pointerSegment(name)}`,
          dropped,
          enumTypesInjected
        );
      }
    } else if (keyword === 'items') {
      projected.items = projectNode(value, `${path}/items`, dropped, enumTypesInjected);
    } else if (keyword === 'anyOf') {
      if (!Array.isArray(value) || value.length === 0) {
        throw new ProviderSchemaProjectionError('provider_schema_anyOf_must_be_nonempty_array', {
          path
        });
      }
      projected.anyOf = value.map((child, index) =>
        projectNode(child, `${path}/anyOf/${index}`, dropped, enumTypesInjected)
      );
    } else {
      projected[keyword] = cloneJson(value);
    }
  }
  if (Array.isArray(projected.enum)) {
    if (projected.type === undefined) {
      const inferredType = inferEnumType(projected.enum, path);
      projected.type = inferredType;
      enumTypesInjected.push({ path, inferredType: cloneJson(inferredType), enumSize: projected.enum.length });
    } else if (!enumValuesMatchType(projected.enum, projected.type)) {
      throw new ProviderSchemaProjectionError('provider_schema_enum_type_mismatch', {
        code: 'ENUM_VALUES_INCOMPATIBLE_WITH_EXISTING_TYPE',
        path,
        enumSize: projected.enum.length,
        existingType: cloneJson(projected.type),
        valueTypes: [...new Set(projected.enum.map(jsonValueType))].sort()
      });
    }
  }
  return projected;
}

function resolveLocalRef(root, ref) {
  if (typeof ref !== 'string' || !ref.startsWith('#/')) return null;
  let current = root;
  for (const rawSegment of ref.slice(2).split('/')) {
    const segment = rawSegment.replaceAll('~1', '/').replaceAll('~0', '~');
    if (!current || typeof current !== 'object' || !Object.hasOwn(current, segment)) return null;
    current = current[segment];
  }
  return current;
}

function isObjectSchema(schema) {
  return schema.type === 'object' || (Array.isArray(schema.type) && schema.type.includes('object'));
}

function countSchema(schema) {
  let propertyCount = 0;
  let enumValueCount = 0;
  let schemaStringLength = 0;
  let refsChecked = 0;
  const errors = [];

  function visit(node, path) {
    if (isObjectSchema(node)) {
      const properties = node.properties ?? {};
      const propertyNames = Object.keys(properties);
      propertyCount += propertyNames.length;
      schemaStringLength += propertyNames.reduce((sum, name) => sum + name.length, 0);
      if (node.additionalProperties !== false) {
        errors.push({ code: 'OBJECT_MUST_DISABLE_ADDITIONAL_PROPERTIES', path });
      }
      const required = Array.isArray(node.required) ? node.required : [];
      const missing = propertyNames.filter((name) => !required.includes(name));
      const unknown = required.filter((name) => !Object.hasOwn(properties, name));
      if (missing.length || unknown.length) {
        errors.push({ code: 'OBJECT_PROPERTIES_MUST_ALL_BE_REQUIRED', path, missing, unknown });
      }
    }
    if (Array.isArray(node.enum)) {
      enumValueCount += node.enum.length;
      const stringValues = node.enum.filter((value) => typeof value === 'string');
      const enumStringLength = stringValues.reduce((sum, value) => sum + value.length, 0);
      schemaStringLength += enumStringLength;
      if (
        node.enum.length > LIMITS.largeEnumThreshold &&
        enumStringLength > LIMITS.maxLargeEnumStringLength
      ) {
        errors.push({ code: 'LARGE_ENUM_STRING_LIMIT_EXCEEDED', path, enumStringLength });
      }
      if (node.type === undefined) {
        errors.push({ code: 'ENUM_TYPE_REQUIRED', path });
      } else if (!enumValuesMatchType(node.enum, node.type)) {
        errors.push({
          code: 'ENUM_VALUES_INCOMPATIBLE_WITH_TYPE',
          path,
          type: cloneJson(node.type)
        });
      }
    }
    if (typeof node.const === 'string') schemaStringLength += node.const.length;
    if (typeof node.$ref === 'string') refsChecked += 1;
    for (const [name, child] of Object.entries(node.properties ?? {})) {
      visit(child, `${path}/properties/${pointerSegment(name)}`);
    }
    if (node.items) visit(node.items, `${path}/items`);
    for (const [index, child] of (node.anyOf ?? []).entries()) {
      visit(child, `${path}/anyOf/${index}`);
    }
    for (const [name, child] of Object.entries(node.$defs ?? {})) {
      schemaStringLength += name.length;
      visit(child, `${path}/$defs/${pointerSegment(name)}`);
    }
  }
  visit(schema, '#');
  return { propertyCount, enumValueCount, schemaStringLength, refsChecked, errors };
}

function measureDepthAndRefs(root) {
  let maxDepth = 1;
  const errors = [];

  function visit(node, depth, path, refStack) {
    maxDepth = Math.max(maxDepth, depth);
    if (typeof node.$ref === 'string') {
      const target = resolveLocalRef(root, node.$ref);
      if (!target) {
        errors.push({ code: 'UNRESOLVED_LOCAL_REF', path, ref: node.$ref });
      } else if (!refStack.has(node.$ref)) {
        visit(target, depth, node.$ref, new Set([...refStack, node.$ref]));
      }
    }
    for (const [name, child] of Object.entries(node.properties ?? {})) {
      visit(child, depth + 1, `${path}/properties/${pointerSegment(name)}`, refStack);
    }
    if (node.items) visit(node.items, depth + 1, `${path}/items`, refStack);
    for (const [index, child] of (node.anyOf ?? []).entries()) {
      visit(child, depth + 1, `${path}/anyOf/${index}`, refStack);
    }
  }

  visit(root, 1, '#', new Set());
  for (const [name, definition] of Object.entries(root.$defs ?? {})) {
    visit(definition, 1, `#/$defs/${pointerSegment(name)}`, new Set());
  }
  return { maxDepth, errors };
}

function assertProviderSchema(providerSchema) {
  const errors = [];
  if (providerSchema.type !== 'object') errors.push({ code: 'ROOT_MUST_BE_OBJECT', path: '#' });
  if (Object.hasOwn(providerSchema, 'anyOf')) errors.push({ code: 'ROOT_ANYOF_FORBIDDEN', path: '#' });
  const counts = countSchema(providerSchema);
  const depth = measureDepthAndRefs(providerSchema);
  errors.push(...counts.errors, ...depth.errors);
  if (counts.propertyCount > LIMITS.maxProperties) {
    errors.push({ code: 'PROPERTY_LIMIT_EXCEEDED', actual: counts.propertyCount });
  }
  if (counts.enumValueCount > LIMITS.maxEnumValues) {
    errors.push({ code: 'ENUM_VALUE_LIMIT_EXCEEDED', actual: counts.enumValueCount });
  }
  if (counts.schemaStringLength > LIMITS.maxSchemaStringLength) {
    errors.push({ code: 'SCHEMA_STRING_LIMIT_EXCEEDED', actual: counts.schemaStringLength });
  }
  if (depth.maxDepth > LIMITS.maxDepth) {
    errors.push({ code: 'SCHEMA_DEPTH_LIMIT_EXCEEDED', actual: depth.maxDepth });
  }
  const assertions = {
    passed: errors.length === 0,
    maxDepth: depth.maxDepth,
    maxDepthLimit: LIMITS.maxDepth,
    propertyCount: counts.propertyCount,
    propertyLimit: LIMITS.maxProperties,
    enumValueCount: counts.enumValueCount,
    enumValueLimit: LIMITS.maxEnumValues,
    schemaStringLength: counts.schemaStringLength,
    schemaStringLengthLimit: LIMITS.maxSchemaStringLength,
    refsChecked: counts.refsChecked,
    errors
  };
  if (errors.length) {
    throw new ProviderSchemaProjectionError('provider_schema_assertion_failed', assertions);
  }
  return assertions;
}

export class ProviderSchemaProjectionError extends Error {
  constructor(message, diagnostic) {
    super(message);
    this.name = 'ProviderSchemaProjectionError';
    this.providerSchemaDiagnostic = diagnostic;
  }
}

// Deep module interface: callers provide the canonical schema and receive one
// provider-safe projection plus its complete audit report.
export function projectProviderSchema(canonicalSchema) {
  const dropped = new Map();
  const enumTypesInjected = [];
  const providerSchema = projectNode(canonicalSchema, '#', dropped, enumTypesInjected);
  const providerSchemaAssertions = assertProviderSchema(providerSchema);
  const providerSchemaDroppedKeywords = [...dropped.entries()]
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([keyword, paths]) => ({ keyword, paths: [...paths].sort() }));
  return {
    providerSchema,
    providerSchemaDroppedKeywords,
    providerEnumTypesInjected: enumTypesInjected.sort((left, right) =>
      left.path < right.path ? -1 : left.path > right.path ? 1 : 0
    ),
    providerSchemaAssertions
  };
}
