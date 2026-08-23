#!/usr/bin/env node
// E2 — projette les cellules typées des candidates E1. N'écrase pas E1.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { EXTRACTED_AT, EXTRACTOR_VERSION, projectE2Document } from './project-e2.mjs';
import { E2_MAPPING_VERSION } from './e2-mappings.mjs';

function isCli() {
  const argv = (process.argv[1] ?? '').replaceAll('\\', '/');
  return argv.endsWith('extract-e2.mjs');
}

function sha256(value) {
  return 'sha256:' + createHash('sha256').update(value, 'utf8').digest('hex');
}

export function e2Stats({ claims, assessments, skipped, diagnostics }) {
  const confSimple = claims.filter((c) => c.payload.e2.confidence.simple).length;
  const confComposite = claims.filter((c) => c.payload.e2.confidence.byAspect.length > 0).length;
  const confRange = claims.filter((c) => c.payload.e2.confidence.range).length;
  const confUnresolved = claims.filter((c) => c.payload.e2.confidence.unresolved.length > 0).length;
  const limits = claims.reduce((n, c) => n + c.payload.e2.limitations.items.length, 0);
  const cannot = claims.reduce((n, c) => n + c.payload.e2.cannotConclude.items.length, 0);
  const populations = claims.filter((c) => c.payload.e2.population.rawDescription).length;
  const evidenceMapped = claims.reduce((n, c) => n + c.payload.e2.evidenceTypes.mapped.length, 0);
  const evidenceUnresolved = claims.reduce((n, c) => n + c.payload.e2.evidenceTypes.unresolved.length, 0);
  return {
    e1CandidatesRead: claims.length + skipped.length,
    claimsProjected: claims.length,
    assessmentsDrafted: assessments.length,
    skipped: skipped.length,
    confidenceSimple: confSimple,
    confidenceComposite: confComposite,
    confidenceRange: confRange,
    confidenceUnresolvedCells: confUnresolved,
    limitationItems: limits,
    cannotConcludeItems: cannot,
    populationsProjected: populations,
    evidenceTypesMapped: evidenceMapped,
    evidenceTypesUnresolved: evidenceUnresolved,
    diagnostics: diagnostics.length
  };
}

if (isCli()) {
  const here = dirname(fileURLToPath(import.meta.url));
  const root = join(here, '..');
  const e1Path = join(root, 'candidates/e1-table-rows.json');
  const e1 = JSON.parse(readFileSync(e1Path, 'utf8'));
  const projected = projectE2Document(e1);
  const stats = e2Stats(projected);
  const runId = `run.e2.${sha256((e1.runId ?? '') + E2_MAPPING_VERSION).slice(7, 19)}`;

  writeFileSync(
    join(root, 'candidates/e2-projections.json'),
    JSON.stringify(
      {
        generatedBy: 'tools/extract-e2.mjs',
        extractorVersion: EXTRACTOR_VERSION,
        mappingVersion: E2_MAPPING_VERSION,
        runId,
        extractedAt: EXTRACTED_AT,
        e1RunId: e1.runId ?? null,
        note: 'Projections E2. Les champs E1 (rawStatement, cells, verbatimSpan) sont copies, jamais reformules. Pas de curated/.',
        candidates: [...projected.claims, ...projected.assessments],
        skipped: projected.skipped,
        stats
      },
      null,
      2
    ) + '\n'
  );
  writeFileSync(
    join(root, 'candidates/e2-diagnostics.json'),
    JSON.stringify(
      {
        generatedBy: 'tools/extract-e2.mjs',
        runId,
        diagnostics: projected.diagnostics
      },
      null,
      2
    ) + '\n'
  );

  console.log(`E1 lues          : ${stats.e1CandidatesRead}`);
  console.log(`claims projetées : ${stats.claimsProjected}`);
  console.log(`évaluations      : ${stats.assessmentsDrafted}`);
  console.log(`skipped          : ${stats.skipped}`);
  console.log(`confiance simple : ${stats.confidenceSimple}`);
  console.log(`confiance composée: ${stats.confidenceComposite}`);
  console.log(`plages           : ${stats.confidenceRange}`);
  console.log(`confiance UNRES. : ${stats.confidenceUnresolvedCells}`);
  console.log(`limites items    : ${stats.limitationItems}`);
  console.log(`non-conclusions  : ${stats.cannotConcludeItems}`);
  console.log(`types preuve map : ${stats.evidenceTypesMapped}`);
  console.log(`types UNRES.     : ${stats.evidenceTypesUnresolved}`);
  console.log(`diagnostics      : ${stats.diagnostics}`);
}
