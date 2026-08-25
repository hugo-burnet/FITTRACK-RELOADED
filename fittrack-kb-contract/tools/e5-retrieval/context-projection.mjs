/**
 * Turn byte-anchored claim spans into three deliberately separate projections:
 *
 * - `rawQuote`: the immutable claim text;
 * - `rawContext`: a verbatim slice of the source fragment;
 * - `displayContext`: the same slice with Markdown presentation removed.
 *
 * Retrieval may use `retrievalText`, but UI and evaluation must never mistake it
 * for the source itself. Keeping these values separate makes that invariant
 * executable instead of relying on a comment in each consumer.
 */

const ABBREVIATIONS = new Set([
  'art',
  'cf',
  'dr',
  'env',
  'etc',
  'ex',
  'fig',
  'n',
  'no',
  'p',
  'pp',
  'pr',
  'ref',
  'vol',
]);

const normalizeSpaces = (value) => value.replace(/\s+/gu, ' ').trim();

function charactersWithByteOffsets(text) {
  const encoder = new TextEncoder();
  const characters = [];
  let byte = 0;

  for (const character of text) {
    const length = encoder.encode(character).length;
    characters.push({ character, startByte: byte, endByte: byte + length });
    byte += length;
  }
  return { characters, byteLength: byte };
}

function wordBefore(characters, index) {
  let word = '';
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const character = characters[cursor]?.character ?? '';
    if (!/[\p{L}]/u.test(character)) break;
    word = character + word;
  }
  return word.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
}

function isSentenceEnd(characters, index) {
  const current = characters[index]?.character;
  if (current === '\n') return true;
  if (current !== '.' && current !== '!' && current !== '?') return false;

  const next = characters[index + 1]?.character;
  // Dots in URLs and decimal values are not followed by whitespace. This is
  // the condition the previous byte-by-byte implementation was missing.
  if (next !== undefined && !/\s/u.test(next)) return false;
  if (current === '.' && ABBREVIATIONS.has(wordBefore(characters, index))) return false;
  return true;
}

function firstCharacterEndingAfter(characters, byte) {
  const index = characters.findIndex((item) => item.endByte > byte);
  return index === -1 ? characters.length : index;
}

function firstCharacterStartingAtOrAfter(characters, byte) {
  const index = characters.findIndex((item) => item.startByte >= byte);
  return index === -1 ? characters.length : index;
}

/** Remove Markdown presentation without fabricating replacement prose. */
export function markdownToDisplayText(markdown) {
  return normalizeSpaces(
    markdown
      .replace(/!\[([^\]]*)\]\([^\s)]+(?:\s+"[^"]*")?\)/gu, '$1')
      .replace(/\[([^\]]+)\]\([^\s)]+(?:\s+"[^"]*")?\)/gu, '$1')
      .replace(/<https?:\/\/[^>]+>/gu, '')
      .replace(/https?:\/\/\S+/gu, '')
      .replace(/(?:\*\*|__|~~|`)/gu, '')
      .replace(/^\s{0,3}(?:#{1,6}|[-+*>])\s+/gmu, ''),
  );
}

export function projectClaimContext(claim, fragment) {
  const rawQuote = normalizeSpaces(claim.rawStatement ?? '');
  const spans = (claim.supportSpans ?? [])
    .filter(
      (span) =>
        Number.isInteger(span.relativeStartByte) &&
        Number.isInteger(span.relativeEndByte) &&
        span.relativeStartByte >= 0 &&
        span.relativeEndByte >= span.relativeStartByte,
    )
    .sort((left, right) => left.relativeStartByte - right.relativeStartByte);

  if (!fragment?.rawText || spans.length === 0) {
    return {
      rawQuote,
      rawContext: rawQuote,
      displayContext: markdownToDisplayText(rawQuote),
      retrievalText: markdownToDisplayText(rawQuote),
      contextStartByte: null,
      contextEndByte: null,
      supportStartByte: null,
      supportEndByte: null,
    };
  }

  const { characters, byteLength } = charactersWithByteOffsets(fragment.rawText);
  const supportStartByte = Math.min(spans[0].relativeStartByte, byteLength);
  const lastSpan = spans[spans.length - 1];
  const supportEndByte = Math.min(lastSpan.relativeEndByte, byteLength);
  const supportStartIndex = firstCharacterEndingAfter(characters, supportStartByte);
  const supportEndIndex = firstCharacterStartingAtOrAfter(characters, supportEndByte);

  let startIndex = 0;
  for (let index = supportStartIndex - 1; index >= 0; index -= 1) {
    if (isSentenceEnd(characters, index)) {
      startIndex = index + 1;
      break;
    }
  }
  while (/\s/u.test(characters[startIndex]?.character ?? '')) startIndex += 1;

  let endIndex = characters.length;
  for (let index = supportEndIndex; index < characters.length; index += 1) {
    if (isSentenceEnd(characters, index)) {
      endIndex = characters[index]?.character === '\n' ? index : index + 1;
      break;
    }
  }
  while (endIndex > startIndex && /\s/u.test(characters[endIndex - 1]?.character ?? '')) {
    endIndex -= 1;
  }

  const contextStartByte = characters[startIndex]?.startByte ?? byteLength;
  const contextEndByte = characters[endIndex - 1]?.endByte ?? contextStartByte;
  const rawContext = new TextDecoder().decode(
    new TextEncoder().encode(fragment.rawText).slice(contextStartByte, contextEndByte),
  );
  const displayContext = markdownToDisplayText(rawContext);

  return {
    rawQuote,
    rawContext,
    displayContext,
    retrievalText: displayContext,
    contextStartByte,
    contextEndByte,
    supportStartByte,
    supportEndByte,
  };
}
