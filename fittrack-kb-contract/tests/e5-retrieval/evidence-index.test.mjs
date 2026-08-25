import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const contractRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const repositoryRoot = resolve(contractRoot, '..');
const hash = (source) => `sha256:${createHash('sha256').update(source).digest('hex')}`;

test('the offline evidence index is current, complete and independently addressable', () => {
  const corpusSource = readFileSync(resolve(contractRoot, 'candidates/e5-corpus.json'), 'utf8');
  const fragmentsSource = readFileSync(
    resolve(contractRoot, 'candidates/e5-prose-fragments.json'),
    'utf8',
  );
  const index = JSON.parse(
    readFileSync(resolve(repositoryRoot, 'src/features/knowledge/evidence-index.json'), 'utf8'),
  );
  const corpus = JSON.parse(corpusSource);

  assert.equal(index.calibration.status, 'UNCALIBRATED');
  assert.equal(index.corpusHash, hash(corpusSource));
  assert.equal(index.fragmentsHash, hash(fragmentsSource));
  assert.equal(index.sourceClaimCount, corpus.claims.length);
  assert.equal(index.duplicateClaimCount, corpus.claims.length - index.claims.length);
  assert.equal(new Set(index.claims.map((claim) => claim.claimId)).size, index.claims.length);
  assert.ok(index.claims.every((claim) => claim.rawQuote && claim.displayContext));
});
