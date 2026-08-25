#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { projectClaimContext } from '../fittrack-kb-contract/tools/e5-retrieval/context-projection.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const corpusPath = resolve(root, 'fittrack-kb-contract/candidates/e5-corpus.json');
const fragmentsPath = resolve(root, 'fittrack-kb-contract/candidates/e5-prose-fragments.json');
const outputPath = resolve(root, 'src/features/knowledge/evidence-index.json');

const corpusSource = readFileSync(corpusPath, 'utf8');
const fragmentsSource = readFileSync(fragmentsPath, 'utf8');
const corpus = JSON.parse(corpusSource);
const fragments = JSON.parse(fragmentsSource);
const fragmentById = new Map(fragments.fragments.map((fragment) => [fragment.fragmentId, fragment]));

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

const projectedClaims = corpus.claims.map((claim) => {
  const fragment = fragmentById.get(claim.fragmentId);
  if (!fragment) throw new Error(`Fragment absent : ${claim.fragmentId}`);
  const projection = projectClaimContext(claim, fragment);
  const supportSpans = claim.supportSpans ?? [];
  const supportStartByte = Math.min(
    ...supportSpans.map((span) => span.absoluteStartByte ?? span.relativeStartByte),
  );
  const supportEndByte = Math.max(
    ...supportSpans.map((span) => span.absoluteEndByte ?? span.relativeEndByte),
  );
  const identity = [claim.fragmentId, supportStartByte, supportEndByte, projection.rawQuote].join('\n');

  return {
    claimId: `claim.${sha256(identity).slice(0, 16)}`,
    fragmentId: claim.fragmentId,
    sourceTitle: (fragment.headingPath ?? []).join(' › ') || fragment.corpusFileId,
    rawQuote: projection.rawQuote,
    rawContext: projection.rawContext,
    displayContext: projection.displayContext,
    retrievalText: [
      (fragment.headingPath ?? []).join(' '),
      projection.displayContext,
      projection.rawQuote,
    ]
      .filter(Boolean)
      .join(' '),
    epistemicStatus: claim.epistemicStatus ?? null,
    knowledgeType: claim.knowledgeType ?? null,
    citationCount: (claim.citationOccurrenceRefs ?? []).length,
    sourceHash: fragment.textHash,
    supportStartByte,
    supportEndByte,
  };
});
// Two source rows are exact duplicates. A proof navigator must not present them
// as independent corroboration, so identity-based deduplication happens before
// the artifact reaches retrieval or UI.
const claims = [...new Map(projectedClaims.map((claim) => [claim.claimId, claim])).values()];

const document = {
  schemaVersion: '1.0.0-evidence-index',
  corpusHash: `sha256:${sha256(corpusSource)}`,
  fragmentsHash: `sha256:${sha256(fragmentsSource)}`,
  calibration: {
    status: 'UNCALIBRATED',
    profileId: null,
    note: 'Aucun seuil de réponse sûre ne peut être activé avant validation sur CAL et TEST.',
  },
  sourceClaimCount: corpus.claims.length,
  duplicateClaimCount: corpus.claims.length - claims.length,
  claims,
};

writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
console.log(
  `Index de preuves : ${claims.length}/${corpus.claims.length} affirmations uniques -> ${outputPath}`,
);
