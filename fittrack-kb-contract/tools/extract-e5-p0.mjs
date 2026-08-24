#!/usr/bin/env node
// E5-P0a/P0b — prépare des fragments de prose F2/F3 et leurs occurrences de
// citation. Aucun appel modèle, aucune claim, aucune Source, aucune écriture
// hors candidates/.

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {
  E5_P0_EXTRACTED_AT,
  E5_P0_EXTRACTOR_VERSION,
  fragmentProseDocument,
  sha256
} from './fragment-e5-prose.mjs';
import { resolveCorpusFile } from './resolve-corpus.mjs';
import {
  proseCitationStats,
  scanProseFragments
} from './scan-e5-prose-citations.mjs';

const E5_FILES = new Set([
  'corpus.f2.anatomie-biomecanique',
  'corpus.f3.coaching-clinique'
]);

const DESIGN_REVIEW_ANCHORS = {
  'corpus.f2.anatomie-biomecanique': [13, 76, 138, 216, 353],
  'corpus.f3.coaching-clinique': [11, 12, 53, 90, 109, 152]
};

function hashText(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}
function topLevelSection(fragment) {
  return fragment.headingPath.find((heading) => /^\d+\.\s/.test(heading)) ?? fragment.headingPath.at(-1) ?? '(root)';
}

function selectGoldenForFile(fragments, corpusFile, target = 50) {
  if (fragments.length < target) {
    throw new Error(`${corpusFile.shortLabel} ne contient que ${fragments.length} fragments, moins que ${target}`);
  }
  const anchors = DESIGN_REVIEW_ANCHORS[corpusFile.corpusFileId] ?? [];
  const selected = [];
  const selectedIds = new Set();
  for (const line of anchors) {
    const fragment = fragments.find((item) => item.startLine <= line && item.endLine >= line);
    if (!fragment) throw new Error(`Ancre Design Review absente : ${corpusFile.shortLabel} ligne ${line}`);
    if (!selectedIds.has(fragment.fragmentId)) {
      selectedIds.add(fragment.fragmentId);
      selected.push({ fragment, selectionReason: 'design_review_anchor' });
    }
  }

  const bySection = new Map();
  for (const fragment of fragments) {
    if (selectedIds.has(fragment.fragmentId)) continue;
    const section = topLevelSection(fragment);
    if (!bySection.has(section)) bySection.set(section, []);
    bySection.get(section).push(fragment);
  }
  const sectionOrder = [...bySection.keys()].sort((a, b) => {
    const firstA = bySection.get(a)[0].startByte;
    const firstB = bySection.get(b)[0].startByte;
    return firstA - firstB;
  });
  for (const section of sectionOrder) {
    bySection.get(section).sort((a, b) => {
      const ah = hashText(`${corpusFile.contentHash}\ngolden-v1\n${a.fragmentId}`);
      const bh = hashText(`${corpusFile.contentHash}\ngolden-v1\n${b.fragmentId}`);
      return ah.localeCompare(bh) || a.startByte - b.startByte;
    });
  }
  while (selected.length < target) {
    let progressed = false;
    for (const section of sectionOrder) {
      const fragment = bySection.get(section).shift();
      if (!fragment) continue;
      selectedIds.add(fragment.fragmentId);
      selected.push({ fragment, selectionReason: 'deterministic_stratified' });
      progressed = true;
      if (selected.length === target) break;
    }
    if (!progressed) break;
  }
  return selected.map(({ fragment, selectionReason }) => ({
    fragmentId: fragment.fragmentId,
    corpusFileId: fragment.corpusFileId,
    startLine: fragment.startLine,
    endLine: fragment.endLine,
    startByte: fragment.startByte,
    endByte: fragment.endByte,
    headingPath: fragment.headingPath,
    selectionReason
  }));
}

export function buildGoldenManifest(fragments, files) {
  const selected = [];
  for (const file of files) {
    selected.push(
      ...selectGoldenForFile(
        fragments.filter((fragment) => fragment.corpusFileId === file.corpusFileId),
        file,
        50
      )
    );
  }
  return {
    generatedBy: 'tools/extract-e5-p0.mjs',
    selectionVersion: '1.0.0-e5-golden-manifest',
    note:
      'Manifest non annoté. Il stabilise 50 fragments F2 et 50 fragments F3 pour annotation humaine ; aucune claim ni réponse attendue n est générée.',
    annotationStatus: 'unannotated',
    requirements: {
      totalFragments: 100,
      perCorpusFile: { F2: 50, F3: 50 },
      minimumZeroClaim: 20,
      minimumHighRiskClinical: 20,
      minimumMultipleCitations: 15,
      minimumEmgBiomechanicsMechanism: 15,
      minimumNumericThresholds: 10,
      minimumContradictionOrExplicitAbsence: 10,
      minimumExpertPractice: 10,
      note: 'Ces catégories doivent être confirmées manuellement ; P0 ne décide pas quels claims existent.'
    },
    fragments: selected
  };
}

function validateSchemas(root, fragments, occurrences) {
  const ajv = new Ajv2020({ strict: false, allErrors: true, allowUnionTypes: true });
  addFormats(ajv);
  const vocab = JSON.parse(readFileSync(join(root, 'schemas/common/vocab.schema.json'), 'utf8'));
  const fragmentSchema = JSON.parse(readFileSync(join(root, 'schemas/core/corpus-fragment.schema.json'), 'utf8'));
  const candidateSchema = JSON.parse(
    readFileSync(join(root, 'extraction-contract/extraction-candidate.schema.json'), 'utf8')
  );
  ajv.addSchema(vocab);
  const validateFragment = ajv.compile(fragmentSchema);
  const validateCandidate = ajv.compile(candidateSchema);
  const violations = [];
  for (const fragment of fragments) {
    if (!validateFragment(fragment)) {
      violations.push({
        kind: 'corpus-fragment',
        id: fragment.fragmentId,
        errors: structuredClone(validateFragment.errors)
      });
    }
  }
  for (const occurrence of occurrences) {
    if (!validateCandidate(occurrence)) {
      violations.push({
        kind: 'extraction-candidate',
        id: occurrence.candidateId,
        errors: structuredClone(validateCandidate.errors)
      });
    }
  }
  return violations;
}

function p0InvariantViolations(fragments, occurrences, filesById, fragmentedResults) {
  const violations = [];
  const unique = (items, label) => {
    const seen = new Set();
    for (const item of items) {
      if (seen.has(item)) violations.push({ code: 'duplicate_id', label, value: item });
      seen.add(item);
    }
  };
  unique(fragments.map((fragment) => fragment.fragmentId), 'fragmentId');
  unique(occurrences.map((occurrence) => occurrence.candidateId), 'candidateId');
  unique(occurrences.map((occurrence) => occurrence.payload.handle), 'citationHandle');
  const fragmentById = new Map(fragments.map((fragment) => [fragment.fragmentId, fragment]));
  for (const fragment of fragments) {
    const file = filesById.get(fragment.corpusFileId);
    const reread = file?.bytes.subarray(fragment.startByte, fragment.endByte).toString('utf8');
    if (reread !== fragment.rawText) {
      violations.push({ code: 'fragment_reread_mismatch', fragmentId: fragment.fragmentId });
    }
  }
  for (const occurrence of occurrences) {
    const fragment = fragmentById.get(occurrence.fragmentRef);
    const file = filesById.get(occurrence.corpusFileRef);
    if (!fragment) violations.push({ code: 'fragment_ref_unresolved', candidateId: occurrence.candidateId });
    if (occurrence.payload.resolvesToSourceRef !== null) {
      violations.push({ code: 'source_attribution_forbidden', candidateId: occurrence.candidateId });
    }
    const relative = fragment?.rawText
      ? Buffer.from(fragment.rawText, 'utf8')
          .subarray(occurrence.payload.relativeStartByte, occurrence.payload.relativeEndByte)
          .toString('utf8')
      : null;
    const absolute = file?.bytes
      .subarray(occurrence.payload.startByte, occurrence.payload.endByte)
      .toString('utf8');
    if (relative !== occurrence.payload.markdown || absolute !== occurrence.payload.markdown) {
      violations.push({ code: 'citation_reread_mismatch', candidateId: occurrence.candidateId });
    }
    for (const forbidden of ['author', 'year', 'doi', 'pmid', 'documentType', 'sourceRef']) {
      if (Object.hasOwn(occurrence.payload, forbidden)) {
        violations.push({ code: 'bibliographic_inference_forbidden', candidateId: occurrence.candidateId, field: forbidden });
      }
    }
  }
  for (const result of fragmentedResults) {
    if (result.overlaps.length) violations.push({ code: 'fragment_overlap', count: result.overlaps.length });
    if (result.uncoveredZones.length) violations.push({ code: 'fragment_coverage_hole', count: result.uncoveredZones.length });
  }
  return violations;
}

function citationStatsByFile(occurrences, diagnostics, files) {
  const out = {};
  for (const file of files) {
    const subset = occurrences.filter((occurrence) => occurrence.corpusFileRef === file.corpusFileId);
    const diag = diagnostics.filter((item) => item.corpusFileId === file.corpusFileId);
    out[file.shortLabel] = proseCitationStats(subset, diag);
  }
  return out;
}

function isCli() {
  return (process.argv[1] ?? '').replaceAll('\\', '/').endsWith('extract-e5-p0.mjs');
}

if (isCli()) {
  const here = dirname(fileURLToPath(import.meta.url));
  const root = join(here, '..');
  const repoRoot = join(root, '..');
  const config = JSON.parse(readFileSync(join(root, 'corpus/corpus-files.config.json'), 'utf8'));
  const legacyFragments = JSON.parse(readFileSync(join(root, 'fragments/fragments.json'), 'utf8')).fragments;
  const files = [];
  for (const configured of config.files.filter((file) => E5_FILES.has(file.corpusFileId))) {
    const hit = resolveCorpusFile(configured, {
      packageRoot: root,
      repoRoot,
      archiveRef: config.archiveRef
    });
    if (!hit.bytes) throw new Error(`Corpus introuvable : ${configured.corpusFileId}`);
    const contentHash = sha256(hit.bytes);
    if (contentHash !== configured.expectedContentHash) {
      throw new Error(`Hash inattendu pour ${configured.corpusFileId}`);
    }
    files.push({
      corpusFileId: configured.corpusFileId,
      shortLabel: configured.shortLabel,
      title: configured.title,
      originalFilename: configured.originalFilename,
      contentHash,
      byteLength: hit.bytes.length,
      bytes: hit.bytes
    });
  }
  const filesById = new Map(files.map((file) => [file.corpusFileId, file]));
  const fragmentedResults = files.map((file) =>
    fragmentProseDocument({ corpusFile: file, bytes: file.bytes, legacyFragments })
  );
  const fragments = fragmentedResults.flatMap((result) => result.fragments);
  const runId = `run.e5-p0.${hashText(
    E5_P0_EXTRACTOR_VERSION +
      JSON.stringify(files.map((file) => [file.corpusFileId, file.contentHash])) +
      JSON.stringify(fragments.map((fragment) => fragment.fragmentId))
  ).slice(0, 12)}`;
  const citationScan = scanProseFragments(fragments, filesById, { runId });
  const occurrences = citationScan.occurrences;
  const schemaViolations = validateSchemas(root, fragments, occurrences);
  const invariantViolations = p0InvariantViolations(
    fragments,
    occurrences,
    filesById,
    fragmentedResults
  );
  const coverageByFile = {};
  const fragmentOrder = [];
  const excludedZones = [];
  const uncoveredZones = [];
  const overlaps = [];
  const fragmentationDiagnostics = [];
  for (let index = 0; index < files.length; index++) {
    const file = files[index];
    const result = fragmentedResults[index];
    coverageByFile[file.shortLabel] = result.stats;
    fragmentOrder.push(
      ...result.fragmentOrder.map((entry) => ({ ...entry, corpusFileId: file.corpusFileId }))
    );
    excludedZones.push(
      ...result.exclusions.map((zone) => ({ corpusFileId: file.corpusFileId, ...zone }))
    );
    uncoveredZones.push(
      ...result.uncoveredZones.map((zone) => ({ corpusFileId: file.corpusFileId, ...zone }))
    );
    overlaps.push(...result.overlaps.map((zone) => ({ corpusFileId: file.corpusFileId, ...zone })));
    fragmentationDiagnostics.push(...result.diagnostics);
  }
  const citationByFile = citationStatsByFile(occurrences, citationScan.diagnostics, files);
  const globalCitationStats = proseCitationStats(occurrences, citationScan.diagnostics);
  const globalStats = {
    fragments: fragments.length,
    eligibleProseBytes: Object.values(coverageByFile).reduce((sum, item) => sum + item.eligibleProseBytes, 0),
    coveredFragmentBytes: Object.values(coverageByFile).reduce((sum, item) => sum + item.coveredFragmentBytes, 0),
    coveragePercent: 0,
    occurrences: occurrences.length,
    distinctUrls: globalCitationStats.distinctUrls,
    duplicateUrlOccurrences: globalCitationStats.duplicateUrlOccurrences,
    internalLinks: globalCitationStats.internalLinks,
    unclassifiedLinks: globalCitationStats.unclassifiedLinks,
    coverageHoles: uncoveredZones.length,
    overlaps: overlaps.length,
    schemaViolations: schemaViolations.length,
    invariantViolations: invariantViolations.length
  };
  globalStats.coveragePercent =
    globalStats.eligibleProseBytes === 0
      ? 100
      : Number(((globalStats.coveredFragmentBytes / globalStats.eligibleProseBytes) * 100).toFixed(6));

  const corpusSnapshot = files.map(({ bytes, ...file }) => file);
  writeFileSync(
    join(root, 'candidates/e5-prose-fragments.json'),
    JSON.stringify(
      {
        generatedBy: 'tools/extract-e5-p0.mjs',
        extractorVersion: E5_P0_EXTRACTOR_VERSION,
        runId,
        extractedAt: E5_P0_EXTRACTED_AT,
        method: 'deterministic_markdown_block_fragmentation',
        note:
          'Fragments de prose reconstructibles F2/F3. Aucun claim. Les fragments historiques exacts conservent leur fragmentId.',
        corpusSnapshot,
        fragments,
        fragmentOrder,
        coverage: coverageByFile,
        stats: globalStats
      },
      null,
      2
    ) + '\n'
  );
  writeFileSync(
    join(root, 'candidates/e5-prose-citation-occurrences.json'),
    JSON.stringify(
      {
        generatedBy: 'tools/extract-e5-p0.mjs',
        extractorVersion: E5_P0_EXTRACTOR_VERSION,
        runId,
        extractedAt: E5_P0_EXTRACTED_AT,
        method: 'deterministic_link_scan',
        note:
          'Occurrences de liens dans la prose E5-P0a. Pas des Sources ; resolvesToSourceRef reste null ; aucune attribution bibliographique.',
        candidates: occurrences,
        stats: { byCorpusFile: citationByFile, global: globalCitationStats }
      },
      null,
      2
    ) + '\n'
  );
  writeFileSync(
    join(root, 'candidates/e5-p0-diagnostics.json'),
    JSON.stringify(
      {
        generatedBy: 'tools/extract-e5-p0.mjs',
        extractorVersion: E5_P0_EXTRACTOR_VERSION,
        runId,
        fragmentationDiagnostics,
        citationDiagnostics: citationScan.diagnostics,
        excludedZones,
        uncoveredZones,
        overlaps,
        schemaViolations,
        invariantViolations,
        stats: globalStats
      },
      null,
      2
    ) + '\n'
  );
  writeFileSync(
    join(root, 'candidates/e5-prose-golden-manifest.json'),
    JSON.stringify(buildGoldenManifest(fragments, files), null, 2) + '\n'
  );

  for (const file of files) {
    const coverage = coverageByFile[file.shortLabel];
    const citations = citationByFile[file.shortLabel];
    console.log(
      `${file.shortLabel}: ${coverage.fragments} fragments, ${coverage.coveredFragmentBytes}/${coverage.eligibleProseBytes} octets (${coverage.coveragePercent} %), ${citations.occurrences} citations, ${citations.distinctUrls} URLs`
    );
  }
  console.log(`Global: ${fragments.length} fragments, ${occurrences.length} occurrences`);
  console.log(`Trous: ${uncoveredZones.length}; chevauchements: ${overlaps.length}`);
  console.log(`Violations schema: ${schemaViolations.length}; invariants P0: ${invariantViolations.length}`);
}
