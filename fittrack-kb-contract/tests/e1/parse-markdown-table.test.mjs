import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractMarkdownLinks,
  isSeparatorRow,
  parseMarkdownTables,
  splitTableRow
} from '../../tools/parse-markdown-table.mjs';

test('splits a simple table row into cells', () => {
  const cells = splitTableRow('| alpha | beta | gamma |');
  assert.deepEqual(cells, ['alpha', 'beta', 'gamma']);
});

test('keeps empty cells instead of dropping them', () => {
  const cells = splitTableRow('| alpha |  | gamma |');
  assert.deepEqual(cells, ['alpha', '', 'gamma']);
});

test('preserves french unicode and punctuation in a cell', () => {
  const cells = splitTableRow('| Plus d’hypertrophie, « sans seuil » | Modéré |');
  assert.deepEqual(cells, ['Plus d’hypertrophie, « sans seuil »', 'Modéré']);
});

test('extracts several markdown links from one cell', () => {
  const raw =
    '[Pelland et al., 2026](https://pubmed.ncbi.nlm.nih.gov/41343037/); [ACSM, 2026](https://acsm.org/x)';
  const links = extractMarkdownLinks(raw);
  assert.deepEqual(links, [
    { label: 'Pelland et al., 2026', url: 'https://pubmed.ncbi.nlm.nih.gov/41343037/' },
    { label: 'ACSM, 2026', url: 'https://acsm.org/x' }
  ]);
});

test('keeps emphasis markup in the raw cell', () => {
  const cells = splitTableRow('| *The Dose Response* | Pelland |');
  assert.equal(cells[0], '*The Dose Response*');
});

test('detects a markdown separator row', () => {
  assert.equal(isSeparatorRow('|---|---|---|'), true);
  assert.equal(isSeparatorRow('| :--- | ---: | --- |'), true);
  assert.equal(isSeparatorRow('| Affirmation principale | Confiance |'), false);
});

test('parses header, separator and data rows from a table', () => {
  const text = [
    '# Volume',
    '',
    '| Affirmation principale | Confiance |',
    '|---|---|',
    '| Plus de séries. | Élevé |',
    '| Environ 10 séries. | Modéré |',
    '',
    'prose'
  ].join('\n');
  const tables = parseMarkdownTables(text);
  assert.equal(tables.length, 1);
  assert.deepEqual(tables[0].headerCells, ['Affirmation principale', 'Confiance']);
  assert.equal(tables[0].rows.length, 2);
  assert.equal(tables[0].rows[0].startLine, 5);
  assert.equal(tables[0].rows[0].cells[0].raw, 'Plus de séries.');
  assert.equal(tables[0].rows[0].rawText, '| Plus de séries. | Élevé |');
});

test('attaches links to the cell they were found in', () => {
  const text = [
    '| Affirmation | Sources |',
    '|---|---|',
    '| A | [Un](https://a.example) et [Deux](https://b.example) |'
  ].join('\n');
  const [table] = parseMarkdownTables(text);
  assert.deepEqual(table.rows[0].cells[1].links, [
    { label: 'Un', url: 'https://a.example' },
    { label: 'Deux', url: 'https://b.example' }
  ]);
});

test('does not treat a separator as a data row', () => {
  const text = ['| A | B |', '|---|---|', '| v | w |'].join('\n');
  const [table] = parseMarkdownTables(text);
  assert.equal(table.rows.length, 1);
  assert.equal(table.rows[0].cells[0].raw, 'v');
});
