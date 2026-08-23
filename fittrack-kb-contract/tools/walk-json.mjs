// Parcours déterministe d'un document JSON : JSON Pointer RFC 6901, type,
// valeur brute, offsets octets. Aucune interprétation métier.

export function escapePointerToken(token) {
  return String(token).replaceAll('~', '~0').replaceAll('/', '~1');
}

export function joinPointer(parent, token) {
  return `${parent}/${escapePointerToken(token)}`;
}

export function joinJsonPath(parent, token, isIndex) {
  if (isIndex) return `${parent}[${token}]`;
  const escaped = String(token).replaceAll('\\', '\\\\').replaceAll("'", "\\'");
  return `${parent}['${escaped}']`;
}

function byteIndex(text, charIndex) {
  return Buffer.byteLength(text.slice(0, charIndex), 'utf8');
}

export function walkJsonDocument(text) {
  if (typeof text !== 'string' || !String(text).trim()) {
    return {
      nodes: [],
      diagnostics: [{ type: 'invalid_json', message: 'JSON vide ou absent.' }]
    };
  }
  const s = text;
  let i = 0;

  const skipWs = () => {
    while (i < s.length && /[ \t\r\n]/.test(s[i])) i += 1;
  };

  const fail = (msg) => {
    throw new Error(msg);
  };

  const parseString = () => {
    if (s[i] !== '"') fail('string expected');
    i += 1;
    let out = '';
    while (i < s.length) {
      const c = s[i];
      if (c === '"') {
        i += 1;
        return out;
      }
      if (c === '\\') {
        i += 1;
        const e = s[i];
        const map = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };
        if (e in map) {
          out += map[e];
          i += 1;
          continue;
        }
        if (e === 'u') {
          const hex = s.slice(i + 1, i + 5);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) fail('bad unicode escape');
          out += String.fromCharCode(parseInt(hex, 16));
          i += 5;
          continue;
        }
        fail('bad escape');
      }
      out += c;
      i += 1;
    }
    fail('unterminated string');
  };

  const parseNumber = () => {
    const start = i;
    if (s[i] === '-') i += 1;
    if (s[i] === '0') i += 1;
    else {
      if (!/[1-9]/.test(s[i] ?? '')) fail('bad number');
      while (/[0-9]/.test(s[i] ?? '')) i += 1;
    }
    if (s[i] === '.') {
      i += 1;
      if (!/[0-9]/.test(s[i] ?? '')) fail('bad number');
      while (/[0-9]/.test(s[i] ?? '')) i += 1;
    }
    if (s[i] === 'e' || s[i] === 'E') {
      i += 1;
      if (s[i] === '+' || s[i] === '-') i += 1;
      if (!/[0-9]/.test(s[i] ?? '')) fail('bad number');
      while (/[0-9]/.test(s[i] ?? '')) i += 1;
    }
    return Number(s.slice(start, i));
  };

  const parseLiteral = (word, value) => {
    if (s.slice(i, i + word.length) !== word) fail('bad literal');
    i += word.length;
    return value;
  };

  const parseValue = () => {
    skipWs();
    const start = i;
    if (i >= s.length) fail('unexpected end');
    const c = s[i];
    let jsonType;
    let value;
    const children = [];
    if (c === '"') {
      jsonType = 'string';
      value = parseString();
    } else if (c === '{') {
      jsonType = 'object';
      i += 1;
      skipWs();
      value = {};
      if (s[i] !== '}') {
        while (true) {
          skipWs();
          const key = parseString();
          skipWs();
          if (s[i] !== ':') fail('colon expected');
          i += 1;
          const child = parseValue();
          value[key] = child.value;
          children.push({ key, index: null, node: child });
          skipWs();
          if (s[i] === '}') break;
          if (s[i] !== ',') fail('comma expected');
          i += 1;
        }
      }
      i += 1;
    } else if (c === '[') {
      jsonType = 'array';
      i += 1;
      skipWs();
      value = [];
      if (s[i] !== ']') {
        let index = 0;
        while (true) {
          const child = parseValue();
          value.push(child.value);
          children.push({ key: String(index), index, node: child });
          index += 1;
          skipWs();
          if (s[i] === ']') break;
          if (s[i] !== ',') fail('comma expected');
          i += 1;
        }
      }
      i += 1;
    } else if (c === 't') {
      jsonType = 'boolean';
      value = parseLiteral('true', true);
    } else if (c === 'f') {
      jsonType = 'boolean';
      value = parseLiteral('false', false);
    } else if (c === 'n') {
      jsonType = 'null';
      value = parseLiteral('null', null);
    } else if (c === '-' || /[0-9]/.test(c)) {
      jsonType = 'number';
      value = parseNumber();
    } else fail(`unexpected ${c}`);
    return { jsonType, value, children, start, end: i };
  };

  try {
    const root = parseValue();
    skipWs();
    if (i !== s.length) {
      return {
        nodes: [],
        diagnostics: [{ type: 'invalid_json', message: 'Trailing content after JSON value.' }]
      };
    }
    const nodes = [];
    const flatten = (node, jsonPointer, jsonPath, parentPointer, parentKey, arrayIndex) => {
      nodes.push({
        jsonPointer,
        jsonPath,
        parentPointer,
        parentKey,
        arrayIndex,
        jsonType: node.jsonType,
        value: node.value,
        presence: node.jsonType === 'null' ? 'explicit_null' : 'present',
        startByte: byteIndex(s, node.start),
        endByte: byteIndex(s, node.end),
        order: nodes.length
      });
      for (const ch of node.children) {
        const isIndex = ch.index != null;
        flatten(
          ch.node,
          joinPointer(jsonPointer, ch.key),
          joinJsonPath(jsonPath, ch.key, isIndex),
          jsonPointer,
          isIndex ? ch.index : ch.key,
          isIndex ? ch.index : null
        );
      }
    };
    flatten(root, '', '$', null, null, null);
    return { nodes, diagnostics: [] };
  } catch (e) {
    return {
      nodes: [],
      diagnostics: [{ type: 'invalid_json', message: e.message }]
    };
  }
}

export function flattenSchemaFieldPaths(schema) {
  const out = new Set();
  const walk = (node, path) => {
    if (node === null || typeof node !== 'object') return;
    if (node.properties && typeof node.properties === 'object') {
      for (const [k, v] of Object.entries(node.properties)) {
        const p = path ? `${path}.${k}` : k;
        out.add(p);
        walk(v, p);
      }
    }
    if (node.items) walk(node.items, path ? `${path}[]` : '[]');
    if (node.additionalProperties && typeof node.additionalProperties === 'object') {
      walk(node.additionalProperties, path ? `${path}.*` : '*');
    }
    if (node.$defs) {
      for (const [k, v] of Object.entries(node.$defs)) {
        const p = `$defs.${k}`;
        out.add(p);
        walk(v, p);
      }
    }
  };
  walk(schema, '');
  return [...out];
}
