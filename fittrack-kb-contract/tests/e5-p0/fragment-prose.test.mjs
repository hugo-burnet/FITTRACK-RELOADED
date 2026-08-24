import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fragmentProseDocument, sha256 } from '../../tools/fragment-e5-prose.mjs';

function fragment(text, { shortLabel = 'F2', legacyFragments = [] } = {}) {
  const bytes = Buffer.from(text, 'utf8');
  const corpusFile = {
    corpusFileId:
      shortLabel === 'F2'
        ? 'corpus.f2.anatomie-biomecanique'
        : 'corpus.f3.coaching-clinique',
    shortLabel,
    contentHash: sha256(bytes)
  };
  return fragmentProseDocument({ corpusFile, bytes, legacyFragments });
}

test('un paragraphe simple produit un fragment exact', () => {
  const out = fragment('Un paragraphe simple.');
  assert.equal(out.fragments.length, 1);
  assert.equal(out.fragments[0].rawText, 'Un paragraphe simple.');
  assert.equal(out.fragments[0].blockType, 'paragraph');
});
test('plusieurs paragraphes sous le même heading restent séparés avec le même contexte', () => {
  const out = fragment('## 1. Section\n\nPremier paragraphe.\n\nDeuxième paragraphe.');
  assert.equal(out.fragments.length, 2);
  assert.deepEqual(out.fragments.map((item) => item.headingPath), [
    ['1. Section'],
    ['1. Section']
  ]);
});

test('un changement de heading change le headingPath du fragment suivant', () => {
  const out = fragment('## 1. Première\n\nA.\n\n## 2. Seconde\n\nB.');
  assert.deepEqual(out.fragments.map((item) => item.headingPath), [
    ['1. Première'],
    ['2. Seconde']
  ]);
});

test('chaque item de liste est une unité source autonome', () => {
  const out = fragment('- Premier item.\n- Deuxième item.');
  assert.deepEqual(out.fragments.map((item) => item.rawText), ['- Premier item.', '- Deuxième item.']);
  assert.ok(out.fragments.every((item) => item.blockType === 'list_item'));
});

test('plusieurs phrases dans un paragraphe ne sont jamais découpées phrase par phrase', () => {
  const raw = 'Première phrase. Deuxième phrase. Conclusion dépendante.';
  const out = fragment(raw);
  assert.equal(out.fragments.length, 1);
  assert.equal(out.fragments[0].rawText, raw);
});

test('un paragraphe avec plusieurs citations reste un seul fragment', () => {
  const raw = 'Texte [A](https://a.example) puis [B](https://b.example).';
  const out = fragment(raw);
  assert.equal(out.fragments.length, 1);
  assert.equal(out.fragments[0].rawText, raw);
});

test('les caractères français et Unicode conservent des offsets octets exacts', () => {
  const raw = 'Épaule, biomécanique et cœur : ≥ 3 séries.';
  const out = fragment(raw);
  const item = out.fragments[0];
  assert.equal(item.endByte - item.startByte, Buffer.byteLength(raw, 'utf8'));
  assert.equal(Buffer.from(raw, 'utf8').subarray(item.startByte, item.endByte).toString('utf8'), raw);
});

test('le Markdown inline est conservé verbatim', () => {
  const raw = '**Important** : garder `rawText` et *la nuance*.';
  assert.equal(fragment(raw).fragments[0].rawText, raw);
});

test('les lignes vides sont des exclusions volontaires et jamais des fragments', () => {
  const out = fragment('A.\n\n\nB.');
  assert.equal(out.fragments.length, 2);
  assert.ok(out.exclusions.some((zone) => zone.reason === 'excluded_blank_lines'));
});

test('la fin de fichier sans newline est incluse exactement', () => {
  const raw = 'Texte final sans newline';
  const item = fragment(raw).fragments[0];
  assert.equal(item.endByte, Buffer.byteLength(raw, 'utf8'));
});

test('des fragments adjacents ne se chevauchent pas et leur séparateur est expliqué', () => {
  const out = fragment('- A\n- B');
  assert.equal(out.overlaps.length, 0);
  assert.ok(out.fragments[0].endByte <= out.fragments[1].startByte);
  assert.equal(out.uncoveredZones.length, 0);
});

test('aucun trou involontaire ne subsiste dans un document Markdown certain', () => {
  const out = fragment('# Titre\n\nParagraphe.\n\n| A |\n|---|\n| B |');
  assert.equal(out.uncoveredZones.length, 0);
  assert.equal(out.stats.uncoveredBytes, 0);
  assert.equal(out.stats.coveragePercent, 100);
  assert.equal(out.stats.fileBytes, out.stats.coveredFragmentBytes + out.stats.intentionallyExcludedBytes);
});

test('les IDs sont stables et un fragment historique exact conserve son ID', () => {
  const raw = 'Texte stable.';
  const base = fragment(raw).fragments[0];
  const legacy = [{ ...base, fragmentId: 'frag.f2.0042' }];
  const a = fragment(raw, { legacyFragments: legacy });
  const b = fragment(raw, { legacyFragments: legacy });
  assert.equal(a.fragments[0].fragmentId, 'frag.f2.0042');
  assert.equal(a.fragments[0].fragmentId, b.fragments[0].fragmentId);
});

test('la fragmentation est idempotente', () => {
  const raw = '## Section\n\nÉlément un.\n\n- Élément deux\n- Élément trois';
  assert.deepEqual(fragment(raw), fragment(raw));
});

test('startByte/endByte relisent chaque fragment octet pour octet', () => {
  const raw = '## Titre\n\nFrançais : élève.\n\nDeuxième bloc.';
  const bytes = Buffer.from(raw, 'utf8');
  const out = fragment(raw);
  for (const item of out.fragments) {
    assert.equal(bytes.subarray(item.startByte, item.endByte).toString('utf8'), item.rawText);
    assert.equal(item.textHash, sha256(bytes.subarray(item.startByte, item.endByte)));
  }
});

test('une ligne ressemblant à un tableau sans séparateur est diagnostiquée sans heuristique', () => {
  const out = fragment('| passage ambigu |');
  assert.equal(out.fragments.length, 0);
  assert.equal(out.uncoveredZones.length, 1);
  assert.equal(out.diagnostics[0].code, 'unrecognized_table_like_line');
  assert.equal(out.stats.coveragePercent, 0);
});
