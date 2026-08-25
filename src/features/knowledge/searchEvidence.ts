import indexDocument from './evidence-index.json';

export type EpistemicStatus =
  | 'absence_of_evidence'
  | 'established'
  | 'established_direction'
  | 'mechanistic_only'
  | 'practice_only'
  | 'probable'
  | 'refuted'
  | 'uncertain';

export type EvidenceRecord = {
  claimId: string;
  fragmentId: string;
  sourceTitle: string;
  rawQuote: string;
  rawContext: string;
  displayContext: string;
  retrievalText: string;
  epistemicStatus: EpistemicStatus | null;
  knowledgeType: string | null;
  citationCount: number;
  sourceHash: string;
  supportStartByte: number;
  supportEndByte: number;
};

type EvidenceIndex = {
  calibration: { status: 'UNCALIBRATED'; profileId: null };
  claims: EvidenceRecord[];
};

export type EvidenceCandidate = EvidenceRecord & {
  matchedTerms: string[];
  score: number;
};

export type EvidenceSearchOutcome =
  | { kind: 'EMPTY_QUERY'; candidates: [] }
  | { kind: 'NO_LEXICAL_EVIDENCE'; candidates: [] }
  | { kind: 'EVIDENCE_CANDIDATES'; candidates: EvidenceCandidate[] };

const evidenceIndex = indexDocument as EvidenceIndex;

const STOP_WORDS = new Set([
  'ai',
  'au',
  'aux',
  'avec',
  'ce',
  'ces',
  'dans',
  'de',
  'des',
  'du',
  'elle',
  'en',
  'est',
  'et',
  'fait',
  'faire',
  'il',
  'je',
  'la',
  'le',
  'les',
  'mais',
  'moins',
  'ne',
  'on',
  'ou',
  'par',
  'pas',
  'plus',
  'pour',
  'que',
  'qui',
  'sans',
  'si',
  'sont',
  'sur',
  'tout',
  'tu',
  'un',
  'une',
  'vous',
]);

export function tokenizeEvidenceText(text: string): string[] {
  return text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/['’]/gu, ' ')
    .split(/[^a-z0-9]+/u)
    .filter((word) => word.length >= 2 && !STOP_WORDS.has(word));
}

const documents = evidenceIndex.claims.map((claim) => tokenizeEvidenceText(claim.retrievalText));
const documentFrequency = new Map<string, number>();
for (const tokens of documents) {
  for (const token of new Set(tokens)) {
    documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
  }
}
const averageLength = documents.reduce((sum, tokens) => sum + tokens.length, 0) / documents.length;

export function searchEvidence(query: string, limit = 4): EvidenceSearchOutcome {
  const terms = [...new Set(tokenizeEvidenceText(query))];
  if (terms.length === 0) return { kind: 'EMPTY_QUERY', candidates: [] };

  const candidates = documents
    .map((tokens, index) => {
      const frequencies = new Map<string, number>();
      for (const token of tokens) frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
      const matchedTerms = terms.filter((term) => frequencies.has(term));
      let score = 0;
      for (const term of matchedTerms) {
        const frequency = frequencies.get(term) ?? 0;
        const containingDocuments = documentFrequency.get(term) ?? 0;
        const inverseFrequency = Math.log(
          (documents.length - containingDocuments + 0.5) / (containingDocuments + 0.5) + 1,
        );
        score +=
          (inverseFrequency * frequency * 2.2) /
          (frequency + 1.2 * (0.25 + 0.75 * (tokens.length / averageLength)));
      }
      return { index, matchedTerms, score };
    })
    .filter((candidate) => candidate.score > 0)
    .sort(
      (left, right) =>
        right.matchedTerms.length - left.matchedTerms.length ||
        right.score - left.score ||
        left.index - right.index,
    );

  if (candidates.length === 0) return { kind: 'NO_LEXICAL_EVIDENCE', candidates: [] };

  const seenContexts = new Set<string>();
  const selected: EvidenceCandidate[] = [];
  for (const candidate of candidates) {
    const claim = evidenceIndex.claims[candidate.index];
    if (!claim || seenContexts.has(claim.displayContext)) continue;
    seenContexts.add(claim.displayContext);
    selected.push({ ...claim, matchedTerms: candidate.matchedTerms, score: candidate.score });
    if (selected.length === limit) break;
  }

  return { kind: 'EVIDENCE_CANDIDATES', candidates: selected };
}

export const evidenceIndexStatus = evidenceIndex.calibration.status;
