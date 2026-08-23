#!/usr/bin/env node
// E3 — scan déterministe des liens Markdown. N'écrase pas E1/E2.

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXTRACTED_AT, EXTRACTOR_VERSION, e3Stats, scanE3Document } from './scan-e3.mjs';

function isCli() {
  const argv = (process.argv[1] ?? '').replaceAll('\\', '/');
  return argv.endsWith('extract-e3.mjs');
}

if (isCli()) {
  const here = dirname(fileURLToPath(import.meta.url));
  const root = join(here, '..');
  const e1 = JSON.parse(readFileSync(join(root, 'candidates/e1-table-rows.json'), 'utf8'));
  let e2 = null;
  try {
    e2 = JSON.parse(readFileSync(join(root, 'candidates/e2-projections.json'), 'utf8'));
  } catch {
    e2 = null;
  }
  const { occurrences, diagnostics } = scanE3Document(e1, { e2Doc: e2 });
  const stats = e3Stats({
    occurrences,
    diagnostics,
    e1Count: e1.candidates?.length ?? 0
  });
  const runId = `run.e3.${createHash('sha256')
    .update((e1.runId ?? '') + EXTRACTOR_VERSION, 'utf8')
    .digest('hex')
    .slice(0, 12)}`;

  writeFileSync(
    join(root, 'candidates/e3-occurrences.json'),
    JSON.stringify(
      {
        generatedBy: 'tools/extract-e3.mjs',
        extractorVersion: EXTRACTOR_VERSION,
        runId,
        extractedAt: EXTRACTED_AT,
        e1RunId: e1.runId ?? null,
        note: 'Occurrences de citation. Pas des Sources. resolvesToSourceRef est null. E1/E2 ne sont pas modifies.',
        candidates: occurrences,
        stats
      },
      null,
      2
    ) + '\n'
  );
  writeFileSync(
    join(root, 'candidates/e3-diagnostics.json'),
    JSON.stringify({ generatedBy: 'tools/extract-e3.mjs', runId, diagnostics }, null, 2) + '\n'
  );

  console.log(`E1 lues              : ${stats.e1CandidatesRead}`);
  console.log(`liens Markdown       : ${stats.markdownLinksDetected}`);
  console.log(`occurrences          : ${stats.occurrencesCreated}`);
  console.log(`reliées à une claim  : ${stats.linkedToClaims}`);
  console.log(`sur non-claims       : ${stats.onNonClaims}`);
  console.log(`liens internes       : ${stats.internalLinks}`);
  console.log(`URLs distinctes      : ${stats.distinctUrls}`);
  console.log(`labels distincts     : ${stats.distinctLabels}`);
  console.log(`URLs répétées        : ${stats.repeatedUrls}`);
  console.log(`diagnostics          : ${stats.diagnostics}`);
}
