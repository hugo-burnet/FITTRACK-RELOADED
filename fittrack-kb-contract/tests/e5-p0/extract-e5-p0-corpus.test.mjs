import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { buildGoldenManifest } from '../../tools/extract-e5-p0.mjs';
import { fragmentProseDocument, sha256 } from '../../tools/fragment-e5-prose.mjs';
import { resolveCorpusFile } from '../../tools/resolve-corpus.mjs';
import { scanProseFragments } from '../../tools/scan-e5-prose-citations.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../..');
const repoRoot = join(root, '..');

function loadRealCorpus() {
  const config = JSON.parse(readFileSync(join(root, 'corpus/corpus-files.config.json'), 'utf8'));
  const files = config.files
    .filter((file) => ['F2', 'F3'].includes(file.shortLabel))
    .map((configured) => {
      const hit = resolveCorpusFile(configured, {
        packageRoot: root,
        repoRoot,
        archiveRef: config.archiveRef
      });
      assert.ok(hit.bytes, `${configured.shortLabel} introuvable`);
      assert.equal(sha256(hit.bytes), configured.expectedContentHash);
      return {
        corpusFileId: configured.corpusFileId,
        shortLabel: configured.shortLabel,
        title: configured.title,
        originalFilename: configured.originalFilename,
        contentHash: configured.expectedContentHash,
        byteLength: hit.bytes.length,
        bytes: hit.bytes
      };
    });
  return files;
}

function freshP0() {
  const files = loadRealCorpus();
  const legacyFragments = JSON.parse(readFileSync(join(root, 'fragments/fragments.json'), 'utf8')).fragments;
  const results = files.map((file) =>
    fragmentProseDocument({ corpusFile: file, bytes: file.bytes, legacyFragments })
  );
  const fragments = results.flatMap((result) => result.fragments);
  const filesById = new Map(files.map((file) => [file.corpusFileId, file]));
  const artifact = JSON.parse(readFileSync(join(root, 'candidates/e5-prose-fragments.json'), 'utf8'));
  const scan = scanProseFragments(fragments, filesById, { runId: artifact.runId });
  return { files, filesById, results, fragments, scan };
}

test('P0a sur F2/F3 réels est exhaustif, sans trou ni chevauchement et idempotent', () => {
  const a = freshP0();
  const b = freshP0();
  assert.deepEqual(a.results, b.results);
  const [f2, f3] = a.results;
  assert.equal(f2.fragments.length, 109);
  assert.equal(f3.fragments.length, 98);
  assert.equal(f2.stats.eligibleProseBytes, 82908);
  assert.equal(f3.stats.eligibleProseBytes, 17761);
  for (const result of a.results) {
    assert.equal(result.stats.coveragePercent, 100);
    assert.equal(result.uncoveredZones.length, 0);
    assert.equal(result.overlaps.length, 0);
    assert.equal(result.diagnostics.length, 0);
  }
});
test('chaque fragment réel est relu depuis les octets autoritaires et respecte le schéma existant', () => {
  const { fragments, filesById } = freshP0();
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  const schema = JSON.parse(readFileSync(join(root, 'schemas/core/corpus-fragment.schema.json'), 'utf8'));
  const validate = ajv.compile(schema);
  const ids = new Set();
  for (const fragment of fragments) {
    assert.equal(validate(fragment), true, ajv.errorsText(validate.errors));
    assert.equal(
      filesById.get(fragment.corpusFileId).bytes
        .subarray(fragment.startByte, fragment.endByte)
        .toString('utf8'),
      fragment.rawText
    );
    assert.equal(ids.has(fragment.fragmentId), false, `ID dupliqué ${fragment.fragmentId}`);
    ids.add(fragment.fragmentId);
  }
});

test('P0b réel produit 133 occurrences ordonnées, sourcées et sans attribution', () => {
  const { scan, fragments, filesById } = freshP0();
  assert.equal(scan.occurrences.length, 133);
  assert.equal(scan.diagnostics.length, 1);
  assert.equal(scan.diagnostics[0].code, 'internal_markdown_link');
  const fragmentById = new Map(fragments.map((fragment) => [fragment.fragmentId, fragment]));
  for (const occurrence of scan.occurrences) {
    const fragment = fragmentById.get(occurrence.fragmentRef);
    const file = filesById.get(occurrence.corpusFileRef);
    assert.ok(fragment);
    assert.equal(occurrence.payload.resolvesToSourceRef, null);
    assert.equal(
      Buffer.from(fragment.rawText, 'utf8')
        .subarray(occurrence.payload.relativeStartByte, occurrence.payload.relativeEndByte)
        .toString('utf8'),
      occurrence.payload.markdown
    );
    assert.equal(
      file.bytes.subarray(occurrence.payload.startByte, occurrence.payload.endByte).toString('utf8'),
      occurrence.payload.markdown
    );
  }
});

test('les occurrences réelles valident le schéma ExtractionCandidate existant', () => {
  const { scan } = freshP0();
  const ajv = new Ajv2020({ strict: false, allErrors: true, allowUnionTypes: true });
  addFormats(ajv);
  ajv.addSchema(JSON.parse(readFileSync(join(root, 'schemas/common/vocab.schema.json'), 'utf8')));
  const schema = JSON.parse(
    readFileSync(join(root, 'extraction-contract/extraction-candidate.schema.json'), 'utf8')
  );
  const validate = ajv.compile(schema);
  for (const occurrence of scan.occurrences) {
    assert.equal(validate(occurrence), true, ajv.errorsText(validate.errors));
  }
});

test('les artefacts versionnés sont la rematérialisation exacte du scan courant', () => {
  const { fragments, scan } = freshP0();
  const fragmentArtifact = JSON.parse(readFileSync(join(root, 'candidates/e5-prose-fragments.json'), 'utf8'));
  const citationArtifact = JSON.parse(
    readFileSync(join(root, 'candidates/e5-prose-citation-occurrences.json'), 'utf8')
  );
  assert.deepEqual(fragmentArtifact.fragments, fragments);
  assert.deepEqual(citationArtifact.candidates, scan.occurrences);
  assert.equal(fragmentArtifact.stats.schemaViolations, 0);
  assert.equal(fragmentArtifact.stats.invariantViolations, 0);
});

test('le golden manifest contient 50 F2 + 50 F3 et les onze ancres du Design Review', () => {
  const { files, fragments } = freshP0();
  const manifest = buildGoldenManifest(fragments, files);
  assert.equal(manifest.fragments.length, 100);
  assert.equal(manifest.fragments.filter((item) => item.corpusFileId.includes('.f2.')).length, 50);
  assert.equal(manifest.fragments.filter((item) => item.corpusFileId.includes('.f3.')).length, 50);
  assert.equal(manifest.fragments.filter((item) => item.selectionReason === 'design_review_anchor').length, 11);
  assert.equal(manifest.annotationStatus, 'unannotated');
  assert.equal(JSON.stringify(manifest).includes('claimCandidates'), false);
});
