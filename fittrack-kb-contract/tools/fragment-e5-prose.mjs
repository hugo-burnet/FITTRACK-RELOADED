// E5-P0a — fragmentation déterministe de la prose F2/F3.
//
// L'unité est le bloc Markdown fixé par le Design Review : paragraphe, item de
// liste ou blockquote/callout. Les titres, tableaux, blocs de code, séparateurs
// et registres bibliographiques ne sont jamais transformés en fragments.

import { createHash } from 'node:crypto';
import { isSeparatorRow, isTableRow } from './parse-markdown-table.mjs';

export const E5_P0_EXTRACTOR_VERSION = '0.1.0-e5-p0';
export const E5_P0_EXTRACTED_AT = '2026-08-24T00:00:00.000Z';

export const sha256 = (value) =>
  'sha256:' + createHash('sha256').update(value).digest('hex');

function lineRecords(bytes) {
  const records = [];
  let startByte = 0;
  let lineNumber = 1;
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] !== 0x0a) continue;
    const contentEndByte = i > startByte && bytes[i - 1] === 0x0d ? i - 1 : i;
    records.push({
      lineNumber,
      startByte,
      contentEndByte,
      endByte: i + 1,
      text: bytes.subarray(startByte, contentEndByte).toString('utf8')
    });
    lineNumber += 1;
    startByte = i + 1;
  }
  if (startByte < bytes.length || bytes.length === 0) {
    records.push({
      lineNumber,
      startByte,
      contentEndByte: bytes.length,
      endByte: bytes.length,
      text: bytes.subarray(startByte).toString('utf8')
    });
  }
  return records;
}

function headingMatch(text) {
  return /^(#{1,6})\s+(.*)$/.exec(text);
}

function isBlank(text) {
  return /^\s*$/.test(text);
}

function isThematicBreak(text) {
  return /^\s{0,3}(?:(?:\*\s*){3,}|(?:-\s*){3,}|(?:_\s*){3,})\s*$/.test(text);
}

function isFence(text) {
  return /^\s{0,3}(`{3,}|~{3,})/.exec(text);
}

function isListItem(text) {
  return /^\s{0,3}(?:[-+*]|\d+[.)])\s+/.test(text);
}

function isBlockquote(text) {
  return /^\s{0,3}>/.test(text);
}

function updateHeadingPath(path, match) {
  const next = [...path];
  const level = match[1].length;
  next.length = Math.min(next.length, level - 1);
  next[level - 1] = match[2].trim();
  return next;
}

function inBibliographicRegistry(headingPath) {
  return headingPath.some((heading) => /^15\.\s+Registre des sources prioritaires$/i.test(heading));
}

function tableRanges(lines) {
  const ranges = new Map();
  let i = 0;
  while (i < lines.length - 1) {
    if (isTableRow(lines[i].text) && isSeparatorRow(lines[i + 1].text)) {
      let end = i + 2;
      while (end < lines.length && isTableRow(lines[end].text)) end += 1;
      for (let j = i; j < end; j++) ranges.set(j, { start: i, end });
      i = end;
      continue;
    }
    i += 1;
  }
  return ranges;
}

function zoneFromLines(lines, start, end, reason, bytes) {
  const startLine = lines[start];
  const endLine = lines[end - 1];
  const startByte = startLine.startByte;
  const endByte = endLine.endByte;
  return {
    reason,
    startLine: startLine.lineNumber,
    endLine: endLine.lineNumber,
    startByte,
    endByte,
    byteLength: endByte - startByte,
    textHash: sha256(bytes.subarray(startByte, endByte))
  };
}

function legacyKey(fragment) {
  return [fragment.corpusFileId, fragment.startByte, fragment.endByte, fragment.rawText].join('\n');
}

function fragmentIdFor(shortLabel, startByte) {
  return `frag.e5${shortLabel.toLowerCase()}.${String(startByte).padStart(8, '0')}`;
}

function createFragment({ bytes, lines, start, end, corpusFile, headingPath, blockType, legacyBySpan }) {
  const first = lines[start];
  const last = lines[end - 1];
  const startByte = first.startByte;
  const endByte = last.contentEndByte;
  const rawBytes = bytes.subarray(startByte, endByte);
  const rawText = rawBytes.toString('utf8');
  const candidate = {
    corpusFileId: corpusFile.corpusFileId,
    startByte,
    endByte,
    rawText
  };
  const legacy = legacyBySpan.get(legacyKey(candidate));
  return {
    fragmentId: legacy?.fragmentId ?? fragmentIdFor(corpusFile.shortLabel, startByte),
    corpusFileId: corpusFile.corpusFileId,
    headingPath: headingPath.filter((value) => typeof value === 'string'),
    startLine: first.lineNumber,
    endLine: last.lineNumber,
    startByte,
    endByte,
    blockType: legacy?.blockType ?? blockType,
    rawText,
    textHash: sha256(rawBytes),
    corpusFileContentHash: corpusFile.contentHash
  };
}

function intervalProblems(fragments) {
  const overlaps = [];
  const ordered = [...fragments].sort((a, b) => a.startByte - b.startByte || a.endByte - b.endByte);
  for (let i = 1; i < ordered.length; i++) {
    if (ordered[i].startByte < ordered[i - 1].endByte) {
      overlaps.push({
        firstFragmentId: ordered[i - 1].fragmentId,
        secondFragmentId: ordered[i].fragmentId,
        startByte: ordered[i].startByte,
        endByte: Math.min(ordered[i - 1].endByte, ordered[i].endByte)
      });
    }
  }
  return overlaps;
}

function fillStructuralSeparators(fileByteLength, fragments, exclusions, uncoveredZones) {
  const occupied = [
    ...fragments.map((fragment) => ({ startByte: fragment.startByte, endByte: fragment.endByte })),
    ...exclusions,
    ...uncoveredZones
  ]
    .filter((zone) => zone.endByte > zone.startByte)
    .sort((a, b) => a.startByte - b.startByte || a.endByte - b.endByte);
  let cursor = 0;
  for (const zone of occupied) {
    if (zone.startByte > cursor) {
      exclusions.push({
        reason: 'structural_separator',
        startLine: null,
        endLine: null,
        startByte: cursor,
        endByte: zone.startByte,
        byteLength: zone.startByte - cursor
      });
    }
    cursor = Math.max(cursor, zone.endByte);
  }
  if (cursor < fileByteLength) {
    exclusions.push({
      reason: 'structural_separator',
      startLine: null,
      endLine: null,
      startByte: cursor,
      endByte: fileByteLength,
      byteLength: fileByteLength - cursor
    });
  }
  exclusions.sort((a, b) => a.startByte - b.startByte || a.endByte - b.endByte);
}

function coverageStats(bytes, fragments, exclusions, uncoveredZones, overlaps, diagnostics) {
  const coveredFragmentBytes = fragments.reduce((sum, fragment) => sum + fragment.endByte - fragment.startByte, 0);
  const uncoveredBytes = uncoveredZones.reduce((sum, zone) => sum + zone.endByte - zone.startByte, 0);
  const eligibleProseBytes = coveredFragmentBytes + uncoveredBytes;
  const intentionallyExcludedBytes = exclusions.reduce(
    (sum, zone) => sum + Math.max(0, zone.endByte - zone.startByte),
    0
  );
  return {
    fileBytes: bytes.length,
    fragments: fragments.length,
    eligibleProseBytes,
    coveredFragmentBytes,
    coverageRatio: eligibleProseBytes === 0 ? 1 : coveredFragmentBytes / eligibleProseBytes,
    coveragePercent:
      eligibleProseBytes === 0 ? 100 : Number(((coveredFragmentBytes / eligibleProseBytes) * 100).toFixed(6)),
    intentionallyExcludedBytes,
    uncoveredBytes,
    holes: uncoveredZones.length,
    overlaps: overlaps.length,
    diagnostics: diagnostics.length
  };
}

export function fragmentProseDocument({ corpusFile, bytes, legacyFragments = [] }) {
  if (!Buffer.isBuffer(bytes)) throw new TypeError('bytes doit être un Buffer');
  if (sha256(bytes) !== corpusFile.contentHash) {
    throw new Error(`Hash de corpus inattendu pour ${corpusFile.corpusFileId}`);
  }

  const lines = lineRecords(bytes);
  const tables = tableRanges(lines);
  const legacyBySpan = new Map(
    legacyFragments
      .filter((fragment) => fragment.corpusFileId === corpusFile.corpusFileId)
      .map((fragment) => [legacyKey(fragment), fragment])
  );
  const fragments = [];
  const exclusions = [];
  const uncoveredZones = [];
  const diagnostics = [];
  let headingPath = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const heading = headingMatch(line.text);
    if (heading) {
      headingPath = updateHeadingPath(headingPath, heading);
      exclusions.push(zoneFromLines(lines, i, i + 1, 'excluded_heading', bytes));
      i += 1;
      continue;
    }
    if (isBlank(line.text)) {
      let end = i + 1;
      while (end < lines.length && isBlank(lines[end].text)) end += 1;
      exclusions.push(zoneFromLines(lines, i, end, 'excluded_blank_lines', bytes));
      i = end;
      continue;
    }
    if (isThematicBreak(line.text)) {
      exclusions.push(zoneFromLines(lines, i, i + 1, 'excluded_thematic_break', bytes));
      i += 1;
      continue;
    }
    const fence = isFence(line.text);
    if (fence) {
      const marker = fence[1][0];
      const minimum = fence[1].length;
      let end = i + 1;
      while (end < lines.length && !new RegExp(`^\\s{0,3}${marker}{${minimum},}\\s*$`).test(lines[end].text)) {
        end += 1;
      }
      if (end < lines.length) end += 1;
      else {
        diagnostics.push({
          severity: 'warning',
          code: 'unclosed_code_fence',
          corpusFileId: corpusFile.corpusFileId,
          startLine: line.lineNumber,
          message: 'Bloc de code non fermé ; la zone reste exclue du périmètre prose.'
        });
      }
      exclusions.push(zoneFromLines(lines, i, end, 'excluded_code_block', bytes));
      i = end;
      continue;
    }
    const table = tables.get(i);
    if (table) {
      if (i === table.start) {
        const reason = inBibliographicRegistry(headingPath)
          ? 'excluded_bibliographic_registry'
          : corpusFile.shortLabel === 'F2'
            ? 'excluded_table_e1'
            : 'excluded_table_out_of_scope';
        exclusions.push(zoneFromLines(lines, table.start, table.end, reason, bytes));
      }
      i = table.end;
      continue;
    }
    if (isTableRow(line.text)) {
      const zone = zoneFromLines(lines, i, i + 1, 'unrecognized_table_like_line', bytes);
      uncoveredZones.push(zone);
      diagnostics.push({
        severity: 'error',
        code: 'unrecognized_table_like_line',
        corpusFileId: corpusFile.corpusFileId,
        startLine: line.lineNumber,
        startByte: line.startByte,
        message: 'Ligne commençant par | hors tableau Markdown certain ; aucun découpage heuristique.'
      });
      i += 1;
      continue;
    }

    let end = i + 1;
    let blockType = 'paragraph';
    if (isListItem(line.text)) {
      blockType = 'list_item';
      while (
        end < lines.length &&
        !isBlank(lines[end].text) &&
        !headingMatch(lines[end].text) &&
        !isThematicBreak(lines[end].text) &&
        !isFence(lines[end].text) &&
        !tables.has(end) &&
        !isTableRow(lines[end].text) &&
        !isListItem(lines[end].text) &&
        !isBlockquote(lines[end].text)
      ) {
        end += 1;
      }
    } else if (isBlockquote(line.text)) {
      blockType = 'callout';
      while (end < lines.length && isBlockquote(lines[end].text)) end += 1;
    } else {
      while (
        end < lines.length &&
        !isBlank(lines[end].text) &&
        !headingMatch(lines[end].text) &&
        !isThematicBreak(lines[end].text) &&
        !isFence(lines[end].text) &&
        !tables.has(end) &&
        !isTableRow(lines[end].text) &&
        !isListItem(lines[end].text) &&
        !isBlockquote(lines[end].text)
      ) {
        end += 1;
      }
    }

    if (inBibliographicRegistry(headingPath)) {
      exclusions.push(zoneFromLines(lines, i, end, 'excluded_bibliographic_registry', bytes));
    } else {
      fragments.push(
        createFragment({
          bytes,
          lines,
          start: i,
          end,
          corpusFile,
          headingPath,
          blockType,
          legacyBySpan
        })
      );
    }
    i = end;
  }

  const overlaps = intervalProblems(fragments);
  fillStructuralSeparators(bytes.length, fragments, exclusions, uncoveredZones);
  const stats = coverageStats(bytes, fragments, exclusions, uncoveredZones, overlaps, diagnostics);
  const fragmentOrder = fragments.map((fragment, index) => ({
    fragmentId: fragment.fragmentId,
    orderInDocument: index + 1
  }));
  return { fragments, fragmentOrder, exclusions, uncoveredZones, overlaps, diagnostics, stats };
}
