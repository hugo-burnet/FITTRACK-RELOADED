import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  markdownToDisplayText,
  projectClaimContext,
} from '../../tools/e5-retrieval/context-projection.mjs';

const byte = (text) => new TextEncoder().encode(text).length;
const contractRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function claimFor(rawText, quote, secondQuote) {
  const spans = [quote, secondQuote]
    .filter(Boolean)
    .map((text) => {
      const start = rawText.indexOf(text);
      return {
        text,
        relativeStartByte: byte(rawText.slice(0, start)),
        relativeEndByte: byte(rawText.slice(0, start + text.length)),
      };
    });
  return { rawStatement: quote, supportSpans: spans };
}

test('keeps a complete Markdown URL inside a source sentence', () => {
  const rawText =
    'Avant. Une source [utile](https://example.org/a.b/page) confirme le résultat. Après.';
  const projection = projectClaimContext(claimFor(rawText, 'confirme le résultat'), { rawText });

  assert.equal(
    projection.rawContext,
    'Une source [utile](https://example.org/a.b/page) confirme le résultat.',
  );
  assert.equal(projection.displayContext, 'Une source utile confirme le résultat.');
  assert.ok(!projection.rawContext.endsWith('https://example.'));
});

test('does not split decimal values or common abbreviations', () => {
  const rawText = 'Dose p. ex. 1.5 g par jour, si indiqué. Conclusion suivante.';
  const projection = projectClaimContext(claimFor(rawText, '1.5 g par jour'), { rawText });

  assert.equal(projection.rawContext, 'Dose p. ex. 1.5 g par jour, si indiqué.');
});

test('keeps every sentence needed by multiple support spans', () => {
  const rawText = 'Début. Première preuve. Phrase de liaison. Seconde preuve. Fin.';
  const projection = projectClaimContext(
    claimFor(rawText, 'Première preuve', 'Seconde preuve'),
    { rawText },
  );

  assert.equal(
    projection.rawContext,
    'Première preuve. Phrase de liaison. Seconde preuve.',
  );
});

test('preserves UTF-8 byte anchors', () => {
  const rawText = 'Échauffement. L’étirement améliore la mobilité. Suite.';
  const projection = projectClaimContext(claimFor(rawText, 'améliore la mobilité'), { rawText });

  assert.equal(projection.rawContext, 'L’étirement améliore la mobilité.');
  assert.equal(
    new TextDecoder().decode(
      new TextEncoder().encode(rawText).slice(
        projection.supportStartByte,
        projection.supportEndByte,
      ),
    ),
    'améliore la mobilité',
  );
});

test('display projection removes presentation, not source words', () => {
  assert.equal(
    markdownToDisplayText('**Charge** : [étude](https://example.org) et `tempo`.'),
    'Charge : étude et tempo.',
  );
});

test('every real projection remains a verbatim source slice containing all support spans', () => {
  const corpus = JSON.parse(readFileSync(resolve(contractRoot, 'candidates/e5-corpus.json'), 'utf8'));
  const fragments = JSON.parse(
    readFileSync(resolve(contractRoot, 'candidates/e5-prose-fragments.json'), 'utf8'),
  );
  const fragmentById = new Map(
    fragments.fragments.map((fragment) => [fragment.fragmentId, fragment]),
  );

  for (const claim of corpus.claims) {
    const fragment = fragmentById.get(claim.fragmentId);
    const projection = projectClaimContext(claim, fragment);
    const sourceBytes = new TextEncoder().encode(fragment.rawText);
    const projectedBytes = sourceBytes.slice(
      projection.contextStartByte,
      projection.contextEndByte,
    );
    assert.equal(new TextDecoder().decode(projectedBytes), projection.rawContext);
    for (const span of claim.supportSpans) {
      assert.ok(projection.contextStartByte <= span.relativeStartByte);
      assert.ok(projection.contextEndByte >= span.relativeEndByte);
      assert.equal(
        new TextDecoder().decode(
          sourceBytes.slice(span.relativeStartByte, span.relativeEndByte),
        ),
        span.text,
      );
    }
    assert.doesNotMatch(projection.rawContext, /https?:\/\/[^\s)]*$/u);
  }
});
