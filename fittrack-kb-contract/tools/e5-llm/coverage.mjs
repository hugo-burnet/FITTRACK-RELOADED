const LIST_ITEM_MARKER = /^[ \t]*(?:[-*+]|\d+[.)])(?:[ \t]+|$)/u;
const CLOSING_PUNCTUATION = new Set(['"', "'", '»', '”', '’', ')', ']', '}']);
const SENTENCE_BOUNDARIES = new Set(['.', '!', '?', '…']);

function isWhitespace(character) {
  return /\s/u.test(character);
}

function trimBoundaryWhitespace(text, start, end) {
  let trimmedStart = start;
  let trimmedEnd = end;
  while (trimmedStart < trimmedEnd && isWhitespace(text[trimmedStart])) trimmedStart += 1;
  while (trimmedEnd > trimmedStart && isWhitespace(text[trimmedEnd - 1])) trimmedEnd -= 1;
  return { start: trimmedStart, end: trimmedEnd };
}

function linesOf(text) {
  const lines = [];
  let start = 0;
  while (start < text.length) {
    const newline = text.indexOf('\n', start);
    const fullEnd = newline === -1 ? text.length : newline + 1;
    const contentEnd = newline !== -1 && text[newline - 1] === '\r' ? newline - 1 : newline === -1 ? text.length : newline;
    const content = text.slice(start, contentEnd);
    lines.push({
      start,
      contentEnd,
      fullEnd,
      isBlank: /^\s*$/u.test(content),
      isListItem: LIST_ITEM_MARKER.test(content)
    });
    start = fullEnd;
  }
  return lines;
}

function emitUnit(units, rawText, kind, start, end) {
  const trimmed = trimBoundaryWhitespace(rawText, start, end);
  if (trimmed.start === trimmed.end) return;
  units.push({
    unitIndex: units.length,
    kind,
    text: rawText.slice(trimmed.start, trimmed.end),
    relativeStartByte: Buffer.byteLength(rawText.slice(0, trimmed.start), 'utf8'),
    relativeEndByte: Buffer.byteLength(rawText.slice(0, trimmed.end), 'utf8')
  });
}

function emitSentences(units, rawText, start, end) {
  let sentenceStart = start;
  let cursor = start;
  while (cursor < end) {
    const character = rawText[cursor];
    cursor += 1;
    if (!SENTENCE_BOUNDARIES.has(character)) continue;
    while (cursor < end) {
      let closingStart = cursor;
      while (closingStart < end && isWhitespace(rawText[closingStart])) closingStart += 1;
      if (!CLOSING_PUNCTUATION.has(rawText[closingStart])) break;
      cursor = closingStart + 1;
    }
    emitUnit(units, rawText, 'SENTENCE', sentenceStart, cursor);
    sentenceStart = cursor;
  }
  emitUnit(units, rawText, 'SENTENCE', sentenceStart, end);
}

/**
 * Splits a fragment into deterministic coverage units without changing its text.
 */
export function buildCoverageUnits(fragment) {
  const rawText = fragment.rawText;
  const lines = linesOf(rawText);
  const units = [];
  let lineIndex = 0;

  while (lineIndex < lines.length) {
    const line = lines[lineIndex];
    if (line.isBlank) {
      lineIndex += 1;
      continue;
    }
    if (line.isListItem) {
      const start = line.start;
      let end = line.contentEnd;
      lineIndex += 1;
      while (lineIndex < lines.length && !lines[lineIndex].isBlank && !lines[lineIndex].isListItem) {
        end = lines[lineIndex].contentEnd;
        lineIndex += 1;
      }
      emitUnit(units, rawText, 'LIST_ITEM', start, end);
      continue;
    }

    const start = line.start;
    let end = line.contentEnd;
    lineIndex += 1;
    while (lineIndex < lines.length && !lines[lineIndex].isBlank && !lines[lineIndex].isListItem) {
      end = lines[lineIndex].contentEnd;
      lineIndex += 1;
    }
    emitSentences(units, rawText, start, end);
  }
  return units;
}

function diagnostic(code, detail) {
  return { code, ...detail };
}

/**
 * Checks that every coverage unit has one ledger decision and claim links agree
 * with CLAIM_CONTENT decisions.
 */
export function auditCoverageLedger({ coverageUnits, coverageLedger, claims }) {
  const diagnostics = [];
  const knownUnitIndexes = new Set(coverageUnits.map((unit) => unit.unitIndex));
  const ledgerByUnitIndex = new Map();
  const coveredUnitIndexes = [];

  for (const entry of coverageLedger) {
    const { unitIndex } = entry;
    if (!knownUnitIndexes.has(unitIndex)) {
      diagnostics.push(diagnostic('COVERAGE_UNIT_OUT_OF_RANGE', { unitIndex }));
      continue;
    }
    if (ledgerByUnitIndex.has(unitIndex)) {
      diagnostics.push(diagnostic('COVERAGE_DUPLICATE_UNIT', { unitIndex }));
      continue;
    }
    ledgerByUnitIndex.set(unitIndex, entry);
    coveredUnitIndexes.push(unitIndex);
  }

  const missingUnitIndexes = coverageUnits
    .map((unit) => unit.unitIndex)
    .filter((unitIndex) => !ledgerByUnitIndex.has(unitIndex));
  if (missingUnitIndexes.length > 0) {
    diagnostics.push(diagnostic('COVERAGE_INCOMPLETE', { missingUnitIndexes }));
  }

  const claimsByUnitIndex = new Map();
  for (const claim of claims) {
    const claimRef = claim.technicalClaimRef;
    for (const unitIndex of claim.coverageUnitIndexes ?? []) {
      const ledgerEntry = ledgerByUnitIndex.get(unitIndex);
      if (!knownUnitIndexes.has(unitIndex) || ledgerEntry?.decision !== 'CLAIM_CONTENT') {
        diagnostics.push(diagnostic('CLAIM_UNIT_REFERENCE_INVALID', { claimRef, unitIndex }));
        continue;
      }
      if (!claimsByUnitIndex.has(unitIndex)) claimsByUnitIndex.set(unitIndex, []);
      claimsByUnitIndex.get(unitIndex).push(claimRef);
    }
  }

  for (const [unitIndex, entry] of ledgerByUnitIndex) {
    if (entry.decision === 'CLAIM_CONTENT' && !claimsByUnitIndex.has(unitIndex)) {
      diagnostics.push(diagnostic('CLAIM_CONTENT_WITHOUT_CLAIM', { unitIndex }));
    }
  }

  return { diagnostics, coveredUnitIndexes };
}
