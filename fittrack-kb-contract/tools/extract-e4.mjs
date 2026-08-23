#!/usr/bin/env node
// E4 — parcours déterministe de F4. N'écrase pas E1/E2/E3.

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveCorpusFile } from './resolve-corpus.mjs';
import {
  CORPUS_FILE_ID,
  EXTRACTED_AT,
  EXTRACTOR_VERSION,
  e4Stats,
  scanE4FromText
} from './scan-e4.mjs';

function isCli() {
  const argv = (process.argv[1] ?? '').replaceAll('\\', '/');
  return argv.endsWith('extract-e4.mjs');
}

if (isCli()) {
  const here = dirname(fileURLToPath(import.meta.url));
  const root = join(here, '..');
  const repoRoot = join(root, '..');
  const config = JSON.parse(readFileSync(join(root, 'corpus/corpus-files.config.json'), 'utf8'));
  const f4 = config.files.find((f) => f.corpusFileId === CORPUS_FILE_ID);
  const hit = resolveCorpusFile(f4, { packageRoot: root, repoRoot, archiveRef: config.archiveRef });
  if (!hit.bytes) {
    console.error('F4 introuvable');
    process.exit(2);
  }
  const fragments = JSON.parse(readFileSync(join(root, 'fragments/fragments.json'), 'utf8')).fragments;
  const text = hit.bytes.toString('utf8');
  const scanned = scanE4FromText(text, { fragments });
  const runId = `run.e4.${createHash('sha256').update(EXTRACTOR_VERSION + sha256Buf(hit.bytes), 'utf8').digest('hex').slice(0, 12)}`;
  for (const c of scanned.candidates) c.extraction.runId = runId;
  const stats = e4Stats(scanned);

  writeFileSync(
    join(root, 'candidates/e4-paths.json'),
    JSON.stringify(
      {
        generatedBy: 'tools/extract-e4.mjs',
        extractorVersion: EXTRACTOR_VERSION,
        runId,
        extractedAt: EXTRACTED_AT,
        note: 'Chemins JSON de F4. Valeurs brutes du schema, pas des fiches cliniques ni des Sources curated.',
        candidates: scanned.candidates,
        schemaFieldPaths: scanned.schemaFieldPaths,
        stats
      },
      null,
      2
    ) + '\n'
  );
  writeFileSync(
    join(root, 'candidates/e4-diagnostics.json'),
    JSON.stringify(
      { generatedBy: 'tools/extract-e4.mjs', runId, diagnostics: scanned.diagnostics },
      null,
      2
    ) + '\n'
  );

  console.log(`chemins visités     : ${stats.pathsVisited}`);
  console.log(`candidates          : ${stats.candidatesProduced}`);
  console.log(`champs schema (98?) : ${stats.schemaFieldPaths}`);
  console.log(`conditionRecord*    : ${stats.conditionRecords}`);
  console.log(`redFlag*            : ${stats.redFlags}`);
  console.log(`zone*               : ${stats.zoneRules}`);
  console.log(`toleranceDimension  : ${stats.toleranceDimensions}`);
  console.log(`modification        : ${stats.modifications}`);
  console.log(`contraindication    : ${stats.contraindications}`);
  console.log(`source defs         : ${stats.sources}`);
  console.log(`expertPractice      : ${stats.expertPractice}`);
  console.log(`null explicites     : ${stats.explicitNulls}`);
  console.log(`diagnostics         : ${stats.diagnostics}`);
}

function sha256Buf(buf) {
  return createHash('sha256').update(buf).digest('hex');
}
