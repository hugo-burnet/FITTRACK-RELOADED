// E5-P0b — scan déterministe des liens Markdown dans les fragments de prose.
// Une occurrence reste un ExtractionCandidate de type citation-occurrence ;
// aucune Source ni métadonnée bibliographique n'est créée ou inférée.

import { createHash } from 'node:crypto';
import { locateMarkdownLinks } from './parse-markdown-table.mjs';
import { E5_P0_EXTRACTED_AT, E5_P0_EXTRACTOR_VERSION } from './fragment-e5-prose.mjs';

function digest(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function classifyUrl(url) {
  if (!url) return { linkKind: 'empty', resolutionStatus: 'unresolved' };
  if (/^(?:#|\.\.?\/|\/)/.test(url)) return { linkKind: 'internal', resolutionStatus: 'unresolved' };
  if (/^https?:\/\//i.test(url)) return { linkKind: 'external', resolutionStatus: 'partial' };
  return { linkKind: 'other', resolutionStatus: 'unresolved' };
}

function handleFor(fragment, shortLabel, order) {
  const suffix = fragment.fragmentId.split('.').at(-1);
  return `cit.${shortLabel.toLowerCase()}.${suffix}.${String(order).padStart(2, '0')}`;
}

export function scanProseFragment(fragment, { fileBytes, shortLabel, runId = 'run.e5-p0.test' }) {
  const diagnostics = [];
  const occurrences = [];
  if (!fragment || !Buffer.isBuffer(fileBytes)) {
    return {
      occurrences,
      diagnostics: [
        {
          severity: 'error',
          code: 'invalid_fragment_input',
          fragmentId: fragment?.fragmentId ?? null,
          message: 'Fragment ou octets du fichier absents.'
        }
      ]
    };
  }

  const reread = fileBytes.subarray(fragment.startByte, fragment.endByte).toString('utf8');
  if (reread !== fragment.rawText) {
    return {
      occurrences,
      diagnostics: [
        {
          severity: 'error',
          code: 'fragment_reread_mismatch',
          fragmentId: fragment.fragmentId,
          corpusFileId: fragment.corpusFileId,
          startByte: fragment.startByte,
          endByte: fragment.endByte,
          message: 'rawText ne correspond pas aux octets du fichier autoritaire.'
        }
      ]
    };
  }

  const links = locateMarkdownLinks(fragment.rawText);
  links.forEach((link, index) => {
    const order = index + 1;
    const relativeStartByte = Buffer.byteLength(fragment.rawText.slice(0, link.start), 'utf8');
    const relativeEndByte = relativeStartByte + Buffer.byteLength(link.markdown, 'utf8');
    const startByte = fragment.startByte + relativeStartByte;
    const endByte = fragment.startByte + relativeEndByte;
    const exact = fileBytes.subarray(startByte, endByte).toString('utf8');
    if (exact !== link.markdown) {
      diagnostics.push({
        severity: 'error',
        code: 'citation_offset_reread_mismatch',
        fragmentId: fragment.fragmentId,
        corpusFileId: fragment.corpusFileId,
        occurrenceOrder: order,
        startByte,
        endByte,
        rawValue: link.markdown,
        message: 'Les offsets calculés ne relisent pas le Markdown exact de la citation.'
      });
      return;
    }

    const kind = classifyUrl(link.url);
    if (kind.linkKind === 'internal') {
      diagnostics.push({
        severity: 'info',
        code: 'internal_markdown_link',
        fragmentId: fragment.fragmentId,
        corpusFileId: fragment.corpusFileId,
        occurrenceOrder: order,
        rawValue: link.markdown,
        message: 'Renvoi interne conservé comme occurrence non résolue, jamais comme Source.'
      });
    } else if (kind.linkKind === 'other' || kind.linkKind === 'empty') {
      diagnostics.push({
        severity: 'warning',
        code: 'unsupported_url_scheme',
        fragmentId: fragment.fragmentId,
        corpusFileId: fragment.corpusFileId,
        occurrenceOrder: order,
        rawValue: link.url,
        message: 'URL non HTTP(S) conservée sans résolution ni attribution.'
      });
    }

    const candidateId = `cand.e5-citation.${digest(
      [
        fragment.corpusFileContentHash,
        fragment.fragmentId,
        startByte,
        endByte,
        'citation-occurrence',
        link.label,
        link.url
      ].join('\n')
    ).slice(0, 16)}`;
    occurrences.push({
      candidateId,
      targetKind: 'citation-occurrence',
      fragmentRef: fragment.fragmentId,
      corpusFileRef: fragment.corpusFileId,
      extraction: {
        method: 'deterministic_link_scan',
        runId,
        extractedAt: E5_P0_EXTRACTED_AT,
        extractorVersion: E5_P0_EXTRACTOR_VERSION
      },
      payload: {
        handle: handleFor(fragment, shortLabel, order),
        rawLabel: link.label,
        rawUrl: link.url,
        markdown: link.markdown,
        fragmentRef: fragment.fragmentId,
        corpusFileRef: fragment.corpusFileId,
        occurrenceOrder: order,
        relativeStartByte,
        relativeEndByte,
        startByte,
        endByte,
        linkKind: kind.linkKind,
        bibliographicClassification: 'unclassified',
        resolvesToSourceRef: null,
        resolutionStatus: kind.resolutionStatus,
        provenance: {
          corpusFileContentHash: fragment.corpusFileContentHash,
          fragmentTextHash: fragment.textHash
        }
      },
      verbatimSpan: { text: link.markdown, startByte, endByte },
      reviewState: 'pending_human_review'
    });
  });

  return { occurrences, diagnostics };
}

export function scanProseFragments(fragments, filesById, { runId = 'run.e5-p0.test' } = {}) {
  const occurrences = [];
  const diagnostics = [];
  for (const fragment of fragments) {
    const file = filesById.get(fragment.corpusFileId);
    const out = scanProseFragment(fragment, {
      fileBytes: file?.bytes,
      shortLabel: file?.shortLabel ?? 'e5',
      runId
    });
    occurrences.push(...out.occurrences);
    diagnostics.push(...out.diagnostics);
  }
  return { occurrences, diagnostics };
}

export function proseCitationStats(occurrences, diagnostics = []) {
  const urls = occurrences.map((occurrence) => occurrence.payload.rawUrl).filter(Boolean);
  const urlCounts = new Map();
  for (const url of urls) urlCounts.set(url, (urlCounts.get(url) ?? 0) + 1);
  return {
    occurrences: occurrences.length,
    distinctUrls: new Set(urls).size,
    duplicateUrlOccurrences: [...urlCounts.values()].reduce((sum, count) => sum + Math.max(0, count - 1), 0),
    repeatedDistinctUrls: [...urlCounts.values()].filter((count) => count > 1).length,
    internalLinks: occurrences.filter((occurrence) => occurrence.payload.linkKind === 'internal').length,
    unclassifiedLinks: occurrences.filter((occurrence) => occurrence.payload.linkKind !== 'internal').length,
    bibliographicAttributions: 0,
    resolvedSources: occurrences.filter((occurrence) => occurrence.payload.resolvesToSourceRef != null).length,
    diagnostics: diagnostics.length
  };
}
