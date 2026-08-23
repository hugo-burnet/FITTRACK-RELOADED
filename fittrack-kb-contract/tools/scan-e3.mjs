// E3 — occurrences de citation, pas des Sources.
// Relit le markdown déjà présent dans les cellules E1. N'attribue pas.

import { createHash } from 'node:crypto';
import { locateMarkdownLinks } from './parse-markdown-table.mjs';

export const EXTRACTOR_VERSION = '0.1.0-e3';
export const EXTRACTED_AT = '2026-08-23T00:00:00.000Z';

const sha256 = (value) =>
  'sha256:' + createHash('sha256').update(value, 'utf8').digest('hex');

function classifyUrl(url) {
  if (!url) return { linkKind: 'empty', resolutionStatus: 'unresolved' };
  if (url.startsWith('#')) return { linkKind: 'internal', resolutionStatus: 'unresolved' };
  if (/^https?:\/\//i.test(url)) return { linkKind: 'external', resolutionStatus: 'partial' };
  return { linkKind: 'other', resolutionStatus: 'unresolved' };
}

function findMarkdownInRow(rawRow, markdown, fromIndex) {
  const idx = rawRow.indexOf(markdown, fromIndex);
  return idx;
}

export function scanE3Candidate(candidate, { e2ByClaimId } = {}) {
  if (!candidate || typeof candidate !== 'object' || !candidate.payload || !candidate.candidateId) {
    return {
      occurrences: [],
      diagnostics: [
        {
          type: 'invalid_e1_candidate',
          schema: 'extraction-candidate.schema.json',
          value: candidate,
          message: 'Candidat E1 illisible : candidateId/payload absents.'
        }
      ]
    };
  }

  const diagnostics = [];
  const occurrences = [];
  const rawRow = candidate.payload.rawRow ?? '';
  const rowStart = candidate.verbatimSpan?.startByte ?? 0;
  let searchFrom = 0;

  const cells = Array.isArray(candidate.payload.cells) ? candidate.payload.cells : [];
  for (const cell of cells) {
    const located = locateMarkdownLinks(cell.raw ?? '');
    located.forEach((link, occurrenceIndexInCell) => {
      const idx = findMarkdownInRow(rawRow, link.markdown, searchFrom);
      let startByte = null;
      let endByte = null;
      if (idx < 0) {
        diagnostics.push({
          type: 'offset_unresolved',
          candidateId: candidate.candidateId,
          corpusFileRef: candidate.corpusFileRef,
          startLine: candidate.payload.startLine,
          rawValue: link.markdown,
          message: 'Le markdown du lien est introuvable dans rawRow.'
        });
      } else {
        startByte = rowStart + Buffer.byteLength(rawRow.slice(0, idx), 'utf8');
        endByte = startByte + Buffer.byteLength(link.markdown, 'utf8');
        searchFrom = idx + link.markdown.length;
      }

      const kind = classifyUrl(link.url);
      if (kind.linkKind === 'internal') {
        diagnostics.push({
          type: 'internal_markdown_link',
          candidateId: candidate.candidateId,
          corpusFileRef: candidate.corpusFileRef,
          startLine: candidate.payload.startLine,
          rawValue: link.markdown,
          schema: 'citation-occurrence'
        });
      } else if (kind.linkKind === 'other') {
        diagnostics.push({
          type: 'unsupported_url_scheme',
          candidateId: candidate.candidateId,
          rawValue: link.url,
          schema: 'citation-occurrence'
        });
      }

      const idSeed = [
        candidate.corpusFileRef,
        candidate.fragmentRef,
        String(startByte ?? `${cell.header}:${link.start}`),
        link.label,
        link.url
      ].join('\n');

      const payload = {
        rawLabel: link.label,
        rawUrl: link.url,
        markdown: link.markdown,
        fragmentRef: candidate.fragmentRef,
        corpusFileRef: candidate.corpusFileRef,
        parentCandidateId: candidate.candidateId,
        cellHeader: cell.header,
        occurrenceIndexInCell,
        startInCell: link.start,
        endInCell: link.end,
        startByte,
        endByte,
        linkKind: kind.linkKind,
        resolvesToSourceRef: null,
        resolutionStatus: kind.resolutionStatus
      };
      if (candidate.targetKind === 'claim') {
        payload.claimCandidateId = candidate.candidateId;
        const assessId = e2ByClaimId?.get(candidate.candidateId);
        if (assessId) payload.assessmentCandidateId = assessId;
      }

      occurrences.push({
        candidateId: `cand.e3.${sha256(idSeed).slice(7, 23)}`,
        targetKind: 'citation-occurrence',
        fragmentRef: candidate.fragmentRef,
        corpusFileRef: candidate.corpusFileRef,
        extraction: {
          method: 'deterministic_link_scan',
          runId: candidate.extraction?.runId ?? 'run.e3',
          extractedAt: EXTRACTED_AT,
          extractorVersion: EXTRACTOR_VERSION
        },
        payload,
        verbatimSpan:
          startByte != null
            ? { text: link.markdown, startByte, endByte }
            : candidate.verbatimSpan,
        reviewState: 'pending_human_review'
      });
    });
  }

  return { occurrences, diagnostics };
}

export function scanE3Document(e1Doc, { e2Doc } = {}) {
  const e2ByClaimId = new Map();
  for (const c of e2Doc?.candidates ?? []) {
    const assessId = c.payload?.e2?.assessmentCandidateId;
    if (c.candidateId && assessId) e2ByClaimId.set(c.candidateId, assessId);
  }
  const occurrences = [];
  const diagnostics = [];
  for (const candidate of e1Doc.candidates ?? []) {
    const out = scanE3Candidate(candidate, { e2ByClaimId });
    occurrences.push(...out.occurrences);
    diagnostics.push(...out.diagnostics);
  }
  return { occurrences, diagnostics };
}

export function e3Stats({ occurrences, diagnostics, e1Count }) {
  const urls = occurrences.map((o) => o.payload.rawUrl).filter(Boolean);
  const labels = occurrences.map((o) => o.payload.rawLabel);
  const urlCounts = new Map();
  for (const u of urls) urlCounts.set(u, (urlCounts.get(u) ?? 0) + 1);
  return {
    e1CandidatesRead: e1Count ?? 0,
    markdownLinksDetected: occurrences.length,
    occurrencesCreated: occurrences.length,
    linkedToClaims: occurrences.filter((o) => o.payload.claimCandidateId).length,
    onNonClaims: occurrences.filter((o) => !o.payload.claimCandidateId).length,
    internalLinks: occurrences.filter((o) => o.payload.linkKind === 'internal').length,
    otherLinks: occurrences.filter((o) => o.payload.linkKind === 'other').length,
    distinctUrls: new Set(urls).size,
    distinctLabels: new Set(labels).size,
    repeatedUrls: [...urlCounts.values()].filter((n) => n > 1).length,
    diagnostics: diagnostics.length
  };
}
