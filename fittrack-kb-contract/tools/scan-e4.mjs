// E4 — deterministic_json_path sur F4 (JSON Schema).
// Produit des occurrences de chemins, pas des règles cliniques.

import { createHash } from 'node:crypto';
import { flattenSchemaFieldPaths, walkJsonDocument } from './walk-json.mjs';

export const EXTRACTOR_VERSION = '0.1.0-e4';
export const EXTRACTED_AT = '2026-08-23T00:00:00.000Z';
export const CORPUS_FILE_ID = 'corpus.f4.schema-ia-coaching';

const sha256 = (value) =>
  'sha256:' + createHash('sha256').update(value, typeof value === 'string' ? 'utf8' : undefined).digest('hex');

function unescapePointer(token) {
  return token.replaceAll('~1', '/').replaceAll('~0', '~');
}

function pointerParts(pointer) {
  if (!pointer) return [];
  return pointer
    .split('/')
    .slice(1)
    .map(unescapePointer);
}

export function sourcePathFromPointer(pointer) {
  const parts = pointerParts(pointer);
  const out = [];
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    if (part === '$defs' && parts[i + 1] != null) {
      out.push(`$defs.${parts[i + 1]}`);
      i += 1;
      continue;
    }
    if (part === 'properties' && parts[i + 1] != null) {
      out.push(parts[i + 1]);
      i += 1;
      continue;
    }
    if (part === 'items') {
      if (out.length) out[out.length - 1] += '[]';
      else out.push('[]');
      continue;
    }
    if (part === 'additionalProperties') {
      if (out.length) out[out.length - 1] += '.*';
      else out.push('*');
      continue;
    }
    return null;
  }
  return out.length ? out.join('.') : null;
}

export function logicalKindFromPointer(pointer) {
  const p = pointer ?? '';
  if (p.includes('/contraindications')) return 'contraindication';
  if (p.includes('/expertPractice')) return 'expertPractice';
  if (p === '/$defs/redFlag' || p.startsWith('/$defs/redFlag/')) return 'redFlag';
  if (p.includes('/redFlags')) return 'redFlags';
  if (p === '/$defs/toleranceDimension' || p.startsWith('/$defs/toleranceDimension/')) return 'toleranceDimension';
  if (p === '/$defs/modification' || p.startsWith('/$defs/modification/')) return 'modification';
  if (p === '/$defs/source' || p.startsWith('/$defs/source/')) return 'source';
  if (p === '/$defs/zoneRule' || p.startsWith('/$defs/zoneRule/')) return 'zoneRule';
  if (p.includes('/zoneLogic')) return 'zoneLogic';
  if (p === '/$defs/evidenceRating' || p.startsWith('/$defs/evidenceRating/')) return 'evidenceRating';
  if (p === '/$defs/conditionRecord' || p.startsWith('/$defs/conditionRecord/')) return 'conditionRecord';
  if (p.includes('/globalSafetyRules')) return 'globalSafetyRules';
  if (p.includes('/conditionRecords')) return 'conditionRecords';
  return null;
}

function fragmentRefFor(node, fragments, seq) {
  const containing = (fragments ?? [])
    .filter(
      (f) =>
        f.corpusFileId === CORPUS_FILE_ID &&
        f.blockType === 'json_object' &&
        node.startByte >= f.startByte &&
        node.endByte <= f.endByte
    )
    .sort((a, b) => a.endByte - a.startByte - (b.endByte - b.startByte));
  if (containing[0]) return containing[0].fragmentId;
  return `frag.e4.${String(seq).padStart(4, '0')}`;
}

export function scanE4FromText(text, { fragments = [] } = {}) {
  const walked = walkJsonDocument(text);
  if (walked.diagnostics.length && walked.nodes.length === 0) {
    return { candidates: [], diagnostics: walked.diagnostics, schemaFieldPaths: [] };
  }
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }
  const schemaFieldPaths = parsed ? flattenSchemaFieldPaths(parsed) : [];
  const diagnostics = [...walked.diagnostics];
  const candidates = [];
  let unmatched = 0;
  for (const node of walked.nodes) {
    const sourcePath = sourcePathFromPointer(node.jsonPointer);
    const logicalKind = logicalKindFromPointer(node.jsonPointer);
    const fragmentRef = fragmentRefFor(node, fragments, unmatched + 1);
    if (fragmentRef.startsWith('frag.e4.')) unmatched += 1;
    const idSeed = `${CORPUS_FILE_ID}\n${node.jsonPointer}`;
    candidates.push({
      candidateId: `cand.e4.${sha256(idSeed).slice(7, 23)}`,
      targetKind: 'json_path',
      fragmentRef,
      corpusFileRef: CORPUS_FILE_ID,
      extraction: {
        method: 'deterministic_json_path',
        runId: 'run.e4',
        extractedAt: EXTRACTED_AT,
        extractorVersion: EXTRACTOR_VERSION
      },
      payload: {
        jsonPointer: node.jsonPointer,
        jsonPath: node.jsonPath,
        sourcePath,
        parentPointer: node.parentPointer,
        parentKey: node.parentKey,
        arrayIndex: node.arrayIndex,
        jsonType: node.jsonType,
        value: node.value,
        presence: node.presence,
        logicalKind,
        order: node.order
      },
      verbatimSpan: {
        text: Buffer.from(text, 'utf8').subarray(node.startByte, node.endByte).toString('utf8'),
        startByte: node.startByte,
        endByte: node.endByte
      },
      reviewState: 'pending_human_review'
    });
  }

  return { candidates, diagnostics, schemaFieldPaths, nodeCount: walked.nodes.length };
}

export function e4Stats({ candidates, diagnostics, schemaFieldPaths }) {
  const kind = (k) => candidates.filter((c) => c.payload.logicalKind === k).length;
  return {
    pathsVisited: candidates.length,
    candidatesProduced: candidates.length,
    schemaFieldPaths: schemaFieldPaths.length,
    conditionRecords: kind('conditionRecords') + kind('conditionRecord'),
    redFlags: kind('redFlag') + kind('redFlags'),
    zoneRules: kind('zoneRule') + kind('zoneLogic'),
    toleranceDimensions: kind('toleranceDimension'),
    modifications: kind('modification'),
    contraindications: kind('contraindication'),
    sources: kind('source'),
    expertPractice: kind('expertPractice'),
    explicitNulls: candidates.filter((c) => c.payload.presence === 'explicit_null').length,
    diagnostics: diagnostics.length
  };
}
