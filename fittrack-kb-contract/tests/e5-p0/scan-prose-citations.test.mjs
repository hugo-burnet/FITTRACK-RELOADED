import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sha256 } from '../../tools/fragment-e5-prose.mjs';
import { scanProseFragment } from '../../tools/scan-e5-prose-citations.mjs';

function source(rawText, { prefix = 'Préfixe UTF-8.\n', fragmentId = 'frag.e5f2.00000018' } = {}) {
  const full = prefix + rawText;
  const fileBytes = Buffer.from(full, 'utf8');
  const startByte = Buffer.byteLength(prefix, 'utf8');
  const endByte = startByte + Buffer.byteLength(rawText, 'utf8');
  const fragment = {
    fragmentId,
    corpusFileId: 'corpus.f2.anatomie-biomecanique',
    headingPath: ['1. Section'],
    startLine: 2,
    endLine: 2,
    startByte,
    endByte,
    blockType: 'paragraph',
    rawText,
    textHash: sha256(Buffer.from(rawText, 'utf8')),
    corpusFileContentHash: sha256(fileBytes)
  };
  return {
    fragment,
    fileBytes,
    scan: () => scanProseFragment(fragment, { fileBytes, shortLabel: 'F2', runId: 'run.e5-p0.test' })
  };
}

test('un lien produit une occurrence et jamais une Source', () => {
  const { scan } = source('[Nunes et al., 2022](https://example.test/nunes)');
  const out = scan();
  assert.equal(out.occurrences.length, 1);
  assert.equal(out.occurrences[0].payload.rawLabel, 'Nunes et al., 2022');
  assert.equal(out.occurrences[0].payload.resolvesToSourceRef, null);
});
test('plusieurs liens conservent leur ordre réel', () => {
  const { scan } = source('[A](https://a.test) puis [B](https://b.test) et [C](https://c.test)');
  const { occurrences } = scan();
  assert.deepEqual(occurrences.map((item) => item.payload.rawLabel), ['A', 'B', 'C']);
  assert.deepEqual(occurrences.map((item) => item.payload.occurrenceOrder), [1, 2, 3]);
});

test('même URL et labels différents restent deux occurrences', () => {
  const { occurrences } = source('[A](https://same.test) [Autre](https://same.test)').scan();
  assert.equal(occurrences.length, 2);
  assert.notEqual(occurrences[0].candidateId, occurrences[1].candidateId);
});

test('même label et URLs différentes restent deux occurrences', () => {
  const { occurrences } = source('[Même](https://a.test) [Même](https://b.test)').scan();
  assert.equal(occurrences.length, 2);
  assert.notEqual(occurrences[0].payload.rawUrl, occurrences[1].payload.rawUrl);
});

test('une citation répétée dans plusieurs fragments reste plusieurs occurrences', () => {
  const a = source('[A](https://same.test)', { fragmentId: 'frag.e5f2.00000010' }).scan().occurrences[0];
  const b = source('[A](https://same.test)', { fragmentId: 'frag.e5f2.00000020' }).scan().occurrences[0];
  assert.notEqual(a.candidateId, b.candidateId);
  assert.notEqual(a.fragmentRef, b.fragmentRef);
});

test('un lien interne relatif reste non résolu', () => {
  const { occurrences, diagnostics } = source('[F1](../f1.md)').scan();
  assert.equal(occurrences[0].payload.linkKind, 'internal');
  assert.equal(occurrences[0].payload.resolutionStatus, 'unresolved');
  assert.equal(diagnostics[0].code, 'internal_markdown_link');
});

test('un lien non bibliographique reste une occurrence non classifiée', () => {
  const occurrence = source('[site officiel](https://example.test/about)').scan().occurrences[0];
  assert.equal(occurrence.payload.bibliographicClassification, 'unclassified');
  assert.equal(occurrence.payload.documentType, undefined);
  assert.equal(occurrence.payload.author, undefined);
});

test('UTF-8 est conservé dans label, Markdown et offsets', () => {
  const raw = 'Évidence [Bernárdez-Vázquez, 2022](https://example.test/étude).';
  const { fileBytes, scan } = source(raw);
  const occurrence = scan().occurrences[0];
  assert.equal(occurrence.payload.rawLabel, 'Bernárdez-Vázquez, 2022');
  assert.equal(
    fileBytes.subarray(occurrence.payload.startByte, occurrence.payload.endByte).toString('utf8'),
    occurrence.payload.markdown
  );
});

test('les offsets relatifs relisent exactement le Markdown dans rawText', () => {
  const { fragment, scan } = source('Avant é [A](https://a.test) après.');
  const occurrence = scan().occurrences[0];
  assert.equal(
    Buffer.from(fragment.rawText, 'utf8')
      .subarray(occurrence.payload.relativeStartByte, occurrence.payload.relativeEndByte)
      .toString('utf8'),
    occurrence.payload.markdown
  );
});

test('les offsets absolus relisent exactement le même Markdown dans le fichier', () => {
  const { fileBytes, scan } = source('Avant [A](https://a.test) après.');
  const occurrence = scan().occurrences[0];
  assert.equal(
    fileBytes.subarray(occurrence.verbatimSpan.startByte, occurrence.verbatimSpan.endByte).toString('utf8'),
    occurrence.verbatimSpan.text
  );
});

test('le scan est idempotent, handles et IDs compris', () => {
  const src = source('[A](https://a.test) et [B](#interne)');
  assert.deepEqual(src.scan(), src.scan());
});

test('zéro attribution bibliographique ou enrichissement interdit', () => {
  const occurrence = source('[Nunes et al., 2022](https://doi.org/10.0/test)').scan().occurrences[0];
  assert.equal(occurrence.payload.resolvesToSourceRef, null);
  for (const field of ['author', 'year', 'doi', 'pmid', 'documentType', 'sourceRef']) {
    assert.equal(occurrence.payload[field], undefined);
  }
});

test('un fragment dont la provenance ne peut pas être relue est diagnostiqué et non scanné', () => {
  const src = source('[A](https://a.test)');
  src.fragment.rawText = '[B](https://b.test)';
  const out = src.scan();
  assert.equal(out.occurrences.length, 0);
  assert.equal(out.diagnostics[0].code, 'fragment_reread_mismatch');
});
